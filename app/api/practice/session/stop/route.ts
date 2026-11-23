/**
 * POST /api/practice/session/stop
 *
 * Stop an active practice session and trigger processing
 *
 * Only the practitioner who owns the session may stop it; anyone else (or an unowned legacy session,
 * or an absent id) gets the same 404 (PRACTITIONER-SESSION-OWNERSHIP-01).
 */

import { NextRequest, NextResponse } from 'next/server';
import { stopSession, getSession } from '@/lib/practice/PracticeStore';
import { requireSessionMember } from '@/lib/auth/requireSessionMember';
import { requireOwnedSession } from '@/lib/auth/requireOwnedSession';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSessionMember(req);
    if ('error' in actor) return actor.error;
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId required' },
        { status: 400 }
      );
    }

    const owned = await requireOwnedSession(actor.memberId, sessionId);
    if ('error' in owned) return owned.error;

    const session = await stopSession(sessionId);

    if (!session) {
      // Session might already be stopped, fetch current state
      const existing = await getSession(sessionId);
      if (existing) {
        return NextResponse.json({
          success: true,
          session: existing,
          message: 'Session already stopped'
        });
      }
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('[practice/session/stop] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to stop session' },
      { status: 500 }
    );
  }
}
