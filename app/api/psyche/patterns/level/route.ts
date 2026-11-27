/**
 * /api/psyche/patterns/level — the member's pattern-recognition dial (SCE §6a.7).
 *
 * GET → { level }   'full' when the member has never set it (founder default, 2026-11-23).
 * PUT { level: 'full' | 'gentle' | 'on_request' | 'off' } → takes effect on the next turn.
 * Dialling back never deletes kept items, confirmed patterns or return settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMemberIdFromRequest } from '@/lib/auth/getMemberFromRequest';
import { isPatternLevel, loadPatternLevel, setPatternLevel } from '@/lib/maia/patternRecognition';

export async function GET(request: NextRequest) {
  const memberId = await getMemberIdFromRequest(request);
  if (!memberId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json({ level: await loadPatternLevel(memberId) });
}

export async function PUT(request: NextRequest) {
  const memberId = await getMemberIdFromRequest(request);
  if (!memberId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as any;
  if (!isPatternLevel(body?.level)) {
    return NextResponse.json({ error: 'level must be full, gentle, on_request or off' }, { status: 400 });
  }
  try {
    return NextResponse.json({ level: await setPatternLevel(memberId, body.level) });
  } catch (err) {
    console.error('[PUT /api/psyche/patterns/level]', (err as Error)?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
