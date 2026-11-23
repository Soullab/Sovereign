/**
 * Start Clinical Supervision Session
 * POST /api/supervision/session/start
 *
 * Creates a new supervision session for audio capture and analysis.
 * All data stored in local PostgreSQL - HIPAA compliant.
 *
 * The practitioner is the SESSION member, always: every session this route creates is owned by them,
 * and a `practitionerId` in the body is ignored (PRACTITIONER-SESSION-OWNERSHIP-01). A request with no
 * session is refused rather than creating an unowned row.
 *
 * The old "Active session already exists" 409 is gone with the body identity it hung from: it only ran
 * when the client sent a practitionerId, which no client in this repository did (the recorders never
 * sent one), so it never fired for them. Extending it to every practitioner would be a NEW lockout (a
 * session left open by a crashed tab would block recording, and no surface can stop it), which this
 * change does not make.
 */

export const dynamic = 'force-dynamic';
export const revalidate = false;

import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/supervision/SupervisionStore';
import { requireSessionMember } from '@/lib/auth/requireSessionMember';

interface StartSessionRequest {
  caseId?: string;
  sessionType?: 'individual' | 'group' | 'peer' | 'consultation' | 'team_meeting' | 'reading' | 'scribe' | 'live_scribe';
  title?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSessionMember(request);
    if ('error' in actor) return actor.error;
    const body: StartSessionRequest = await request.json();

    // Create new session, owned by the session member
    const session = await createSession({
      practitionerId: actor.memberId,
      caseId: body.caseId,
      sessionType: body.sessionType || 'consultation',
      title: body.title,
      metadata: {
        ...body.metadata,
        startedVia: 'api',
        userAgent: request.headers.get('user-agent')
      }
    });

    console.log(`🎙️ [SUPERVISION] Session started: ${session.id}`);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        sessionType: session.session_type,
        title: session.title,
        startedAt: session.started_at,
        processingStatus: session.processing_status
      },
      // Connection info for audio capture
      capture: {
        wsUrl: `ws://localhost:3001/supervision/${session.id}`,
        storageDir: `storage/supervision/${session.id}`
      }
    });

  } catch (error) {
    console.error('🔴 [SUPERVISION] Error starting session:', error);

    // Handle missing table gracefully
    if ((error as { code?: string }).code === '42P01') {
      return NextResponse.json({
        success: false,
        error: 'Supervision tables not found. Run database migration first.',
        hint: 'psql -f database/migrations/20260109000001_supervision_sessions.sql'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to start session'
    }, { status: 500 });
  }
}
