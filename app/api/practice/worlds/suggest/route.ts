/**
 * POST /api/practice/worlds/suggest
 *
 * MAIA Mentor: Suggest which world might help this client
 *
 * The practitioner is the SESSION member; a `practitionerId` in the body is ignored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { suggestWorldForContext, getSessionWorlds } from '@/lib/practice/WorldsStore';
import { requireSessionMember } from '@/lib/auth/requireSessionMember';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSessionMember(req);
    if ('error' in actor) return actor.error;
    const practitionerId = actor.memberId;
    const { transcriptSample, sessionId, excludeWorlds } = await req.json();

    if (!transcriptSample) {
      return NextResponse.json(
        { success: false, error: 'transcriptSample required' },
        { status: 400 }
      );
    }

    // If sessionId provided, exclude worlds already used in this session
    let worldsToExclude = excludeWorlds || [];
    if (sessionId) {
      const sessionWorlds = await getSessionWorlds(sessionId);
      const usedWorldIds = sessionWorlds
        .filter(sw => sw.usage_type === 'explicit')
        .map(sw => sw.world_id);
      worldsToExclude = [...new Set([...worldsToExclude, ...usedWorldIds])];
    }

    const suggestion = await suggestWorldForContext({
      practitionerId,
      transcriptSample,
      excludeWorlds: worldsToExclude
    });

    return NextResponse.json({
      success: true,
      ...suggestion,
      // MAIA mentor voice
      mentorNote: suggestion.suggestedWorld
        ? `I'm noticing some ${suggestion.suggestedWorld.display_name} territory here. ${suggestion.reason}`
        : suggestion.reason
    });
  } catch (error) {
    console.error('[practice/worlds/suggest] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to suggest world' },
      { status: 500 }
    );
  }
}
