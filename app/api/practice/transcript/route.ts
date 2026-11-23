/**
 * GET/POST /api/practice/transcript
 *
 * GET: Retrieve transcript segments with cursor-based pagination
 * POST: Add new transcript segment (from Whisper transcription)
 *
 * Transcript text is PHI. The session must be the caller's own: a session that is not theirs, an
 * unowned legacy session and an absent id answer the same 404, and nothing is read or written first
 * (PRACTITIONER-SESSION-OWNERSHIP-01, lib/auth/requireOwnedSession.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTranscriptSegments,
  getFullTranscript,
  addTranscriptSegment
} from '@/lib/practice/PracticeStore';
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
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const afterMs = parseInt(searchParams.get('afterMs') || '-1', 10);
    const limit = parseInt(searchParams.get('limit') || '200', 10);
    const full = searchParams.get('full') === 'true';

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId required' },
        { status: 400 }
      );
    }

    const owned = await requireOwnedSession(actor.memberId, sessionId);
    if ('error' in owned) return owned.error;

    // Full transcript (for post-session review)
    if (full) {
      const segments = await getFullTranscript(sessionId);
      return NextResponse.json({
        success: true,
        segments,
        isFull: true
      });
    }

    // Incremental fetch (for live polling)
    const segments = await getTranscriptSegments(sessionId, { afterMs, limit });

    // Calculate cursor for next fetch
    let cursor: { afterMs: number } | undefined;
    if (segments.length > 0) {
      const maxMs = Math.max(
        ...segments.map(s => Math.max(s.end_ms ?? 0, s.start_ms ?? 0))
      );
      cursor = { afterMs: maxMs };
    }

    return NextResponse.json({
      success: true,
      segments,
      cursor
    });
  } catch (error) {
    console.error('[practice/transcript] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get transcript' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSessionMember(req);
    if ('error' in actor) return actor.error;
    const body = await req.json();
    const {
      sessionId,
      speaker,
      speakerConfidence,
      startMs,
      endMs,
      text,
      transcriptionConfidence,
      language,
      isFinal
    } = body;

    if (!sessionId || !speaker || startMs === undefined || endMs === undefined || !text) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: sessionId, speaker, startMs, endMs, text' },
        { status: 400 }
      );
    }

    const owned = await requireOwnedSession(actor.memberId, sessionId);
    if ('error' in owned) return owned.error;

    const segment = await addTranscriptSegment({
      sessionId,
      speaker,
      speakerConfidence,
      startMs,
      endMs,
      text,
      transcriptionConfidence,
      language,
      isFinal
    });

    return NextResponse.json({
      success: true,
      segment
    });
  } catch (error) {
    console.error('[practice/transcript] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add transcript segment' },
      { status: 500 }
    );
  }
}
