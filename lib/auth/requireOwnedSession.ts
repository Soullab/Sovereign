import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';

/**
 * A practitioner session (practice_sessions / supervision_sessions) is reachable only by the
 * practitioner who owns it.
 *
 * PRACTITIONER-SESSION-OWNERSHIP-01. These routes used to address a session by its id alone: an
 * authenticated practitioner (or, for most of them, nobody at all) could read the PHI transcript of,
 * write into, stop or DELETE any session by naming its id. PRACTITIONER-API-IDENTITY-01 made the
 * ACTING identity the session; this makes the RESOURCE ownership the session's too.
 *
 *   const actor = await requireSessionMember(request);
 *   if ('error' in actor) return actor.error;
 *   const owned = await requireOwnedSession(actor.memberId, sessionId);
 *   if ('error' in owned) return owned.error;
 *
 * THE RULE (founder-delegated 2026-11-17, FAIL CLOSED, RECOVERABLE):
 *   · the owner column is compared to the SESSION member inside ONE SQL statement; it is never a
 *     value the caller chose, and there is no read-then-compare step to race or to get wrong;
 *   · a session that is not the member's, a legacy session whose owner is NULL (`NULL = $2` is never
 *     true) and an id that does not exist ALL give the same 404 with the same body — there is no
 *     existence oracle, and no "forbidden";
 *   · an id that is not a UUID reads as absent without reaching SQL (it would be a type error, i.e. a
 *     500 that tells a different story from the 404);
 *   · a database error is NOT an allow: it propagates and the route answers 500.
 *
 * Legacy sessions with no owner are therefore unreachable through these routes. Recovery is a
 * founder-run, audited step that is NOT built here (see
 * scripts/ops/census-unowned-practitioner-sessions.mjs for the read-only census). There is
 * deliberately NO "claim" endpoint: a claim flow would let anyone claim someone else's legacy session.
 *
 * Ownership of a row never changes (no route writes practitioner_id after creation), so a route may
 * check here and then act on the id; the one destructive act, DELETE, also carries the owner in its
 * own statement.
 */

export type OwnedSession = { id: string; source: 'practice' | 'supervision' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One statement, both tables, the owner in BOTH predicates. `practice_sessions.practitioner_id` and
 * `supervision_sessions.practitioner_id` are nullable UUIDs; no OR, no IS NULL, no COALESCE may ever
 * be added here (a test pins the source).
 */
const OWNED_SESSION_SQL =
  "SELECT id, 'practice' AS source FROM practice_sessions WHERE id = $1 AND practitioner_id = $2 " +
  "UNION ALL SELECT id, 'supervision' AS source FROM supervision_sessions WHERE id = $1 AND practitioner_id = $2 LIMIT 1";

/** The session, iff `memberId` owns it. Otherwise null — for every reason, indistinguishably. */
export async function findOwnedSession(sessionId: unknown, memberId: unknown): Promise<OwnedSession | null> {
  if (typeof sessionId !== 'string' || !UUID.test(sessionId)) return null;
  if (typeof memberId !== 'string' || !UUID.test(memberId)) return null;
  const result = await query<{ id: string; source: 'practice' | 'supervision' }>(OWNED_SESSION_SQL, [sessionId, memberId]);
  const row = result.rows[0];
  return row ? { id: row.id, source: row.source } : null;
}

/** The one refusal. Same status, same body, for every reason a session is not reachable. */
export function sessionNotFound(): NextResponse {
  return NextResponse.json(
    { success: false, error: 'Session not found' },
    { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function requireOwnedSession(
  memberId: string,
  sessionId: unknown,
): Promise<{ session: OwnedSession } | { error: NextResponse }> {
  const session = await findOwnedSession(sessionId, memberId);
  return session ? { session } : { error: sessionNotFound() };
}
