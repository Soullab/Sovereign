/**
 * WRITER'S STUDIO REBUILD — why the room could not open, recorded without
 * disclosing anything the member wrote.
 *
 * `RebuildStudioClient`'s `load()` has five distinct ways to fail and one
 * sentence for all of them. The sentence is correct: the honest floor is that
 * we do not know where it was lost, and saying so beats naming a stage we did
 * not observe. But the member's copy being right is not a reason for the
 * SYSTEM to observe nothing — a refusal is not an occasion to disclose, and it
 * is also not an occasion to forget.
 *
 * So the stage is carried on the thrown failure and classified here before it
 * reaches a log. The classifier is FAIL-CLOSED by construction: an unrecognised
 * stage is `UNKNOWN`, never the value it carried. A path, a heading, a prose
 * fragment or a forged stage string therefore cannot ride a load failure into
 * an operator log, which is the same discipline `vaultErasureErrnoR105` holds
 * for source-custody deletion (`lib/manuscript/source/vaultErasureSafeLogR105`).
 *
 * ⛔ What this module may put on the record: the stage, and an HTTP status.
 *    Both are facts about the request, not about the Work.
 * ⛔ What it may NEVER put there: the response body, the caught error or its
 *    message, the manuscript or section identity, a heading, or any authored
 *    character. A status discriminates 404 from 500; it carries no word the
 *    writer typed.
 * ⚠️ What the RECEIVER adds, and this module does not control: the client
 *    telemetry route attaches `member_id` from the session cookie to every
 *    event it logs, as it does for voice and onboarding. So the server record
 *    says WHOSE load failed — which is what makes a report correlatable — and
 *    the claim here is the narrower, true one: nothing the member WROTE is on
 *    it. ⛔ Do not read this module's law as a promise about the receiver.
 */

/** The stages of `load()` that can fail. A closed vocabulary — adding a throw
 *  site to the room means adding its stage here, deliberately. */
export const REBUILD_LOAD_STAGES = [
  /** The manuscripts list, read only when the address carries no `?m=`. */
  'manuscript-list',
  /** No manuscript identity resolved — the address named none and the list
   *  did not settle on one. Client-side: there is no status to carry. */
  'manuscript-identity',
  /** The context read-model, first call. */
  'context',
  /** `beginDraft` on a fresh import that arrived with Source sections and no
   *  working draft. This stage WRITES; the others only read. */
  'begin-draft',
  /** The context read-model, re-read after a draft was begun. Distinct from
   *  `context` on purpose: the same status means a different thing once a
   *  write has happened on the path. */
  'context-after-begin',
] as const;

export type RebuildLoadStage = (typeof REBUILD_LOAD_STAGES)[number];

/** A load failure that names its stage. The message stays generic: it is the
 *  stage, never the cause, and nothing read from a response is placed on it. */
export class RebuildLoadFailure extends Error {
  readonly stage: RebuildLoadStage;
  /** HTTP status, where the stage made a request. `0` where it did not. */
  readonly status: number;

  constructor(stage: RebuildLoadStage, status?: number) {
    super(`rebuild load failed at ${stage}`);
    this.name = 'RebuildLoadFailure';
    this.stage = stage;
    this.status = safeRebuildLoadStatus(status);
  }
}

/**
 * The stage of a caught failure, or `UNKNOWN`.
 *
 * Fail-closed: only a `RebuildLoadFailure` carrying a stage from the closed
 * vocabulary is credited. An arbitrary `Error`, a string, a thrown object
 * shaped to look like one, `null` and `undefined` all return `UNKNOWN` — the
 * value they carried is never returned, so nothing authored can pass through.
 */
export function rebuildLoadStage(failure: unknown): RebuildLoadStage | 'UNKNOWN' {
  if (!(failure instanceof RebuildLoadFailure)) return 'UNKNOWN';
  const stage = failure.stage as unknown;
  return typeof stage === 'string' && (REBUILD_LOAD_STAGES as readonly string[]).includes(stage)
    ? (stage as RebuildLoadStage)
    : 'UNKNOWN';
}

/**
 * The HTTP status of a caught failure, or `0`.
 *
 * `0` means "no status to report" and is NOT a status. Only an integer in the
 * HTTP range is admitted, so a float, a numeric string, an out-of-range value
 * or a crafted number cannot become a log field that looks like evidence.
 */
export function rebuildLoadStatus(failure: unknown): number {
  if (!(failure instanceof RebuildLoadFailure)) return 0;
  return safeRebuildLoadStatus(failure.status);
}

function safeRebuildLoadStatus(status: unknown): number {
  return typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : 0;
}

/**
 * Record a load failure where an operator can actually read it.
 *
 * A `console.error` in a `'use client'` component reaches the MEMBER's devtools
 * and nothing else: in production no operator can see it, and asking the member
 * to open devtools and read it back is the repro burden the voice-diagnostic
 * surface was built to end. So this mirrors `lib/voice/voiceDiagnostics.ts` —
 * browser console for whoever is holding it (a local preview is the case that
 * started this), AND a fire-and-forget POST to `/api/telemetry/client`, which
 * logs server-side and is therefore visible in `docker logs maia-sovereign`.
 *
 * The route holds a STRICT event allowlist, so `ws_rebuild_load_failed` is
 * admitted there by name; an unlisted event is dropped rather than logged.
 *
 * ⛔ Never throws and never awaits: a diagnostic that can fail the thing it is
 *    diagnosing is worse than no diagnostic. `path` is the PATHNAME only —
 *    the rebuild address carries the manuscript and section ids in its QUERY
 *    string, and the query must not travel.
 */
export function reportRebuildLoadFailure(failure: unknown): void {
  const stage = rebuildLoadStage(failure);
  const status = rebuildLoadStatus(failure);

  try {
    // eslint-disable-next-line no-console
    console.error('[MAIA/writers-studio] rebuild load failed', { stage, status });
  } catch {
    // a console that throws is not a reason to lose the server record
  }

  try {
    if (typeof fetch !== 'function') return;
    void fetch('/api/telemetry/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'ws_rebuild_load_failed',
        path: typeof window !== 'undefined' ? window.location.pathname : null,
        metadata: { stage, status },
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never block the room's refusal on telemetry
  }
}
