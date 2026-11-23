/**
 * GET /api/astrology/pro/access — whether the signed-in member can open Pro.
 *
 * Lets a Free room offer "Ask MAIA about this in Pro" only to members who
 * have Pro (founder direction 2026-11-23). It answers for the verified
 * session's own member and nobody else, reads no chart or birth data, and
 * refuses exactly as every Pro route does when Pro is closed to them.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PRO_RESPONSE_HEADERS, resolveProOwner } from '@/lib/astrology/proRouteAccess';

export async function GET(request: NextRequest) {
  const owner = await resolveProOwner(request, false);
  if (!owner.ok) return owner.response;
  return NextResponse.json({ pro: true }, { headers: PRO_RESPONSE_HEADERS });
}
