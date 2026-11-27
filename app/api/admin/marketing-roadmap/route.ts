import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth, adminUnauthorized, type AdminRole } from '@/lib/admin/adminAuth';
import { ROADMAP, ROADMAP_STANDING } from '@/lib/marketing/strategicRoadmap2027';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Internal strategy is not for testers or practitioner admins. Read-only; this
 * route has no write path and touches no member data.
 */
const MARKETING_ROADMAP_ROLES: AdminRole[] = ['founder', 'cto', 'operations'];

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req, MARKETING_ROADMAP_ROLES);
  if (!auth.authed) return adminUnauthorized();

  return NextResponse.json(
    { standing: ROADMAP_STANDING, roadmap: ROADMAP },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
