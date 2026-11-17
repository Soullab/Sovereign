export const dynamic = 'force-dynamic';


/**
 * CASELOAD API
 *
 * List and create practitioner cases.
 * GET /api/caseload - List cases
 * POST /api/caseload - Create new case
 */

import { NextRequest, NextResponse } from 'next/server';
import { CaseStore } from '@/lib/caseload/CaseStore';
import type { CreateCaseInput, CaseListFilters } from '@/lib/caseload/types';
import { requireSessionMember } from '@/lib/auth/requireSessionMember';

/**
 * GET /api/caseload
 *
 * List cases for the signed-in practitioner with optional filters.
 *
 * The practitioner is the SESSION member. A `memberId` query param is ignored.
 *
 * Query params:
 * - status: Filter by case status
 * - element: Filter by primary element
 * - search: Search client identifiers
 * - limit: Max results (default 50)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  // Static export: return stub response during pre-rendering
  if (process.env.CAPACITOR_BUILD) {
    return NextResponse.json({ stub: true });
  }
  try {
    const actor = await requireSessionMember(request);
    if ('error' in actor) return actor.error;
    const { memberId } = actor;
    const { searchParams } = new URL(request.url);

    // Check if member is a practitioner
    const isPractitioner = await CaseStore.isPractitioner(memberId);
    if (!isPractitioner) {
      return NextResponse.json(
        { error: 'Member is not a practitioner. Enable practitioner mode first.' },
        { status: 403 }
      );
    }

    const filters: CaseListFilters = {
      status: searchParams.get('status') as any || undefined,
      element: searchParams.get('element') as any || undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const [cases, counts] = await Promise.all([
      CaseStore.listCases(memberId, filters),
      CaseStore.getCaseCounts(memberId),
    ]);

    return NextResponse.json({
      cases,
      counts,
      filters,
    });
  } catch (error) {
    console.error('[CASELOAD] List error:', error);
    return NextResponse.json(
      { error: 'Failed to list cases' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/caseload
 *
 * Create a new case for the signed-in practitioner.
 *
 * The practitioner is the SESSION member. A `memberId` in the body is ignored.
 *
 * Body:
 * - client_identifier (required): Your identifier for this client
 * - presenting_concerns: Array of initial concerns
 * - intake_date: Date of intake (defaults to today)
 * - primary_element: earth, water, fire, air, aether
 * - spiral_stage: Current developmental stage
 * - privacy_mode: private, transparent, consent_based (default: private)
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireSessionMember(request);
    if ('error' in actor) return actor.error;
    const { memberId } = actor;
    const caseInput = await request.json();

    if (!caseInput.client_identifier) {
      return NextResponse.json(
        { error: 'client_identifier required' },
        { status: 400 }
      );
    }

    // Check if member is a practitioner (or enable if first case)
    const isPractitioner = await CaseStore.isPractitioner(memberId);
    if (!isPractitioner) {
      // Auto-enable practitioner mode on first case creation
      await CaseStore.enablePractitionerMode(memberId);
      console.log(`[CASELOAD] Enabled practitioner mode for member ${memberId}`);
    }

    const newCase = await CaseStore.createCase(memberId, caseInput as CreateCaseInput);

    return NextResponse.json({
      success: true,
      case: newCase,
    });
  } catch (error: any) {
    // Handle unique constraint violation
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'A case with this client identifier already exists' },
        { status: 409 }
      );
    }

    console.error('[CASELOAD] Create error:', error);
    return NextResponse.json(
      { error: 'Failed to create case' },
      { status: 500 }
    );
  }
}
