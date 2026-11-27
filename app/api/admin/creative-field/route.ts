import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth, adminUnauthorized } from '@/lib/admin/adminAuth';
import {
  CREATIVE_FIELD_ROLES,
  CREATIVE_FIELD_STANDING,
  CREATIVE_TOOLS,
  OBLIGATION_TEXT,
  type CreativeFieldPayload,
} from '@/lib/creative/toolRegistry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Creative Field, stage 1 (Soullab/Sovereign#2417). Internal team only.
 * Read-only: no write path, no generation, no member data.
 */
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req, CREATIVE_FIELD_ROLES);
  if (!auth.authed) return adminUnauthorized();

  const body: CreativeFieldPayload = {
    standing: CREATIVE_FIELD_STANDING,
    tools: CREATIVE_TOOLS,
    obligationText: OBLIGATION_TEXT,
  };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
