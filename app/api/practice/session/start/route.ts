/**
 * POST /api/practice/session/start
 *
 * Start a new practice session for a solo practitioner
 *
 * The practitioner is the SESSION member; a `practitionerId` in the body is ignored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/practice/PracticeStore';
import { requireSessionMember } from '@/lib/auth/requireSessionMember';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSessionMember(req);
    if ('error' in actor) return actor.error;
    const practitionerId = actor.memberId;
    const {
      title,
      clientAlias,
      modalitiesTagged,
      sessionType,
      notes,
      tags
    } = await req.json();

    const session = await createSession({
      practitionerId,
      title,
      clientAlias,
      modalitiesTagged,
      sessionType,
      notes,
      tags
    });

    return NextResponse.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('[practice/session/start] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start session' },
      { status: 500 }
    );
  }
}
