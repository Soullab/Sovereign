import { NextRequest, NextResponse } from 'next/server';
import { getMemberIdFromRequest } from './getMemberFromRequest';

/**
 * The acting identity of a request is the SESSION, and nothing else.
 *
 * PRACTITIONER-API-IDENTITY-01. The caseload, practice and practitioners APIs used to take
 * "who is acting" from `?memberId=` / `?practitionerId=` or the JSON body, then scope every
 * read and write to that value. A caller could therefore name any member's id and the store
 * would answer as them: the ownership predicate (`practitioner_id = $2`) was only as strong as
 * a value the caller chose.
 *
 * `getMemberIdFromRequest` resolves the verified session (cookie and/or `x-session-token`, all
 * presented credentials valid and agreeing, any `x-member-id` claim matching). This wrapper adds
 * the one thing every handler then needs: a uniform 401 when there is no session.
 *
 *   const actor = await requireSessionMember(request);
 *   if ('error' in actor) return actor.error;
 *   const { memberId } = actor;
 *
 * ⛔ There is NO fallback to a caller-supplied id, ever. A client id that remains on the wire
 * (a case id, a practitioner row id) is a RESOURCE id: it must be checked against rows the
 * session member owns, and a row that is not theirs is indistinguishable from a row that does
 * not exist.
 *
 * The 401 body carries both `error` and `success: false` so it satisfies the two response
 * shapes these families already use.
 */
export async function requireSessionMember(
  request: NextRequest,
): Promise<{ memberId: string } | { error: NextResponse }> {
  const memberId = await getMemberIdFromRequest(request);
  if (!memberId) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
      ),
    };
  }
  return { memberId };
}
