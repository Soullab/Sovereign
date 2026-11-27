/**
 * /api/psyche/patterns — the member's patterns (SPIRAL_CONTINUITY_ENGINE §6a).
 *
 * GET  → { patterns, level }  every pattern the member holds (archived included) + their dial.
 * POST → the member's verdict on an offer MAIA made:
 *        { action: 'confirm' | 'correct' | 'dismiss', offer: { wording, sources, offeredAt?, originSurface? },
 *          correctedWording? }
 *        confirm/correct store the pattern with its sources (re-verified server-side:
 *        member-owned, personal scope, eligible); dismiss stores only a content-free key.
 *
 * Authenticated member only. Nothing here is reachable for another member's id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMemberIdFromRequest } from '@/lib/auth/getMemberFromRequest';
import {
  confirmPatternOffer,
  dismissPatternOffer,
  listMemberPatterns,
  loadPatternLevel,
  PatternRefusal,
  type PatternOriginSurface,
} from '@/lib/maia/patternRecognition';

const SURFACES = new Set<PatternOriginSurface>(['maia', 'between', 'room', 'pro_personal']);

export async function GET(request: NextRequest) {
  const memberId = await getMemberIdFromRequest(request);
  if (!memberId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const [patterns, level] = await Promise.all([listMemberPatterns(memberId), loadPatternLevel(memberId)]);
    return NextResponse.json({ patterns, level });
  } catch (err) {
    console.error('[GET /api/psyche/patterns]', (err as Error)?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const memberId = await getMemberIdFromRequest(request);
  if (!memberId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as any;
  const action = body?.action;
  const offer = body?.offer;
  if (!offer || typeof offer !== 'object') return NextResponse.json({ error: 'offer required' }, { status: 400 });

  try {
    if (action === 'dismiss') {
      await dismissPatternOffer({ memberId, sources: offer.sources });
      return NextResponse.json({ dismissed: true });
    }
    if (action === 'confirm' || action === 'correct') {
      const surface: PatternOriginSurface = SURFACES.has(offer.originSurface) ? offer.originSurface : 'maia';
      if (action === 'correct' && !(typeof body?.correctedWording === 'string' && body.correctedWording.trim())) {
        return NextResponse.json({ error: 'correctedWording required' }, { status: 400 });
      }
      const pattern = await confirmPatternOffer({
        memberId,
        wording: String(offer.wording ?? ''),
        correctedWording: action === 'correct' ? body.correctedWording : null,
        sources: offer.sources,
        offeredAt: typeof offer.offeredAt === 'string' ? offer.offeredAt : null,
        originSurface: surface,
      });
      return NextResponse.json({ pattern }, { status: 201 });
    }
    return NextResponse.json({ error: 'action must be confirm, correct or dismiss' }, { status: 400 });
  } catch (err) {
    if (err instanceof PatternRefusal) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === 'already_kept' ? 409 : 400 });
    }
    console.error('[POST /api/psyche/patterns]', (err as Error)?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
