// Production web requires force-dynamic for runtime database access.
export const dynamic = 'force-dynamic';

/**
 * A member's age attestation at a Studio program door (founder ruling 2026-11-16, #1900).
 *
 * GET  → { attested: 'adult' | 'minor' | null }   (their own latest standing; never anyone else's)
 * GET ?work=<id> → also { required: boolean }      (whether THEIR Work's recorded program requires it; 2026-11-16 walk)
 * POST { band: 'adult' } | { band: 'minor', supervised: true }, path? → 204
 *
 * ⛔ An under-13 answer is never sent here and could not be stored: the door turns them away and keeps nothing.
 * ⛔ Anything other than an adult or a supervised minor is refused (400) and nothing is written.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMemberIdFromRequest } from '@/lib/auth/getMemberFromRequest';
import { latestAgeAttestation } from '@/lib/studios/ageAttestationRead';
import { parseAttestation, recordAgeAttestation } from '@/lib/studios/ageAttestation';
import { studioPathById } from '@/lib/writersStudio/studioPaths';
import { workRequiresAgeAttestation } from '@/lib/studios/workAgeGate';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(req: NextRequest) {
  const memberId = await getMemberIdFromRequest(req);
  if (!memberId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: privateHeaders });
  const a = await latestAgeAttestation(memberId);
  if (a === 'unknown') return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: privateHeaders });
  const attested = a && (a.band === 'adult' || a.supervised) ? a.band : null;
  const work = req.nextUrl.searchParams.get('work');
  if (work === null) return NextResponse.json({ attested }, { headers: privateHeaders });
  const required = await workRequiresAgeAttestation(memberId, work);
  if (required === 'unknown') return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: privateHeaders });
  return NextResponse.json({ attested, required }, { headers: privateHeaders });
}

export async function POST(req: NextRequest) {
  const memberId = await getMemberIdFromRequest(req);
  if (!memberId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: privateHeaders });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const attestation = parseAttestation(body);
  if (!attestation) return NextResponse.json({ refusal: 'not_recorded' }, { status: 400, headers: privateHeaders });
  // The door it was given at, for the record only: a registered program id, or nothing.
  const path = typeof body?.path === 'string' && studioPathById(body.path) ? body.path : null;
  try {
    await recordAgeAttestation(memberId, attestation, path);
  } catch {
    console.error('[age-attestation] not recorded');
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: privateHeaders });
  }
  return new NextResponse(null, { status: 204, headers: privateHeaders });
}
