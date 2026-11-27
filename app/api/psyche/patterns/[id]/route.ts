/**
 * /api/psyche/patterns/[id] — the member changes or removes one of their patterns (SCE §6a.4).
 *
 * PATCH  { wording?, status?: 'active' | 'archived', returnPreference?: 'member_pulled' | 'contextual_doorway' }
 *        Editing the wording makes it the member's own words.
 * DELETE removes the pattern and its source links. Patterns built on it lose that leg,
 *        and any left on fewer than two sources are retired (database trigger).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMemberIdFromRequest } from '@/lib/auth/getMemberFromRequest';
import { deleteMemberPattern, PatternRefusal, updateMemberPattern } from '@/lib/maia/patternRecognition';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const memberId = await getMemberIdFromRequest(request);
  if (!memberId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  if (!id || !UUID.test(id)) return NextResponse.json({ error: 'Pattern id required' }, { status: 400 });

  const body = (await request.json().catch(() => null)) as any;
  try {
    const pattern = await updateMemberPattern({
      memberId,
      patternId: id,
      wording: typeof body?.wording === 'string' ? body.wording : undefined,
      status: body?.status === 'archived' || body?.status === 'active' ? body.status : undefined,
      returnPreference:
        body?.returnPreference === 'member_pulled' || body?.returnPreference === 'contextual_doorway'
          ? body.returnPreference
          : undefined,
    });
    if (!pattern) return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
    return NextResponse.json({ pattern });
  } catch (err) {
    if (err instanceof PatternRefusal) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    console.error('[PATCH /api/psyche/patterns/[id]]', (err as Error)?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const memberId = await getMemberIdFromRequest(request);
  if (!memberId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  if (!id || !UUID.test(id)) return NextResponse.json({ error: 'Pattern id required' }, { status: 400 });
  try {
    const removed = await deleteMemberPattern(memberId, id);
    if (!removed) return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('[DELETE /api/psyche/patterns/[id]]', (err as Error)?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
