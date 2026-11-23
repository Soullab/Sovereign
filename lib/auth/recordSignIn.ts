import { query } from '@/lib/db/postgres';

/**
 * Record a successful sign-in on the member row.
 *
 * Call only AFTER the verified session and cookies have been issued. This is
 * optional metadata, not authentication authority: it never throws, so a
 * committed session is never reported as a failed sign-in because this
 * timestamp could not be written.
 */
export async function recordSignIn(memberId: string, source: string): Promise<void> {
  try {
    await query(`UPDATE members SET last_sign_in = NOW() WHERE id = $1`, [memberId]);
  } catch {
    console.warn(`[${source}] Last-sign-in timestamp unavailable after session issuance`);
  }
}
