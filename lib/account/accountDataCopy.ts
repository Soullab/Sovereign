/**
 * Account → Your Data: what the two controls honestly say, and what a member is told when one does not complete.
 *
 * Imports nothing, so the component and its tests read the same words (accountDataMessages.test.ts).
 *
 * The descriptions are tied to what the routes do, not to what the feature once aimed at:
 *  - POST /api/members/export-data returns profile, settings, session history, developmental memories and a
 *    Google-connected flag. It does not read a member's Works or writing.
 *  - POST /api/members/delete-account closes the account when it can. When governed content is held it refuses with a
 *    409 (`accountChanged:false`, `retained:[{label,rows}]`) and changes nothing. A foreign key refusing the closure
 *    that the route's list does not name is the same 409 with `retained:[]`: held, rolled back, support, not "try again".
 *    Only a failure the route has not classified is a 500. Permanent erasure is not certified
 *    (releaseAuthority.permanentErasureCertified), so the description must not say "permanently" or "all associated
 *    data" (accountDataHonesty.test.ts ties it to that read).
 */

export const EXPORT_DATA_DESCRIPTION =
  'Download a JSON file with your profile, settings, session history and developmental memories. ' +
  'It does not include your writing or Works.';

export const DELETE_ACCOUNT_DESCRIPTION =
  'Closes your account and revokes your sign-in. This cannot be undone. ' +
  'If anything you have written or saved is still held and cannot be removed yet, nothing is changed and you are told, naming what is held where we know it.';

const NO_CONNECTION = "We couldn't reach the server. Check your connection and try again.";

/** `status` is null when no response arrived at all (a thrown fetch). */
export function exportFailureMessage(status: number | null): string {
  if (status === null) return NO_CONNECTION;
  if (status === 401) return "You're signed out. Sign in again, then download your data.";
  return "We couldn't prepare your export just now. Please try again.";
}

/**
 * The refusal the route designed (409) names what it holds in the member's words; everything else says only what is
 * known. A 500 never claims "nothing was changed": the route rolls back, but this message does not speak for it.
 */
export function deleteFailureMessage(status: number | null, body: unknown): string {
  if (status === null) return NO_CONNECTION;
  if (status === 401) return "You're signed out. Sign in again, then try once more.";
  if (status === 400) return "That doesn't match your username. Type it exactly as shown, then try again.";
  if (status === 409) {
    const refusal = (typeof body === 'object' && body !== null ? body : {}) as { message?: unknown; retained?: unknown };
    const lead = typeof refusal.message === 'string' && refusal.message.trim()
      ? refusal.message.trim()
      : 'Nothing was changed. Please contact support so we can handle your request safely.';
    const labels = Array.isArray(refusal.retained)
      ? [...new Set(
          (refusal.retained as Array<{ label?: unknown }>)
            .map((r) => (typeof r?.label === 'string' ? r.label : ''))
            .filter(Boolean),
        )]
      : [];
    return labels.length ? `${lead} Still held: ${labels.join(', ')}.` : lead;
  }
  return "We couldn't close your account just now. Please try again, or contact support.";
}
