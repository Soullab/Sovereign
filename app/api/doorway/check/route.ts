import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { doorwayById, doorwaysEnabled } from '@/lib/studios/doorways';
import { hashInvitationCode, invitationCheckAnswer } from '@/lib/studios/doorwayInvitations';

/**
 * POST /api/doorway/check — is this invitation code good for this Studio's door? (STUDIO-A-LA-CARTE-01 Phase 3)
 *
 * Exists so the sign-up page establishes eligibility BEFORE it asks for any account-creating detail (the Now What?
 * ordering invariant, Kelly ruling 2026-07-29). It reads only; it never takes a use. The register route re-checks and
 * claims atomically, so this answer is advisory and a bypassed page changes nothing.
 *
 * 404 unless STUDIO_DOORWAYS_ENABLED === 'true'. Answers { valid, reason } where reason is 'used' | 'expired' | 'invalid'
 * (founder polish 2026-11-16: "Distinguish used, expired, and invalid invitations without exposing account information").
 * It says only what is true of the CODE the person is holding. It never says who used it, which account, which other studio
 * it belongs to, or how many uses remain. A revoked code, a code for another studio and an unknown code are all 'invalid'.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!doorwaysEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const doorway = doorwayById(typeof body.studio === 'string' ? body.studio : null);
  const code = typeof body.code === 'string' ? body.code : '';
  if (!doorway || code.trim().length < 6 || code.length > 64) {
    return NextResponse.json(invitationCheckAnswer(null), { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const res = await query<{ used_up: boolean; expired: boolean }>(
      `SELECT (uses >= max_uses) AS used_up, (expires_at <= now()) AS expired FROM studio_doorway_invitations
        WHERE code_hash = $1 AND studio = $2 AND revoked_at IS NULL
        LIMIT 1`,
      [hashInvitationCode(code), doorway.id],
    );
    return NextResponse.json(invitationCheckAnswer(res.rows[0] ?? null), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[DoorwayCheck] lookup failed');
    return NextResponse.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 503 });
  }
}
