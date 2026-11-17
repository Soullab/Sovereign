export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return [{ caseId: 'default' }];
}

/**
 * CASE MEMORIES API
 *
 * GET  - List recent memories + patterns for a case
 * POST - Manually ingest content into memory
 */

import { NextRequest, NextResponse } from 'next/server';
import { CaseMemoryService } from '@/lib/caseload/CaseMemoryService';
import { CasePatternService } from '@/lib/caseload/CasePatternService';
import { CaseStore } from '@/lib/caseload/CaseStore';
import { requireSessionMember } from '@/lib/auth/requireSessionMember';

interface RouteParams {
  params: Promise<{ caseId: string }>;
}

/**
 * GET /api/caseload/[caseId]/memories
 *
 * List recent memory chunks and cached patterns for a case.
 *
 * The practitioner is the SESSION member (a `memberId` query param is ignored).
 */
export async function GET(request: NextRequest, context: RouteParams) {
  // Static export: return stub response during pre-rendering
  if (process.env.CAPACITOR_BUILD) {
    return NextResponse.json({ stub: true });
  }
  try {
    const actor = await requireSessionMember(request);
    if ('error' in actor) return actor.error;
    const { memberId } = actor;
    const { caseId } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '25');

    // Verify case access
    const caseData = await CaseStore.getCase(caseId, memberId);
    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const [recent, patterns] = await Promise.all([
      CaseMemoryService.listRecent({ caseId, limit }),
      CasePatternService.get(caseId),
    ]);

    return NextResponse.json({
      recent,
      patterns: patterns?.summary || null,
      patternsComputedAt: patterns?.computed_at || null,
    });
  } catch (error) {
    console.error('[CASELOAD] Get memories error:', error);
    return NextResponse.json({ error: 'Failed to get memories' }, { status: 500 });
  }
}

/**
 * POST /api/caseload/[caseId]/memories
 *
 * Manually ingest content into case memory.
 *
 * The practitioner is the SESSION member (a `memberId` in the body is ignored).
 *
 * Body:
 * - content (required)
 * - sourceType: 'note' | 'capture' | 'consultation' | 'manual'
 * - sourceId: optional source ID
 * - occurredAt: optional timestamp
 * - metadata: optional metadata object
 * - embed: whether to generate embeddings (default true)
 */
export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const actor = await requireSessionMember(request);
    if ('error' in actor) return actor.error;
    const { memberId } = actor;
    const { caseId } = await context.params;
    const { content, sourceType, sourceId, occurredAt, metadata, embed } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'content required' }, { status: 400 });
    }

    // Verify case access
    const caseData = await CaseStore.getCase(caseId, memberId);
    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Ingest the content
    const result = await CaseMemoryService.ingestText({
      caseId,
      memberId,
      sourceType: sourceType || 'manual',
      sourceId: sourceId || null,
      occurredAt: occurredAt || new Date().toISOString(),
      content,
      metadata: metadata || {},
      embed: embed !== false,
    });

    // Refresh patterns after ingest
    const patterns = await CasePatternService.upsert(caseId);

    return NextResponse.json({
      success: true,
      chunksInserted: result.inserted,
      patterns,
    });
  } catch (error) {
    console.error('[CASELOAD] Ingest memory error:', error);
    return NextResponse.json({ error: 'Failed to ingest memory' }, { status: 500 });
  }
}
