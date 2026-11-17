export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/postgres";
import { requireSessionMember } from '@/lib/auth/requireSessionMember';

/**
 * GET /api/practitioners/onboarding
 *
 * Check onboarding status for a practitioner.
 * Returns whether they have completed setup.
 *
 * `practitionerId` is a RESOURCE id (practitioners.id), answered only when the SESSION member owns
 * that practitioner row; anyone else's id is indistinguishable from an unknown one (404). This
 * route had no session check at all.
 */
export async function GET(request: NextRequest) {
  // Static export: return stub response during pre-rendering
  if (process.env.CAPACITOR_BUILD) {
    return NextResponse.json({ stub: true });
  }
  try {
    const actor = await requireSessionMember(request);
    if ("error" in actor) return actor.error;
    const { searchParams } = new URL(request.url);
    const practitionerId = searchParams.get("practitionerId");

    if (!practitionerId) {
      return NextResponse.json(
        { error: "practitionerId required" },
        { status: 400 }
      );
    }

    if (!pool) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const result = await pool.query(
      `SELECT
        p.id,
        p.status,
        p.onboarded_at,
        pt.theme_json IS NOT NULL as has_theme
      FROM practitioners p
      LEFT JOIN practitioner_themes pt ON pt.practitioner_id = p.id
      WHERE p.id = $1 AND p.member_id = $2`,
      [practitionerId, actor.memberId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Practitioner not found" },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    return NextResponse.json({
      practitionerId: row.id,
      status: row.status,
      onboardedAt: row.onboarded_at,
      hasTheme: row.has_theme,
      isComplete: row.status === "active" && row.has_theme,
    });
  } catch (error) {
    console.error("GET /api/practitioners/onboarding error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/practitioners/onboarding
 *
 * Mark onboarding as complete for a practitioner.
 *
 * `practitionerId` is a RESOURCE id, accepted only for the SESSION member's own practitioner row
 * (404 otherwise, with nothing written).
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireSessionMember(request);
    if ("error" in actor) return actor.error;
    const body = await request.json();
    const { practitionerId } = body;

    if (!practitionerId) {
      return NextResponse.json(
        { error: "practitionerId required" },
        { status: 400 }
      );
    }

    if (!pool) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const owned = await pool.query(
      `SELECT id FROM practitioners WHERE id = $1 AND member_id = $2`,
      [practitionerId, actor.memberId]
    );
    if (owned.rows.length === 0) {
      return NextResponse.json(
        { error: "Practitioner not found" },
        { status: 404 }
      );
    }

    await pool.query(
      `UPDATE practitioners
       SET status = 'active', onboarded_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND member_id = $2 AND status = 'onboarding'`,
      [practitionerId, actor.memberId]
    );

    return NextResponse.json({
      success: true,
      message: "Onboarding marked as complete",
    });
  } catch (error) {
    console.error("POST /api/practitioners/onboarding error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
