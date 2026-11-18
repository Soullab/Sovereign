/**
 * WS-RELATIONAL-ARCHITECTURE step 4 — an editorial pass that survives closing the page. The writer's click creates a run; the server
 * advances it one lens at a time, and every finished reading is kept on the server.
 *
 * Founder rulings 2026-11-17 (Kelly, in session), superseding the 2026-11-11 "let it run on its own" shape:
 *  - RESUME ON REQUEST ONLY. A pass stops (`stopped`, refusal `no_page_watching`) before its next paid step when no page has asked
 *    about it within WATCH_WINDOW_MS. Opening the page never starts or continues paid work; the writer presses Continue (POST).
 *    Finished lenses are reused, never paid for twice.
 *  - CEILING: 2 full editorial passes per writer per day (RUNS_PER_DAY). A resumed pass is the same pass and does not count again.
 *    The number is the founder's; there is deliberately no environment override.
 *
 * Laws held here:
 *  - One run per manuscript at a time.
 *  - Before EACH reading the server re-checks the writer's whole-Work read permission and their account's Sanctuary default; if either
 *    fails, the run stops (`stopped`) and nothing more is read.
 *  - §20, rereading only what changed (lane authorized 2026-11-17): per lens, every section still covered by a body-depth reading whose
 *    frozen digest equals its current text is reused; only the sections nothing covers are read, in ONE reading scoped to them. A lens
 *    with nothing missing is not read at all. Never paid for twice.
 *  - A refused reading is tried once more; a second refusal fails the run at that lens. A refusal is never counted as done.
 *  - The synthesis is the SAME function the attention-map route calls. The letter is kept through the same store.
 *  - The writer can cancel; a cancelled run reads nothing more.
 */
import { query } from '@/lib/db/postgres';
import { commissionReading } from '@/lib/manuscript/developmentalReading/commission';
import { loadReading } from '@/lib/manuscript/developmentalReading/store';
import { loadActiveGrant } from '@/lib/disclosure/workReadScopeRead';
import { livingWorkIdForManuscript } from '@/lib/manuscript/ask/workOfManuscript';
import { LENS_ORDER } from '@/lib/writersStudio/developPresentation';
import { synthesizeAttentionMap } from '@/lib/writersStudio/studio/synthesizeAttentionMap';
import { EDITORIAL_PASS_REQUEST } from '@/lib/writersStudio/studio/editorialPassRequest';
import { saveLetter } from '@/lib/writersStudio/letter/letterStore';
import { composeOpening, openingFields } from '@/lib/writersStudio/studio/letterOpening';
import { planLens, type LensPlan } from '@/lib/writersStudio/studio/coveringSet';
import type { DevelopmentalLens } from '@/lib/manuscript/developmentalReader/contract';
import { holdsWholeWork } from '@/lib/auth/entitlements';
import { WHOLE_WORK_REFUSAL } from '@/lib/writersStudio/wholeWorkAccess';
import { claimTaste, completeTaste, returnTaste, tasteStanding, type TasteStanding } from '@/lib/writersStudio/proTaste';

export type RunState = 'queued' | 'reading' | 'lens_done' | 'lens_refused' | 'synthesizing' | 'done' | 'failed' | 'stopped' | 'cancelled';
const FINAL: ReadonlySet<RunState> = new Set(['done', 'failed', 'stopped', 'cancelled']);
/** Founder ruling 2026-11-17: 2 full editorial passes per writer per day. */
export const RUNS_PER_DAY = 2;
export const runsPerDay = () => RUNS_PER_DAY;

/* ── is a page watching? (founder ruling 2026-11-17: resume on request only) ──────────────────────────────────────────────────────
   The Letter panel asks about the run every 5 s while it is open. A page that has asked within the window counts as watching; a
   background tab throttled to one check a minute still does. Process-local, like `inFlight` below: the app runs as one server process. */
export const WATCH_WINDOW_MS = 90_000;
const lastSeen = new Map<string, number>();
const runKey = (memberId: string, manuscriptId: string) => `${memberId}:${manuscriptId}`;
export function noteWatching(memberId: string, manuscriptId: string, now: number = Date.now()): void {
  lastSeen.set(runKey(memberId, manuscriptId), now);
}
export function pageWatching(memberId: string, manuscriptId: string, now: number = Date.now()): boolean {
  const t = lastSeen.get(runKey(memberId, manuscriptId));
  return t !== undefined && now - t <= WATCH_WINDOW_MS;
}

export interface RunView {
  id: string;
  draftRevision: number;
  state: RunState;
  done: number;
  total: number;
  lens: string | null;
  refusal: string | null;
  letterId: string | null;
  createdAt: string;
}

/* ── seams (replaceable in tests) ─────────────────────────────────────────────────────────────────────────────────────────────── */
export interface RunDeps {
  q: typeof query;
  commission: typeof commissionReading;
  load: typeof loadReading;
  grant: (memberId: string, manuscriptId: string) => Promise<'work' | 'chapter' | null>;
  sanctuaryDefault: (memberId: string) => Promise<boolean | null>;
  synthesize: typeof synthesizeAttentionMap;
  keepLetter: typeof saveLetter;
  opening: typeof composeOpening;
  /** `writing.wholeWork` (the Free / Pro line). Optional so existing callers keep the default; a test injects its own. */
  wholeWork?: (memberId: string) => Promise<boolean>;
  /** §20: which current sections this lens's readings still cover (by digest), and which must be read. null = no established draft. */
  cover: (memberId: string, manuscriptId: string, lens: DevelopmentalLens) => Promise<LensPlan | null>;
  /** Is a page watching this run? Optional; the default is the process-local watch above. */
  watching?: (memberId: string, manuscriptId: string) => boolean;
  /** The one complimentary whole-book pass for a Free writer (step C2, lib/writersStudio/proTaste.ts). Optional seam. */
  taste?: {
    standing: (memberId: string, manuscriptId: string) => Promise<TasteStanding>;
    claim: (memberId: string, manuscriptId: string) => Promise<boolean>;
    settle: (memberId: string, manuscriptId: string, outcome: 'complete' | 'return') => Promise<void>;
  };
}

const defaultTaste: NonNullable<RunDeps['taste']> = {
  standing: tasteStanding,
  claim: claimTaste,
  settle: (memberId, manuscriptId, outcome) =>
    outcome === 'complete' ? completeTaste(memberId, manuscriptId) : returnTaste(memberId, manuscriptId),
};
export const defaultDeps: RunDeps = {
  q: query,
  commission: commissionReading,
  load: loadReading,
  grant: async (memberId, manuscriptId) => {
    const workId = await livingWorkIdForManuscript(manuscriptId, memberId);
    if (!workId) return null;
    return (await loadActiveGrant(memberId, workId))?.level ?? null;
  },
  sanctuaryDefault: async (memberId) => {
    try {
      const r = await query<{ mode: string | null }>(`SELECT default_memory_mode AS mode FROM member_settings WHERE member_id = $1`, [memberId]);
      return r.rows[0]?.mode === 'sanctuary';
    } catch { return null; }
  },
  synthesize: synthesizeAttentionMap,
  keepLetter: saveLetter,
  opening: composeOpening,
  cover: async (memberId, manuscriptId, lens) => {
    const live = (await query<{ id: string; text: string; draft_id: string }>(
      `SELECT s.id, s.text, s.draft_id FROM manuscript_draft_sections s JOIN manuscript_working_drafts d ON d.id = s.draft_id
        WHERE d.manuscript_id = $1 AND d.member_id = $2 ORDER BY s.position ASC`, [manuscriptId, memberId])).rows;
    const draftId = live[0]?.draft_id;
    if (!draftId) return null;
    const rows = (await query<{ id: string; frozen_at: Date; draft_id: string; digests: Record<string, string> | null; depths: Record<string, string> | null }>(
      `SELECT id, frozen_at, draft_id,
              (SELECT jsonb_object_agg(k, v->>'digest') FROM jsonb_each(read_state->'sections') AS e(k, v)) AS digests,
              coverage->'sections' AS depths
         FROM developmental_readings
        WHERE manuscript_id = $1 AND member_id = $2 AND commissioned_lens = $3 AND draft_id = $4`,
      [manuscriptId, memberId, lens, draftId])).rows;
    return planLens(draftId, live, rows.map((r) => ({
      id: r.id, lens, draftId: r.draft_id, frozenAt: r.frozen_at.toISOString(), digests: r.digests ?? {}, depths: r.depths ?? {},
    })));
  },
};

/* ── reading the run ───────────────────────────────────────────────────────────────────────────────────────────────────────────── */
export async function viewRun(memberId: string, manuscriptId: string, deps: RunDeps = defaultDeps): Promise<RunView | null> {
  const run = (await deps.q<{ id: string; draft_revision: number; created_at: Date }>(
    `SELECT id, draft_revision, created_at FROM editorial_pass_runs WHERE member_id = $1 AND manuscript_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [memberId, manuscriptId])).rows[0];
  if (!run) return null;
  const events = (await deps.q<{ state: RunState; lens: string | null; refusal: string | null; letter_id: string | null }>(
    `SELECT state, lens, refusal, letter_id FROM editorial_pass_run_events WHERE run_id = $1 ORDER BY id ASC`, [run.id])).rows;
  const last = events[events.length - 1];
  const doneLenses = new Set(events.filter((e) => e.state === 'lens_done').map((e) => e.lens));
  return {
    id: run.id, draftRevision: Number(run.draft_revision), state: last?.state ?? 'queued',
    done: doneLenses.size, total: LENS_ORDER.length, lens: last?.lens ?? null, refusal: last?.refusal ?? null,
    letterId: events.find((e) => e.letter_id)?.letter_id ?? null, createdAt: run.created_at.toISOString(),
  };
}

const record = (deps: RunDeps, runId: string, state: RunState, extra: { lens?: string; readingId?: string; refusal?: string; letterId?: string } = {}) =>
  deps.q(`INSERT INTO editorial_pass_run_events (run_id, state, lens, reading_id, refusal, letter_id) VALUES ($1, $2, $3, $4, $5, $6)`,
    [runId, state, extra.lens ?? null, extra.readingId ?? null, extra.refusal?.slice(0, 200) ?? null, extra.letterId ?? null]);

/* ── starting ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
export type StartOutcome =
  | { ok: true; runId: string; resumed: boolean }
  | { ok: false; refusal: 'not_permitted' | 'sanctuary' | 'draft_not_established' | 'daily_limit' | typeof WHOLE_WORK_REFUSAL };

/** Create a run, or resume the newest unfinished one for the same draft. Never two active runs on one manuscript. */
export async function startRun(memberId: string, manuscriptId: string, deps: RunDeps = defaultDeps): Promise<StartOutcome> {
  /* Free / Pro line first: nothing is started, and no reading is paid for, when the membership does not include the pass. A failed
     lookup throws (the route answers 500), never reads as "not Pro". The synthesis re-checks before its model call. */
  const pro = await (deps.wholeWork ?? holdsWholeWork)(memberId);
  /* A Free writer may run ONE complimentary pass (founder ruling 2026-11-13). Checked here, CLAIMED only once every other
     check has passed (claimTasteIfFree below), so a refusal for another reason never spends it. */
  const taste = deps.taste ?? defaultTaste;
  const standing: TasteStanding = pro ? 'none' : await taste.standing(memberId, manuscriptId);
  if (!pro && standing === 'none') return { ok: false, refusal: WHOLE_WORK_REFUSAL };
  const claimTasteIfFree = async () => pro || standing === 'claimed_here' || taste.claim(memberId, manuscriptId);
  if ((await deps.grant(memberId, manuscriptId)) !== 'work') return { ok: false, refusal: 'not_permitted' };
  if ((await deps.sanctuaryDefault(memberId)) !== false) return { ok: false, refusal: 'sanctuary' };
  const draft = (await deps.q<{ id: string; rev: number | null; sections: string[] | null }>(
    `SELECT d.id,
            (SELECT max(r.revision_number) FROM working_draft_revisions r WHERE r.draft_id = d.id) AS rev,
            (SELECT array_agg(s.id ORDER BY s.position) FROM manuscript_draft_sections s WHERE s.draft_id = d.id) AS sections
       FROM manuscript_working_drafts d
      WHERE d.manuscript_id = $1 AND d.member_id = $2 AND d.section_addressable_at IS NOT NULL`,
    [manuscriptId, memberId])).rows[0];
  if (!draft || draft.rev === null || !draft.sections?.length) return { ok: false, refusal: 'draft_not_established' };
  const current = await viewRun(memberId, manuscriptId, deps);
  if (current && !FINAL.has(current.state) && current.draftRevision === Number(draft.rev)) {
    if (!(await claimTasteIfFree())) return { ok: false, refusal: WHOLE_WORK_REFUSAL };
    return { ok: true, runId: current.id, resumed: true };
  }
  if (current && (current.state === 'failed' || current.state === 'stopped') && current.draftRevision === Number(draft.rev)) {
    if (!(await claimTasteIfFree())) return { ok: false, refusal: WHOLE_WORK_REFUSAL };
    await record(deps, current.id, 'queued');
    return { ok: true, runId: current.id, resumed: true };
  }
  const today = (await deps.q<{ n: string }>(
    `SELECT count(*)::text AS n FROM editorial_pass_runs WHERE member_id = $1 AND created_at > NOW() - INTERVAL '1 day'`, [memberId])).rows[0];
  if (Number(today?.n ?? 0) >= runsPerDay()) return { ok: false, refusal: 'daily_limit' };
  if (!(await claimTasteIfFree())) return { ok: false, refusal: WHOLE_WORK_REFUSAL };
  const run = (await deps.q<{ id: string }>(
    `INSERT INTO editorial_pass_runs (member_id, manuscript_id, draft_revision) VALUES ($1, $2, $3) RETURNING id`,
    [memberId, manuscriptId, Number(draft.rev)])).rows[0]!;
  await record(deps, run.id, 'queued');
  return { ok: true, runId: run.id, resumed: false };
}

export async function cancelRun(memberId: string, manuscriptId: string, deps: RunDeps = defaultDeps): Promise<boolean> {
  const current = await viewRun(memberId, manuscriptId, deps);
  if (!current || FINAL.has(current.state)) return false;
  await record(deps, current.id, 'cancelled');
  await (deps.taste ?? defaultTaste).settle(memberId, manuscriptId, 'return').catch(() => undefined);
  return true;
}

/* ── advancing (server-side, while a page is watching) ─────────────────────────────────────────────────────────────────────────── */
const inFlight = new Set<string>();
export const isAdvancing = (memberId: string, manuscriptId: string) => inFlight.has(runKey(memberId, manuscriptId));

/**
 * An unfinished run that nothing in this process is advancing (a server restart, or a step that ended without recording) is stopped
 * honestly as `interrupted`, so the page offers Continue instead of showing "reading" forever. Reads nothing; pays for nothing.
 */
export async function settleStranded(memberId: string, manuscriptId: string, deps: RunDeps = defaultDeps): Promise<RunView | null> {
  const run = await viewRun(memberId, manuscriptId, deps);
  if (!run || FINAL.has(run.state) || isAdvancing(memberId, manuscriptId)) return run;
  await record(deps, run.id, 'stopped', { refusal: 'interrupted' });
  await (deps.taste ?? defaultTaste).settle(memberId, manuscriptId, 'return').catch(() => undefined);
  return viewRun(memberId, manuscriptId, deps);
}

/** Advance a run to its end. Safe to call again: a run already advancing in this process is not doubled. */
export async function advanceRun(memberId: string, manuscriptId: string, deps: RunDeps = defaultDeps): Promise<RunView | null> {
  const view = await advanceRunInner(memberId, manuscriptId, deps);
  /* Settle a complimentary pass (founder ruling 2026-11-13): spent when the letter is kept; given back when the pass ends
     without one. Both are no-ops unless that member's taste is claimed for this manuscript and still open. */
  if (view?.state === 'done') await (deps.taste ?? defaultTaste).settle(memberId, manuscriptId, 'complete').catch(() => undefined);
  else if (view && (view.state === 'failed' || view.state === 'stopped' || view.state === 'cancelled')) {
    await (deps.taste ?? defaultTaste).settle(memberId, manuscriptId, 'return').catch(() => undefined);
  }
  return view;
}

async function advanceRunInner(memberId: string, manuscriptId: string, deps: RunDeps): Promise<RunView | null> {
  const key = runKey(memberId, manuscriptId);
  const watching = () => (deps.watching ?? pageWatching)(memberId, manuscriptId);
  if (inFlight.has(key)) return viewRun(memberId, manuscriptId, deps);
  inFlight.add(key);
  try {
    let run = await viewRun(memberId, manuscriptId, deps);
    if (!run || FINAL.has(run.state)) return run;
    const draft = (await deps.q<{ sections: string[] | null; rev: number | null }>(
      `SELECT (SELECT array_agg(s.id ORDER BY s.position) FROM manuscript_draft_sections s WHERE s.draft_id = d.id) AS sections,
              (SELECT max(r.revision_number) FROM working_draft_revisions r WHERE r.draft_id = d.id) AS rev
         FROM manuscript_working_drafts d WHERE d.manuscript_id = $1 AND d.member_id = $2`,
      [manuscriptId, memberId])).rows[0];
    if (!draft?.sections?.length || Number(draft.rev) !== run.draftRevision) {
      await record(deps, run.id, 'stopped', { refusal: 'draft_changed' });
      return viewRun(memberId, manuscriptId, deps);
    }
    const withStructure = Number((await deps.q<{ n: string }>(
      `SELECT count(*)::text AS n FROM manuscript_structure_units WHERE manuscript_id = $1`, [manuscriptId])).rows[0]?.n ?? 0) > 0;

    const readingIds = new Map<DevelopmentalLens, string[]>();
    for (const lens of LENS_ORDER) {
      run = await viewRun(memberId, manuscriptId, deps);
      if (!run || run.state === 'cancelled') return run;
      /* re-check permission and Sanctuary before every reading */
      if ((await deps.grant(memberId, manuscriptId)) !== 'work') { await record(deps, run.id, 'stopped', { lens, refusal: 'permission_withdrawn' }); return viewRun(memberId, manuscriptId, deps); }
      if ((await deps.sanctuaryDefault(memberId)) !== false) { await record(deps, run.id, 'stopped', { lens, refusal: 'sanctuary' }); return viewRun(memberId, manuscriptId, deps); }

      /* §20: what this lens has already read of the current text is reused; only what nothing covers is read */
      const before = await deps.cover(memberId, manuscriptId, lens);
      if (!before) { await record(deps, run.id, 'stopped', { lens, refusal: 'draft_changed' }); return viewRun(memberId, manuscriptId, deps); }
      if (before.missing.length === 0) {
        readingIds.set(lens, before.contributing);
        await record(deps, run.id, 'lens_done', { lens, readingId: before.contributing[0] });
        continue;
      }
      /* resume on request only: no paid reading starts unless a page is watching */
      if (!watching()) { await record(deps, run.id, 'stopped', { lens, refusal: 'no_page_watching' }); return viewRun(memberId, manuscriptId, deps); }

      let made: string | null = null;
      let lastRefusal = '';
      for (let attempt = 0; attempt < 2 && !made; attempt += 1) {
        await record(deps, run.id, 'reading', { lens });
        const out = await deps.commission({ manuscriptId, memberId, lens, bodyScope: before.missing, withStructure });
        if (out.outcome === 'frozen') made = out.reading.id;
        else { lastRefusal = `${out.stage}:${out.refusal}`; await record(deps, run.id, 'lens_refused', { lens, refusal: lastRefusal }); }
      }
      if (!made) { await record(deps, run.id, 'failed', { lens, refusal: lastRefusal }); return viewRun(memberId, manuscriptId, deps); }
      const after = await deps.cover(memberId, manuscriptId, lens);
      if (!after || after.missing.length > 0) { await record(deps, run.id, 'failed', { lens, refusal: 'section_not_covered' }); return viewRun(memberId, manuscriptId, deps); }
      readingIds.set(lens, after.contributing);
      await record(deps, run.id, 'lens_done', { lens, readingId: made });
    }

    if (!watching()) { await record(deps, run!.id, 'stopped', { refusal: 'no_page_watching' }); return viewRun(memberId, manuscriptId, deps); }
    await record(deps, run!.id, 'synthesizing');
    const deep = LENS_ORDER.filter((l) => l !== 'overview').flatMap((l) => readingIds.get(l)!);
    const synthesis = await deps.synthesize(memberId, manuscriptId, deep, EDITORIAL_PASS_REQUEST);
    if (!synthesis.ok) { await record(deps, run!.id, 'failed', { refusal: `synthesis:${synthesis.error}` }); return viewRun(memberId, manuscriptId, deps); }
    if ((await deps.sanctuaryDefault(memberId)) !== false) { await record(deps, run!.id, 'stopped', { refusal: 'sanctuary' }); return viewRun(memberId, manuscriptId, deps); }
    const opening = await deps.opening(memberId, manuscriptId, synthesis.readingIds, synthesis.observationKeys);
    const letterId = await deps.keepLetter(memberId, manuscriptId, synthesis.revisionNumber, { ...synthesis.map, ...openingFields(opening) });
    await record(deps, run!.id, 'done', { letterId });
    return viewRun(memberId, manuscriptId, deps);
  } finally {
    inFlight.delete(key);
  }
}
