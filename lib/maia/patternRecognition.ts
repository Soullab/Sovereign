/**
 * MAIA pattern recognition across kept memory.
 *
 * Canon: docs/canon/SPIRAL_CONTINUITY_ENGINE.md §6a "The Pattern Offer" — ratified by
 * Kelly, 2026-11-23 ("approved"). Working record, including the role of every memory,
 * elemental and alchemical layer (source / lens / prompt):
 * docs/programme/MAIA_PATTERN_RECOGNITION_CANON_AMENDMENT_2026-11-23.md §2b.
 *
 * What this module does:
 *   - Reads the member's dial (§6a.7). No row = 'full' (founder default). A failed read
 *     fails CLOSED to 'off': a member who dialled down is never overridden by an outage.
 *   - Reads member-confirmed patterns and their sources (§6a.4) for the prompt.
 *   - Builds the PATTERN RECOGNITION prompt block for the member's dial.
 *   - Extracts MAIA's offer from her reply, strips it from what the member sees and
 *     from what is persisted, and validates it against the refs she was actually given.
 *   - Records the member's verdict: confirm / correct (stored, with sources) or dismiss
 *     (a content-free key only). An unanswered offer is never stored.
 *
 * What this module never does:
 *   - Never stores a pattern the member has not confirmed or corrected.
 *   - Never accepts a source the member does not own, that is not eligible to return,
 *     that is sacred-protected, sealed, or outside personal scope (client material
 *     never becomes a pattern — §6a.6, ruling 4).
 *   - Never runs for Sanctuary turns: callers pass `sanctuary`, and this module returns
 *     nothing (§6a.0 — absolute).
 */

import { createHash } from 'crypto';
import { query, transaction } from '@/lib/db/postgres';
import type { MemoryAtomSnapshot, AtomPatternRecognition } from '@/lib/maia/memoryAtomsLoader';

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════

export type PatternLevel = 'full' | 'gentle' | 'on_request' | 'off';
export const PATTERN_LEVELS: readonly PatternLevel[] = ['full', 'gentle', 'on_request', 'off'];
export const DEFAULT_PATTERN_LEVEL: PatternLevel = 'full';

export type PatternOriginSurface = 'maia' | 'between' | 'room' | 'pro_personal';

export type PatternSourceKind = 'atom' | 'pattern';

export interface PatternSourceRef {
  kind: PatternSourceKind;
  id: string;
}

/** A source as the member sees it: their own words, and when. */
export interface PatternSourceView extends PatternSourceRef {
  label: string;
  at: string | null;
}

export interface ConfirmedPattern {
  id: string;
  wording: string;
  wordedBy: 'maia' | 'member';
  status: 'confirmed' | 'corrected' | 'archived';
  returnPreference: 'member_pulled' | 'contextual_doorway';
  confirmedAt: Date;
  sources: PatternSourceView[];
}

/** What MAIA offered this turn, as returned to the client. Never persisted as-is. */
export interface PatternOffer {
  wording: string;
  sources: PatternSourceView[];
  sourceKey: string;
  offeredAt: string;
  originSurface: PatternOriginSurface;
}

export const PATTERN_WORDING_MAX = 1000;
export const MAX_PATTERN_SOURCES = 12;
export const MAX_CONFIRMED_PATTERNS_IN_PROMPT = 8;

// ════════════════════════════════════════════════════════════════════════════
// Pure helpers
// ════════════════════════════════════════════════════════════════════════════

export function isPatternLevel(v: unknown): v is PatternLevel {
  return typeof v === 'string' && (PATTERN_LEVELS as readonly string[]).includes(v);
}

/**
 * Content-free fingerprint of a source set: sha256 over the sorted `kind:id` list.
 * Used to recognise "the same reading" for dismissal and de-duplication without
 * ever storing what MAIA said.
 */
export function computeSourceKey(sources: readonly PatternSourceRef[]): string {
  const canon = Array.from(new Set(sources.map((s) => `${s.kind}:${s.id.toLowerCase()}`))).sort();
  return createHash('sha256').update(canon.join('|')).digest('hex');
}

/** Did the member, in this message, invite MAIA to look for patterns? (When I ask.) */
export function memberAskedForPatterns(message: string | null | undefined): boolean {
  if (!message) return false;
  return /\b(patterns?|connect(?:s|ed|ion|ions)?|link(?:s|ed)?|threads?|in common|keeps? (?:coming|showing) up|recurring|theme|what do you (?:see|notice)|have you noticed|do you see)\b/i.test(
    message,
  );
}

function relative(d: Date | null | undefined): string {
  if (!d) return 'some time ago';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function oneLine(s: string | null | undefined, max: number): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

// ════════════════════════════════════════════════════════════════════════════
// Refs: the short handles MAIA cites. Server-side only; ids never reach the model.
// ════════════════════════════════════════════════════════════════════════════

export interface PatternRefTable {
  /** ref → source, with the member-facing label */
  byRef: Map<string, PatternSourceView>;
  /** atom id → ref */
  atomRefs: Map<string, string>;
  /** pattern id → ref */
  patternRefs: Map<string, string>;
}

export function assignPatternRefs(
  atoms: readonly MemoryAtomSnapshot[],
  patterns: readonly ConfirmedPattern[],
): PatternRefTable {
  const byRef = new Map<string, PatternSourceView>();
  const atomRefs = new Map<string, string>();
  const patternRefs = new Map<string, string>();
  let a = 0;
  for (const atom of atoms) {
    // Practitioner observations are never a pattern source (§6a.1).
    if (atom.sourceType === 'practitioner_observation') continue;
    const ref = `a${++a}`;
    atomRefs.set(atom.id, ref);
    byRef.set(ref, {
      kind: 'atom',
      id: atom.id,
      label: oneLine(atom.title, 140),
      at: atom.keptAt ? new Date(atom.keptAt).toISOString() : null,
    });
  }
  let p = 0;
  for (const pattern of patterns) {
    const ref = `p${++p}`;
    patternRefs.set(pattern.id, ref);
    byRef.set(ref, {
      kind: 'pattern',
      id: pattern.id,
      label: oneLine(pattern.wording, 200),
      at: pattern.confirmedAt ? new Date(pattern.confirmedAt).toISOString() : null,
    });
  }
  return { byRef, atomRefs, patternRefs };
}

// ════════════════════════════════════════════════════════════════════════════
// Prompt block
// ════════════════════════════════════════════════════════════════════════════

export interface PatternBlockInput {
  level: PatternLevel;
  refs: PatternRefTable;
  patterns: readonly ConfirmedPattern[];
  /** The member's message this turn (for When I ask). */
  memberMessage: string;
  /** Offers MAIA already made in this conversation (for Gentle). */
  offersThisConversation: number;
}

export const PATTERN_OFFER_TAG = 'pattern_offer';

/** May MAIA make an offer on this turn, given the dial? */
export function offerAllowed(input: Pick<PatternBlockInput, 'level' | 'memberMessage' | 'offersThisConversation'>): boolean {
  switch (input.level) {
    case 'full':
      return true;
    case 'gentle':
      return input.offersThisConversation < 1;
    case 'on_request':
      return memberAskedForPatterns(input.memberMessage);
    case 'off':
    default:
      return false;
  }
}

export function buildPatternRecognitionBlock(input: PatternBlockInput): string {
  const { level, refs, patterns } = input;
  const allowed = offerAllowed(input);
  if (level === 'off' && patterns.length === 0) return '';

  const lines: string[] = [];
  lines.push(`# PATTERN RECOGNITION (member's setting: ${levelLabel(level)})`);
  lines.push('');

  if (patterns.length > 0) {
    lines.push(
      'Patterns the member has confirmed. These are theirs, in the words they accepted. ' +
        'You may return to them as their own recognitions' +
        (allowed && level !== 'gentle' ? ' and build higher-level patterns on them' : '') +
        '.',
    );
    for (const pattern of patterns) {
      const ref = refs.patternRefs.get(pattern.id);
      const rests = pattern.sources
        .map((s) => (s.kind === 'atom' ? refs.atomRefs.get(s.id) : refs.patternRefs.get(s.id)) ?? `"${oneLine(s.label, 60)}"`)
        .join(', ');
      const who = pattern.wordedBy === 'member' ? 'in their own words' : 'as you offered it and they confirmed';
      lines.push(`- [${ref}] "${oneLine(pattern.wording, 300)}" — ${who}, ${relative(pattern.confirmedAt)} — rests on ${rests}`);
    }
    lines.push('');
  }

  if (!allowed) {
    lines.push(
      level === 'off'
        ? 'The member has switched pattern offers off. Do not offer new patterns across their kept material.'
        : level === 'on_request'
          ? 'The member wants pattern offers only when they ask. They have not asked this turn: do not offer one.'
          : 'The member chose Gentle: one pattern offer in a conversation. It has been made: do not offer another.',
    );
    lines.push('');
    return lines.join('\n').trimEnd();
  }

  lines.push(
    level === 'full'
      ? 'You may recognise patterns across what the member has kept — including high-level patterns across the patterns above — whenever what they are bringing now touches them. This is part of your gift; the meaning stays theirs.'
      : level === 'gentle'
        ? 'The member chose Gentle: you may make at most ONE pattern offer in this conversation, drawn only from kept items [aN], not built on earlier patterns.'
        : 'The member asked you to look for patterns. You may offer one.',
  );
  lines.push('');
  lines.push('How to offer (canon: Spiral Continuity Engine §6a):');
  lines.push(
    '- Sources: cite only the refs listed in your context — kept items [aN]' +
      (level === 'gentle' ? '' : ' and confirmed patterns [pN]') +
      " — and the member's own words earlier in this conversation. Name each item you rest on in the member's own words, with when they kept it.",
  );
  lines.push(
    '- Lenses: Spiralogic elements and phases, the conductor\'s current element, and the elemental/alchemical field shape how you see and name a pattern ("there appears to be a Water movement across these"). They are never evidence about the person.',
  );
  lines.push(
    '- Prompts: theme or developmental signals elsewhere in your context may tell you where to look. Never cite them and never state them as findings.',
  );
  lines.push(
    '- Offer it as your reading — "I wonder if…", "what I notice is…" — say what you do not know, and leave it to them to confirm it, put it in their own words, or let it go.',
  );
  lines.push(
    '- Never: stage, trajectory, diagnosis, prediction or identity ("you are someone who…"). Never build on a pattern they have not confirmed. Never imply you noticed it while they were away.',
  );
  lines.push('- Not every turn needs a pattern. Quiet is fine. Do not offer one to make them feel known.');
  lines.push('');
  lines.push(
    `When — and only when — you offer a pattern, end your reply with exactly one line: <${PATTERN_OFFER_TAG} sources="a1,a3">the pattern in one or two sentences, as you offered it</${PATTERN_OFFER_TAG}>`,
  );
  lines.push(
    'At least two sources. The member does not see that line; it is how they keep or dismiss what you offered. One offer per reply at most.',
  );
  return lines.join('\n');
}

export function levelLabel(level: PatternLevel): string {
  return level === 'full' ? 'Full' : level === 'gentle' ? 'Gentle' : level === 'on_request' ? 'When I ask' : 'Off';
}

/**
 * Everything a route needs for one turn: the AtomPatternRecognition to hand to
 * projectAtomSections/formatAtomsForPrompt, and the ref table to validate the reply.
 * Returns null when pattern recognition does not apply at all (Sanctuary, dial off
 * with no confirmed patterns) — the caller then renders the legacy block unchanged.
 */
export interface PatternTurnContext {
  level: PatternLevel;
  refs: PatternRefTable;
  atomPatternRecognition: AtomPatternRecognition;
  offerAllowed: boolean;
  dismissedKeys: Set<string>;
  confirmedKeys: Set<string>;
  originSurface: PatternOriginSurface;
  memberMessage: string;
  offersThisConversation: number;
}

export function buildPatternTurnContext(input: {
  sanctuary: boolean;
  level: PatternLevel;
  atoms: readonly MemoryAtomSnapshot[];
  patterns: readonly ConfirmedPattern[];
  dismissedKeys: Set<string>;
  confirmedKeys: Set<string>;
  memberMessage: string;
  offersThisConversation: number;
  originSurface: PatternOriginSurface;
}): PatternTurnContext | null {
  if (input.sanctuary) return null; // §6a.0 — absolute
  const patterns = input.patterns;
  if (input.level === 'off' && patterns.length === 0) return null;
  const refs = assignPatternRefs(input.atoms, patterns);
  const block = buildPatternRecognitionBlock({
    level: input.level,
    refs,
    patterns,
    memberMessage: input.memberMessage,
    offersThisConversation: input.offersThisConversation,
  });
  return {
    level: input.level,
    refs,
    atomPatternRecognition: { atomRefs: refs.atomRefs, block },
    offerAllowed: offerAllowed(input),
    dismissedKeys: input.dismissedKeys,
    confirmedKeys: input.confirmedKeys,
    originSurface: input.originSurface,
    memberMessage: input.memberMessage,
    offersThisConversation: input.offersThisConversation,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Reply extraction
// ════════════════════════════════════════════════════════════════════════════

const OFFER_RE = new RegExp(
  `<${PATTERN_OFFER_TAG}\\s+sources\\s*=\\s*["']([^"']*)["']\\s*>([\\s\\S]*?)(?:</${PATTERN_OFFER_TAG}>|$)`,
  'i',
);
const ANY_TAG_RE = new RegExp(`<\\/?${PATTERN_OFFER_TAG}\\b[^>]*>[\\s\\S]*?(?:</${PATTERN_OFFER_TAG}>|$)`, 'gi');
const STRAY_CLOSE_RE = new RegExp(`</${PATTERN_OFFER_TAG}>`, 'gi');

/** Remove every offer line from text the member sees, hears or that is persisted. */
export function stripPatternOfferTags(text: string): string {
  if (!text || !text.toLowerCase().includes(PATTERN_OFFER_TAG)) return text;
  return text.replace(ANY_TAG_RE, '').replace(STRAY_CLOSE_RE, '').replace(/\s+$/, '');
}

export interface PatternOfferExtraction {
  /** The reply with every offer line removed. Always use this, even when offer is null. */
  visibleText: string;
  offer: PatternOffer | null;
  /** Why a tagged offer was refused (for content-free logging). */
  refusedReason?:
    | 'not_allowed'
    | 'too_few_sources'
    | 'unknown_ref'
    | 'gentle_pattern_source'
    | 'dismissed'
    | 'already_confirmed'
    | 'bad_wording';
}

/** The offer line exactly as MAIA wrote it, before any validation. Carried from the
 *  generation choke point (maiaService) to the route, which holds the ref table. */
export interface RawPatternOffer {
  sources: string;
  wording: string;
}

/** Pure: find MAIA's offer line in a raw reply. */
export function parseRawPatternOffer(text: string | null | undefined): RawPatternOffer | null {
  if (!text) return null;
  const m = OFFER_RE.exec(text);
  return m ? { sources: m[1], wording: m[2] } : null;
}

export function extractPatternOffer(text: string, ctx: PatternTurnContext | null): PatternOfferExtraction {
  const raw = text ?? '';
  const visibleText = stripPatternOfferTags(raw);
  const { offer, refusedReason } = validatePatternOffer(parseRawPatternOffer(raw), ctx);
  return refusedReason ? { visibleText, offer, refusedReason } : { visibleText, offer };
}

/** Validate a raw offer against the refs MAIA was actually given this turn and the dial. */
export function validatePatternOffer(
  raw: RawPatternOffer | null | undefined,
  ctx: PatternTurnContext | null,
): Pick<PatternOfferExtraction, 'offer' | 'refusedReason'> {
  if (!raw) return { offer: null };
  if (!ctx || !ctx.offerAllowed) return { offer: null, refusedReason: 'not_allowed' };

  const wording = raw.wording.replace(/\s+/g, ' ').trim();
  if (!wording || wording.length > PATTERN_WORDING_MAX) return { offer: null, refusedReason: 'bad_wording' };

  const refs = Array.from(new Set(raw.sources.split(/[\s,]+/).map((r) => r.trim().toLowerCase()).filter(Boolean)));
  const sources: PatternSourceView[] = [];
  for (const ref of refs) {
    const s = ctx.refs.byRef.get(ref);
    if (!s) return { offer: null, refusedReason: 'unknown_ref' };
    if (ctx.level === 'gentle' && s.kind !== 'atom') return { offer: null, refusedReason: 'gentle_pattern_source' };
    sources.push(s);
  }
  if (sources.length < 2) return { offer: null, refusedReason: 'too_few_sources' };
  if (sources.length > MAX_PATTERN_SOURCES) sources.length = MAX_PATTERN_SOURCES;

  const sourceKey = computeSourceKey(sources);
  if (ctx.dismissedKeys.has(sourceKey)) return { offer: null, refusedReason: 'dismissed' };
  if (ctx.confirmedKeys.has(sourceKey)) return { offer: null, refusedReason: 'already_confirmed' };

  return {
    offer: {
      wording,
      sources,
      sourceKey,
      offeredAt: new Date().toISOString(),
      originSurface: ctx.originSurface,
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Reads
// ════════════════════════════════════════════════════════════════════════════

/** The member's dial. No row → 'full'. Any failure → 'off' (fail closed). */
export async function loadPatternLevel(memberId: string): Promise<PatternLevel> {
  try {
    const r = await query<{ level: string }>(
      'SELECT level FROM member_pattern_preferences WHERE member_id = $1',
      [memberId],
    );
    const level = r.rows[0]?.level;
    if (level === undefined) return DEFAULT_PATTERN_LEVEL;
    return isPatternLevel(level) ? level : 'off';
  } catch (err) {
    console.warn('[patterns] dial read failed — failing closed to off', (err as Error)?.message);
    return 'off';
  }
}

interface PatternRow {
  id: string;
  wording: string;
  worded_by: 'maia' | 'member';
  status: 'confirmed' | 'corrected' | 'archived';
  return_preference: 'member_pulled' | 'contextual_doorway';
  confirmed_at: Date;
  source_key: string;
  sources: Array<{ kind: PatternSourceKind; id: string; label: string | null; at: string | null }> | null;
}

const PATTERN_SELECT = `
  SELECT p.id, p.wording, p.worded_by, p.status, p.return_preference, p.confirmed_at, p.source_key,
         COALESCE(
           json_agg(
             json_build_object(
               'kind', s.source_kind,
               'id', COALESCE(s.atom_id, s.source_pattern_id),
               'label', COALESCE(a.title, sp.wording),
               'at', COALESCE(a.kept_at, sp.confirmed_at)
             ) ORDER BY s.position
           ) FILTER (WHERE s.id IS NOT NULL),
           '[]'::json
         ) AS sources
    FROM member_memory_patterns p
    LEFT JOIN member_memory_pattern_sources s ON s.pattern_id = p.id
    LEFT JOIN member_memory_atoms a ON a.id = s.atom_id
    LEFT JOIN member_memory_patterns sp ON sp.id = s.source_pattern_id
`;

function toPattern(row: PatternRow): ConfirmedPattern {
  return {
    id: row.id,
    wording: row.wording,
    wordedBy: row.worded_by,
    status: row.status,
    returnPreference: row.return_preference,
    confirmedAt: row.confirmed_at,
    sources: (row.sources ?? []).map((s) => ({
      kind: s.kind,
      id: s.id,
      label: s.label ?? '',
      at: s.at ? new Date(s.at).toISOString() : null,
    })),
  };
}

/** Confirmed patterns eligible to return in a prompt (not archived, return allowed). */
export async function loadConfirmedPatternsForPrompt(
  memberId: string,
  limit = MAX_CONFIRMED_PATTERNS_IN_PROMPT,
): Promise<ConfirmedPattern[]> {
  try {
    const r = await query<PatternRow>(
      `${PATTERN_SELECT}
       WHERE p.member_id = $1
         AND p.status IN ('confirmed', 'corrected')
         AND p.return_preference = 'contextual_doorway'
       GROUP BY p.id
       ORDER BY p.confirmed_at DESC
       LIMIT $2`,
      [memberId, limit],
    );
    return r.rows.map(toPattern);
  } catch (err) {
    console.warn('[patterns] confirmed-pattern read failed (non-critical)', (err as Error)?.message);
    return [];
  }
}

/** Every pattern the member holds, for Keep & Capture (archived included). */
export async function listMemberPatterns(memberId: string): Promise<ConfirmedPattern[]> {
  const r = await query<PatternRow>(
    `${PATTERN_SELECT}
     WHERE p.member_id = $1
     GROUP BY p.id
     ORDER BY p.confirmed_at DESC`,
    [memberId],
  );
  return r.rows.map(toPattern);
}

/** Source keys the member dismissed, and keys of patterns they already hold. */
export async function loadPatternKeys(memberId: string): Promise<{ dismissed: Set<string>; confirmed: Set<string> }> {
  try {
    const [d, c] = await Promise.all([
      query<{ source_key: string }>('SELECT source_key FROM member_pattern_dismissals WHERE member_id = $1', [memberId]),
      query<{ source_key: string }>('SELECT source_key FROM member_memory_patterns WHERE member_id = $1', [memberId]),
    ]);
    return {
      dismissed: new Set(d.rows.map((r) => r.source_key)),
      confirmed: new Set(c.rows.map((r) => r.source_key)),
    };
  } catch (err) {
    console.warn('[patterns] key read failed (non-critical)', (err as Error)?.message);
    return { dismissed: new Set(), confirmed: new Set() };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Member acts (writes). Each is the member's own gesture through an authenticated route.
// ════════════════════════════════════════════════════════════════════════════

export class PatternRefusal extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

function normaliseSources(sources: unknown): PatternSourceRef[] {
  if (!Array.isArray(sources)) throw new PatternRefusal('bad_sources', 'sources must be an array');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const out: PatternSourceRef[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    const kind = (s as any)?.kind;
    const id = String((s as any)?.id ?? '').toLowerCase();
    if ((kind !== 'atom' && kind !== 'pattern') || !uuid.test(id)) {
      throw new PatternRefusal('bad_sources', 'each source needs kind atom|pattern and a uuid id');
    }
    const k = `${kind}:${id}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ kind, id });
    }
  }
  if (out.length < 2) throw new PatternRefusal('too_few_sources', 'a pattern rests on at least two sources');
  if (out.length > MAX_PATTERN_SOURCES) throw new PatternRefusal('too_many_sources', 'too many sources');
  return out;
}

/**
 * Re-verify, against the database, that every source is the member's own and
 * eligible: atoms personal-scope, active/still_alive, not sacred_protected;
 * patterns confirmed/corrected. Client material and sealed items fail here.
 */
async function verifySources(
  client: { query: typeof query },
  memberId: string,
  sources: PatternSourceRef[],
): Promise<void> {
  const atomIds = sources.filter((s) => s.kind === 'atom').map((s) => s.id);
  const patternIds = sources.filter((s) => s.kind === 'pattern').map((s) => s.id);
  if (atomIds.length > 0) {
    const r = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM member_memory_atoms
        WHERE member_id = $1 AND id = ANY($2::uuid[])
          AND memory_scope = 'personal'
          AND status IN ('active', 'still_alive')
          AND NOT ('sacred_protected' = ANY(registers))
          AND source_type <> 'practitioner_observation'`,
      [memberId, atomIds],
    );
    if (Number(r.rows[0]?.n ?? 0) !== atomIds.length) {
      throw new PatternRefusal('ineligible_source', 'a source is not one of your kept items that can be drawn on');
    }
  }
  if (patternIds.length > 0) {
    const r = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM member_memory_patterns
        WHERE member_id = $1 AND id = ANY($2::uuid[]) AND status IN ('confirmed', 'corrected')`,
      [memberId, patternIds],
    );
    if (Number(r.rows[0]?.n ?? 0) !== patternIds.length) {
      throw new PatternRefusal('ineligible_source', 'a source is not one of your confirmed patterns');
    }
  }
}

export async function confirmPatternOffer(input: {
  memberId: string;
  wording: string;
  /** Present when the member put it in their own words. */
  correctedWording?: string | null;
  sources: unknown;
  offeredAt?: string | null;
  originSurface: PatternOriginSurface;
}): Promise<ConfirmedPattern> {
  const sources = normaliseSources(input.sources);
  const corrected = typeof input.correctedWording === 'string' && input.correctedWording.trim().length > 0;
  const wording = (corrected ? input.correctedWording! : input.wording ?? '').replace(/\s+/g, ' ').trim();
  if (!wording || wording.length > PATTERN_WORDING_MAX) throw new PatternRefusal('bad_wording', 'wording is empty or too long');
  const sourceKey = computeSourceKey(sources);
  const offeredAt = input.offeredAt && !Number.isNaN(Date.parse(input.offeredAt)) ? input.offeredAt : null;

  const id = await transaction(async (client) => {
    await verifySources(client as any, input.memberId, sources);
    // Confirming clears an earlier dismissal of the same reading: the member's latest act governs.
    await client.query('DELETE FROM member_pattern_dismissals WHERE member_id = $1 AND source_key = $2', [
      input.memberId,
      sourceKey,
    ]);
    const ins = await client.query<{ id: string }>(
      `INSERT INTO member_memory_patterns
         (member_id, wording, worded_by, status, origin_surface, source_key, offered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (member_id, source_key) DO NOTHING
       RETURNING id`,
      [
        input.memberId,
        wording,
        corrected ? 'member' : 'maia',
        corrected ? 'corrected' : 'confirmed',
        input.originSurface,
        sourceKey,
        offeredAt,
      ],
    );
    const pid = ins.rows[0]?.id;
    if (!pid) throw new PatternRefusal('already_kept', 'you already keep a pattern on exactly these sources');
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      await client.query(
        `INSERT INTO member_memory_pattern_sources (pattern_id, source_kind, atom_id, source_pattern_id, position)
         VALUES ($1, $2, $3, $4, $5)`,
        [pid, s.kind, s.kind === 'atom' ? s.id : null, s.kind === 'pattern' ? s.id : null, i],
      );
    }
    return pid;
  });

  const all = await listMemberPatterns(input.memberId);
  const kept = all.find((p) => p.id === id);
  if (!kept) throw new PatternRefusal('not_found', 'pattern not found after keeping');
  return kept;
}

export async function dismissPatternOffer(input: { memberId: string; sources: unknown }): Promise<{ sourceKey: string }> {
  const sources = normaliseSources(input.sources);
  const sourceKey = computeSourceKey(sources);
  await query(
    `INSERT INTO member_pattern_dismissals (member_id, source_key) VALUES ($1, $2)
     ON CONFLICT (member_id, source_key) DO UPDATE SET dismissed_at = NOW()`,
    [input.memberId, sourceKey],
  );
  return { sourceKey };
}

export async function updateMemberPattern(input: {
  memberId: string;
  patternId: string;
  wording?: string;
  status?: 'active' | 'archived';
  returnPreference?: 'member_pulled' | 'contextual_doorway';
}): Promise<ConfirmedPattern | null> {
  const sets: string[] = [];
  const params: unknown[] = [input.memberId, input.patternId];
  if (typeof input.wording === 'string') {
    const w = input.wording.replace(/\s+/g, ' ').trim();
    if (!w || w.length > PATTERN_WORDING_MAX) throw new PatternRefusal('bad_wording', 'wording is empty or too long');
    params.push(w);
    // Editing is the member putting it in their own words.
    sets.push(`wording = $${params.length}`, `worded_by = 'member'`, `status = CASE WHEN status = 'archived' THEN 'archived' ELSE 'corrected' END`);
  }
  if (input.status === 'archived') sets.push(`status = 'archived'`);
  if (input.status === 'active') sets.push(`status = CASE WHEN worded_by = 'member' THEN 'corrected' ELSE 'confirmed' END`);
  if (input.returnPreference === 'member_pulled' || input.returnPreference === 'contextual_doorway') {
    params.push(input.returnPreference);
    sets.push(`return_preference = $${params.length}`);
  }
  if (sets.length === 0) throw new PatternRefusal('nothing_to_change', 'nothing to change');
  sets.push('updated_at = NOW()');
  const r = await query(
    `UPDATE member_memory_patterns SET ${sets.join(', ')} WHERE member_id = $1 AND id = $2 RETURNING id`,
    params,
  );
  if (r.rows.length === 0) return null;
  const all = await listMemberPatterns(input.memberId);
  return all.find((p) => p.id === input.patternId) ?? null;
}

export async function deleteMemberPattern(memberId: string, patternId: string): Promise<boolean> {
  const r = await query('DELETE FROM member_memory_patterns WHERE member_id = $1 AND id = $2 RETURNING id', [
    memberId,
    patternId,
  ]);
  return r.rows.length > 0;
}

export async function setPatternLevel(memberId: string, level: PatternLevel): Promise<PatternLevel> {
  if (!isPatternLevel(level)) throw new PatternRefusal('bad_level', 'level must be full, gentle, on_request or off');
  await query(
    `INSERT INTO member_pattern_preferences (member_id, level) VALUES ($1, $2)
     ON CONFLICT (member_id) DO UPDATE SET level = EXCLUDED.level, updated_at = NOW()`,
    [memberId, level],
  );
  return level;
}

/** Load everything one turn needs, in parallel. Never throws. */
export async function loadPatternTurnInputs(memberId: string): Promise<{
  level: PatternLevel;
  patterns: ConfirmedPattern[];
  dismissedKeys: Set<string>;
  confirmedKeys: Set<string>;
}> {
  const level = await loadPatternLevel(memberId);
  const [patterns, keys] = await Promise.all([
    loadConfirmedPatternsForPrompt(memberId),
    level === 'off' ? Promise.resolve({ dismissed: new Set<string>(), confirmed: new Set<string>() }) : loadPatternKeys(memberId),
  ]);
  return { level, patterns, dismissedKeys: keys.dismissed, confirmedKeys: keys.confirmed };
}
