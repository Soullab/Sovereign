/**
 * "Share this with Soullab" (Studio Academy slice 6). Founder rulings 2026-11-19: "Writer shares each one"; "Approve defaults".
 * Design: docs/programme/STUDIO_ACADEMY_EXPLORATION_2026-11-19.md §5(a) and the defaults ruling.
 *
 * ⛔ BUILT DARK. Server flag WS_SHARE_EXCHANGE_ENABLED === '1', read once on the server and handed down as presentation state; the
 *    route refuses with 404 when it is off. Merge waits for R20 consent review (#1793); the founder's approval is not that review.
 * ⛔ One exchange at a time, only by the writer's own click after seeing exactly what will be shared. Never automatic, never in bulk.
 * ⛔ Readers: the writer and the founder. Never MAIA's context, never training, never adaptation (Invariant 15).
 * ⛔ Never in Sanctuary: only stored turns can be shared, Sanctuary turns are never stored, and the route's keep gate refuses.
 */
export const SHARE_FLAG = 'WS_SHARE_EXCHANGE_ENABLED';
export function shareEnabledFromEnv(env: Record<string, string | undefined>): boolean {
  return env[SHARE_FLAG] === '1';
}

/** Kept for at most this long (shorter than any 12 calendar months, so the database's own 12-month check always holds). */
export const SHARE_RETENTION_DAYS = 365;
const DAY_MS = 86_400_000;

/**
 * When a share made now expires: 365 days, or the end of the beta (WS_BETA_END_DATE) if that is sooner.
 * Null when the beta has already ended: nothing more may be shared.
 */
export function shareExpiresAt(now: Date, betaEnd?: string | null): Date | null {
  const cap = new Date(now.getTime() + SHARE_RETENTION_DAYS * DAY_MS);
  if (!betaEnd) return cap;
  const end = new Date(betaEnd);
  if (Number.isNaN(end.getTime())) return cap;
  if (end.getTime() <= now.getTime()) return null;
  return end.getTime() < cap.getTime() ? end : cap;
}

export const SHARE_LABEL = 'Share with Soullab';
export const SHARE_CONFIRM_LABEL = 'Share this exchange';
export const SHARE_WITHDRAW_LABEL = 'Withdraw';
export const SHARED_MARK = 'Shared with Soullab';

/** What the writer reads before sharing. Plain, and true of the build. */
export const SHARE_EXPLAINER = [
  'Only this question and MAIA’s answer are shared. Nothing else from your Work or conversation.',
  'Only Kelly at Soullab reads it, to learn how the Studio can help writers better. MAIA never sees it.',
  'It is kept encrypted, for 12 months or until the beta ends, whichever comes first, then deleted.',
  'You can withdraw it at any time. Withdrawing deletes it completely.',
] as const;

export const SHARE_REFUSAL_COPY: Record<string, string> = {
  sanctuary_not_kept: 'Sanctuary is on, so nothing is shared.',
  posture_undeclared: 'Your Sanctuary setting couldn’t be read on this device, so nothing was shared.',
  beta_ended: 'The beta has ended, so nothing more can be shared.',
  maia_turn_not_found: 'That answer couldn’t be found, so nothing was shared.',
};
export function shareRefusalCopy(refusal: string): string {
  return SHARE_REFUSAL_COPY[refusal] ?? 'That wasn’t shared. Nothing changed.';
}
