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
 * ⛔ What may be recorded: the stage, and an HTTP status. Both are facts about
 *    the request, not about the Work.
 * ⛔ What may NEVER be recorded: the response body, the caught error or its
 *    message, the manuscript or member identity, a section id, a heading, or
 *    any authored character. A status discriminates 404 from 500; it carries no
 *    word the writer typed.
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
