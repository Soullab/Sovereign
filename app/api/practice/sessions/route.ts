/**
 * GET /api/practice/sessions
 *
 * List practice sessions for a practitioner
 *
 * The LIST is always the SESSION practitioner's own: a `practitionerId` query param is ignored,
 * and with none supplied it no longer lists every practitioner's sessions.
 *
 * The single-session lookup (`?sessionId=`) and PATCH address one session by id: it must be the
 * SESSION practitioner's own. A session that is not theirs, a legacy session whose owner is NULL and an
 * absent id all answer the same 404 (PRACTITIONER-SESSION-OWNERSHIP-01,
 * lib/auth/requireOwnedSession.ts). practice_sessions.practitioner_id is nullable and getSession() falls
 * back to supervision_sessions, so legacy unowned rows are unreachable here; recovery is a
 * founder-run audited step, not built.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listSessions, getSession, updateSession } from '@/lib/practice/PracticeStore';
import { requireSessionMember } from '@/lib/auth/requireSessionMember';
import { requireOwnedSession } from '@/lib/auth/requireOwnedSession';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Static export: return stub response during pre-rendering
  if (process.env.CAPACITOR_BUILD) {
    return NextResponse.json({ stub: true });
  }
  try {
    const actor = await requireSessionMember(req);
    if ('error' in actor) return actor.error;
    const practitionerId = actor.memberId;
    const { searchParams } = new URL(req.url);
    const clientAlias = searchParams.get('clientAlias') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sessionId = searchParams.get('sessionId');

    // Single session lookup
    if (sessionId) {
      const owned = await requireOwnedSession(practitionerId, sessionId);
      if ('error' in owned) return owned.error;
      const session = await getSession(sessionId);
      if (!session) {
        return NextResponse.json(
          { success: false, error: 'Session not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, session });
    }

    // List sessions
    const sessions = await listSessions({
      practitionerId,
      clientAlias,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      sessions,
      pagination: { limit, offset, count: sessions.length }
    });
  } catch (error) {
    console.error('[practice/sessions] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireSessionMember(req);
    if ('error' in actor) return actor.error;
    const body = await req.json();
    const { sessionId, ...updates } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId required' },
        { status: 400 }
      );
    }

    const owned = await requireOwnedSession(actor.memberId, sessionId);
    if ('error' in owned) return owned.error;

    const session = await updateSession(sessionId, updates);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('[practice/sessions] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
