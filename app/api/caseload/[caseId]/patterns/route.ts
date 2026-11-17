export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return [{ caseId: 'default' }];
}

/**
 * CASE PATTERNS API
 *
 * GET - Recompute and return pattern summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { CasePatternService } from '@/lib/caseload/CasePatternService';
import { CaseStore } from '@/lib/caseload/CaseStore';
import { requireSessionMember } from '@/lib/auth/requireSessionMember';

interface RouteParams {
  params: Promise<{ caseId: string }>;
}

/**
 * GET /api/caseload/[caseId]/patterns
 *
 * Recompute pattern summary from notes and return.
 *
 * The practitioner is the SESSION member (a `memberId` query param is ignored).
 */
export async function GET(request: NextRequest, context: RouteParams) {
  // Static export: return stub response during pre-rendering
  if (process.env.CAPACITOR_BUILD) {
    return NextResponse.json({ success: true, summary: null });
  }
  try {
    const actor = await requireSessionMember(request);
    if ('error' in actor) return actor.error;
    const { memberId } = actor;
    const { caseId } = await context.params;

    // Verify case access
    const caseData = await CaseStore.getCase(caseId, memberId);
    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Recompute patterns
    const summary = await CasePatternService.upsert(caseId);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('[CASELOAD] Patterns error:', error);
    return NextResponse.json({ error: 'Failed to compute patterns' }, { status: 500 });
  }
}
