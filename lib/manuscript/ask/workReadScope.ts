/**
 * WS-WORK-CONTINUITY · Part B — the standing, revocable Work reading scope (PURE half).
 *
 * Founder ruling 2026-11-08: a member-declared, revocable, Work-level standing read
 * scope may stand in for per-Ask single-use authorization for reads inside the Work
 * conversation, with every crossing still receipted. The store and the route live
 * elsewhere; this file is the decision, with no I/O so that it can be tested.
 *
 * ⛔ Nothing here is inferred. There is no default grant, no grant implied by an
 * earlier "Read this chapter", and no scope that survives a revoke.
 * ⛔ This is NOT Editorial Reading coverage. A conversational read never discharges
 * `DEVELOPMENTAL_NON_CONCLUSIONS` and licenses no whole-work claim (law T11).
 */
import { createHash } from 'crypto';

export type ScopeLevel = 'chapter' | 'work';

export interface ScopeEventRow {
  readonly id: string;
  readonly event: 'grant' | 'revoke';
  readonly level: ScopeLevel | null;
  readonly createdAt: string;
}

export interface ActiveGrant { readonly id: string; readonly level: ScopeLevel }

/** Latest event wins. State is DERIVED from events, never stored. Events must be in append order. */
export function activeGrant(events: readonly ScopeEventRow[]): ActiveGrant | null {
  let cur: ActiveGrant | null = null;
  for (const e of events) {
    cur = e.event === 'grant' && e.level ? { id: e.id, level: e.level } : null;
  }
  return cur;
}

export interface SectionHeadLite { readonly id: string; readonly position: number; readonly heading: string | null }

/** Host-side ceiling on how much saved text one answer may carry. */
export const READ_CHAR_BUDGET = 60_000;
/** Host-side ceiling on sections (and so receipts) per Ask. */
export const MAX_READ_SECTIONS = 40;

const WHOLE_WORK = /\b(whole|entire|full)\s+(book|manuscript|work|draft)\b|\bthroughout\b|\bacross\s+(the\s+)?(book|manuscript|work|chapters)\b|\boverall\b|\bfrom the (start|beginning)\b/i;

/** PURE: does the question's wording speak of the whole Work? Wording never selects saved text (WS-STEP4 A2); it may only
 *  inform what is carried or offered elsewhere (`chaptersInPlay`, the client's "Ask about the whole book?" offer). */
export const asksWholeWork = (question: string): boolean => WHOLE_WORK.test(question);

/** PURE: section ids whose heading the question names, whole-word (a short heading such as "Air" never matches "fair"). */
export function sectionsNamedIn(question: string, sections: readonly SectionHeadLite[]): string[] {
  const q = question.toLowerCase();
  const out: string[] = [];
  for (const s of sections) {
    const h = s.heading?.trim().toLowerCase();
    if (h && h.length >= 3 && new RegExp(`(^|[^\\p{L}\\p{N}])${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u').test(q)) out.push(s.id);
  }
  return out;
}

/** What the writer DECLARED the question is about ("About:" in the conversation). */
export type DeclaredScope = 'here' | 'whole_book';

export interface Selection {
  readonly ids: readonly string[];
  /** Section ids that were in scope for the question but were not supplied: over the saved-section budget, including any
   *  single section larger than the whole budget (WS-STEP4 A4). Disclosed, never silently dropped. */
  readonly overBudget: readonly string[];
}

/**
 * ⭐ HOST-SELECTED, SERVER-DERIVED. The client supplies the locus id (checked against the member's own section list) and the
 * writer's declared scope, which names no section. ⛔ Nothing the browser says names a section that is not already in `sections`,
 * and the declared scope never widens the server-held grant.
 *
 * WS-STEP4 A (founder decisions A2–A4, 2026-11-20; A1 law-owner confirmation pending):
 *   chapter grant              → the locus only, whatever the declared scope.
 *   work grant, 'here'         → the locus only. Wording ("the whole book") and named chapters never widen it; the client offers
 *                                the switch instead (A2, A3).
 *   work grant, 'whole_book'   → the locus, then chapters the question names (priority, S2), then every section in order.
 * Bounded by READ_CHAR_BUDGET, which covers SAVED sections only; the current passage also reaches MAIA by its own path (S1).
 * A section larger than the budget on its own is never admitted (A4).
 */
export function selectSections(input: {
  level: ScopeLevel;
  scope: DeclaredScope;
  question: string;
  locusId: string | null;
  sections: readonly SectionHeadLite[];
  sizes: ReadonlyMap<string, number>;
}): Selection {
  const { level, scope, question, locusId, sections, sizes } = input;
  const known = new Set(sections.map((s) => s.id));
  const ordered: string[] = [];
  const add = (id: string) => { if (known.has(id) && !ordered.includes(id)) ordered.push(id); };

  if (locusId) add(locusId);
  if (level === 'work' && scope === 'whole_book') {
    for (const id of sectionsNamedIn(question, sections)) add(id);
    for (const s of sections) add(s.id);
  }

  const ids: string[] = [];
  const overBudget: string[] = [];
  let used = 0;
  for (const id of ordered) {
    const size = sizes.get(id) ?? 0;
    if (size > READ_CHAR_BUDGET || used + size > READ_CHAR_BUDGET) { overBudget.push(id); continue; }
    used += size;
    ids.push(id);
  }
  return { ids, overBudget };
}

export const digestOf = (body: string): string => createHash('sha256').update(body).digest('hex');

/** Sections MAIA quoted/read on an earlier turn whose saved text differs now. */
export function movedSince(
  earlier: ReadonlyMap<string, string>,
  now: ReadonlyMap<string, string>,
): string[] {
  const moved: string[] = [];
  for (const [id, digest] of earlier) {
    const cur = now.get(id);
    if (cur !== undefined && cur !== digest) moved.push(id);
  }
  return moved;
}
