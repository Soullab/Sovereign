'use client';

/**
 * The two places MAIA describes what she will do before the writer starts with her on a Work. Both tell the truth
 * about the Work's "MAIA asks, never rewrites" setting (review F4, 2026-11-15): while revisions are paused they promise
 * questions and no rewrite, and only otherwise do they offer edits. One module, rendered by both surfaces, so the
 * rendered test (p4r1WorkQuestionsOnly.test.ts) exercises exactly what members see.
 */

export const NOT_YET_QUESTIONS_ONLY =
  'MAIA isn’t sitting with this Work yet. Start a conversation about it and MAIA can talk this passage through with you and ask questions. She won’t rewrite it: every sentence stays yours. You can keep writing here either way.';
export const NOT_YET_EDITS =
  'MAIA isn’t sitting with this Work yet. Start a conversation about it and MAIA can talk this passage through with you and suggest edits. You can keep writing here either way.';
export const PROMISE_QUESTIONS_ONLY =
  'Start with me and I can talk this passage through with you and ask questions. I won’t rewrite it: every sentence stays yours.';
export const PROMISE_EDITS =
  'Start with me and I can talk this passage through and suggest edits. Your writing stays fully yours either way.';

/** Craft's "Begin with MAIA" line. */
export function MaiaNotYetNote({ paused }: { paused: boolean }) {
  return <p data-maia-not-yet>{paused ? NOT_YET_QUESTIONS_ONLY : NOT_YET_EDITS}</p>;
}

/** The "Start with MAIA" relationship card's promise. */
export function MaiaRelationshipPromise({ paused }: { paused: boolean }) {
  return <span data-relationship-promise>{paused ? PROMISE_QUESTIONS_ONLY : PROMISE_EDITS}</span>;
}
