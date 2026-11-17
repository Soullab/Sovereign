/**
 * GET/POST /api/practice/insights
 *
 * MAIA's developmental insights for practice sessions
 *
 * The caller is the SESSION member, and the session must be theirs (404 otherwise, the same 404 as an
 * absent id): PRACTITIONER-SESSION-OWNERSHIP-01, lib/auth/requireOwnedSession.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionInsights,
  getInsightsGroupedByType,
  addInsight,
  type InsightType
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
    const insightType = searchParams.get('type') as InsightType | null;
    const grouped = searchParams.get('grouped') === 'true';

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId required' },
        { status: 400 }
      );
    }

    const owned = await requireOwnedSession(actor.memberId, sessionId);
    if ('error' in owned) return owned.error;

    // Grouped by type (for dashboard display)
    if (grouped) {
      const insights = await getInsightsGroupedByType(sessionId);
      return NextResponse.json({
        success: true,
        insights,
        grouped: true
      });
    }

    // Flat list, optionally filtered by type
    const insights = await getSessionInsights(sessionId, insightType || undefined);

    return NextResponse.json({
      success: true,
      insights
    });
  } catch (error) {
    console.error('[practice/insights] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get insights' },
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
      insightType,
      content,
      timestampMs,
      timestampEndMs,
      segmentRefs,
      significance,
      modalityTag,
      modelUsed,
      processingTimeMs
    } = body;

    if (!sessionId || !insightType || !content) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: sessionId, insightType, content' },
        { status: 400 }
      );
    }

    const owned = await requireOwnedSession(actor.memberId, sessionId);
    if ('error' in owned) return owned.error;

    const insight = await addInsight({
      sessionId,
      insightType,
      content,
      timestampMs,
      timestampEndMs,
      segmentRefs,
      significance,
      modalityTag,
      modelUsed,
      processingTimeMs
    });

    return NextResponse.json({
      success: true,
      insight
    });
  } catch (error) {
    console.error('[practice/insights] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add insight' },
      { status: 500 }
    );
  }
}
