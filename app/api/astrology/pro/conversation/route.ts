/**
 * Kept Pro Ask-MAIA conversation (ASTRO-PRO-KEEP Phase 1).
 *
 * GET   ?subjectKey=  -> the caller's latest kept thread for that subject, or { threadId: null }
 * PATCH { threadId, keep } -> turn Keep on/off; off deletes the thread's stored turns
 *
 * The owner is the verified session member; every query filters by it.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PRO_RESPONSE_HEADERS, proError, resolveProOwner } from '@/lib/astrology/proRouteAccess';
import { PRO_SUBJECT_KEY_MAX, findLatestThread, isThreadId, listTurns, setKeep } from '@/lib/astrology/proConversationStore';

export async function GET(request: NextRequest) {
  const owner = await resolveProOwner(request, false);
  if (!owner.ok) return owner.response;
  const subjectKey = request.nextUrl.searchParams.get('subjectKey') ?? '';
  if (!subjectKey || subjectKey.length > PRO_SUBJECT_KEY_MAX) return proError(400, 'subject_key_invalid');
  try {
    const thread = await findLatestThread(owner.memberId, subjectKey);
    if (!thread) return NextResponse.json({ threadId: null }, { headers: PRO_RESPONSE_HEADERS });
    const turns = await listTurns(thread.id, owner.memberId);
    return NextResponse.json({ threadId: thread.id, keep: thread.keep, turns }, { headers: PRO_RESPONSE_HEADERS });
  } catch {
    return proError(503, 'conversation_unavailable');
  }
}

export async function PATCH(request: NextRequest) {
  const owner = await resolveProOwner(request, true);
  if (!owner.ok) return owner.response;
  let body: { threadId?: unknown; keep?: unknown };
  try {
    body = await request.json();
  } catch {
    return proError(400, 'invalid_request');
  }
  if (!body || typeof body !== 'object' || !isThreadId(body.threadId) || typeof body.keep !== 'boolean') {
    return proError(400, 'invalid_request');
  }
  try {
    const done = await setKeep(body.threadId, owner.memberId, body.keep);
    if (!done) return proError(404, 'thread_not_found');
    return NextResponse.json({ threadId: body.threadId, keep: body.keep }, { headers: PRO_RESPONSE_HEADERS });
  } catch {
    return proError(503, 'conversation_unavailable');
  }
}
