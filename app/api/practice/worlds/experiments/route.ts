/**
 * GET /api/practice/worlds/experiments
 *
 * Get micro-practice experiments from worlds
 *
 * `?worldId=` is a catalogue lookup (no identity). Without it, the experiments are the SESSION
 * practitioner's own; a `practitionerId` query param is ignored.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getWorldExperiments,
  getExperimentsForPractitioner
} from '@/lib/practice/WorldsStore';
import { requireSessionMember } from '@/lib/auth/requireSessionMember';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Static export: return stub response during pre-rendering
  if (process.env.CAPACITOR_BUILD) {
    return NextResponse.json({ stub: true });
  }
  try {
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('worldId');
    const difficultyLevel = searchParams.get('difficulty') as 'accessible' | 'intermediate' | 'advanced' | null;

    // Get experiments for a specific world
    if (worldId) {
      const experiments = await getWorldExperiments(worldId, {
        difficultyLevel: difficultyLevel || undefined
      });

      return NextResponse.json({
        success: true,
        experiments
      });
    }

    // Get all experiments appropriate for the session practitioner (their enabled worlds + proficiency)
    const actor = await requireSessionMember(req);
    if ('error' in actor) return actor.error;
    const experiments = await getExperimentsForPractitioner(actor.memberId, {
      maxDifficulty: difficultyLevel || undefined
    });

    // Group by world
    const byWorld = experiments.reduce<Record<string, typeof experiments>>((acc, exp) => {
      if (!acc[exp.world_code]) acc[exp.world_code] = [];
      acc[exp.world_code].push(exp);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      experiments,
      byWorld
    });
  } catch (error) {
    console.error('[practice/worlds/experiments] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get experiments' },
      { status: 500 }
    );
  }
}
