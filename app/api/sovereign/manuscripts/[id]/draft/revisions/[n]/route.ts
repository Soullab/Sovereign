// Production web requires force-dynamic for runtime database access.
export const dynamic = 'force-dynamic';

/**
 * GET → { revisionNumber, content, createdAt }: the text of ONE version the writer kept ("Keep a version"), for the Revision
 * Mirror (College Essay, founder 2026-11-16). The Mirror compares the writer's own versions only: "My changes, not AI's".
 *
 * ⛔ Read-only. ⛔ Owner-scoped: the draft must be this member's. It returns the writer's own kept words to the writer; no MAIA
 *    path calls it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { getMemberIdFromRequest } from '@/lib/auth/getMemberFromRequest';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string; n: string }> }) {
  if (process.env.CAPACITOR_BUILD) {
    return NextResponse.json({ error: 'Not available in static build' }, { status: 501 });
  }
  const { id, n } = await ctx.params;
  const memberId = await getMemberIdFromRequest(request);
  if (!memberId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!/^\d{1,9}$/.test(n)) return NextResponse.json({ error: 'malformed' }, { status: 400 });
  try {
    const r = await query<{ revision_number: number; content: string; created_at: string }>(
      `SELECT v.revision_number, v.content, v.created_at
         FROM working_draft_revisions v
         JOIN manuscript_working_drafts d ON d.id = v.draft_id
        WHERE d.manuscript_id = $1 AND d.member_id = $2 AND v.revision_number = $3`,
      [id, memberId, Number(n)]);
    if (r.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const v = r.rows[0];
    return NextResponse.json({ revisionNumber: v.revision_number, content: v.content, createdAt: v.created_at },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    console.error('[manuscripts/draft/revisions/n] read failed');
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
