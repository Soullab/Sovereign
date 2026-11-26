export const dynamic = 'force-dynamic';

/**
 * GET /api/reflections/river — read-only data for the Reflections Web view
 * (Life Web step 1; contract: docs/design/contracts/reflections-room.md, addendum 2026-11-26).
 *
 * Returns the member's non-archived Reflections as lean nodes (no summary, no gold lines)
 * and the member's own facet crossings that touch one of those Reflections, as threads.
 * The other end of a thread carries only its label and return link — never its prose
 * (facet-crossings contract, Q3 amendment). No writes. No inference. Member-scoped.
 */

import { NextResponse } from 'next/server';
import { requireMemberId } from '@/lib/auth/session';
import { query } from '@/lib/db/postgres';
import { FACET_CROSSINGS } from '@/lib/house/livingOrientation';
import {
  resolveFacetFlowSource,
  resolveFacetTarget,
  type RelationSourceFacet,
  type RelationTargetFacet,
} from '@/lib/house/facetCrossing.server';
import type { WebPayload, WebThread } from '@/lib/reflections/webTypes';

const MAX_NODES = 1000;

const SOURCE_FACETS = new Set<string>(['journal', 'dream', 'reflections', 'ideas', 'relationships', 'changes', 'decisions', 'divination', 'astrology']);
const TARGET_FACETS = new Set<string>(['changes', 'decisions', 'journal', 'anchor', 'reflections']);

const iso = (value: Date | string) => new Date(value).toISOString();

const GESTURES = new Map<string, string>(FACET_CROSSINGS.map((c) => [c.id, c.gesture]));

export async function GET() {
  let memberId: string;
  try {
    memberId = await requireMemberId();
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const nodes = await query<{
      id: string;
      title: string;
      created_at: Date | string;
      source_type: string;
      element: string | null;
      draft: boolean;
    }>(
      `SELECT id::text AS id, title, created_at, source_type,
              signals->>'element' AS element, draft
         FROM reflection_capsules
        WHERE user_id = $1
          AND archived = false
        ORDER BY created_at ASC
        LIMIT $2`,
      [memberId, MAX_NODES],
    );

    const nodeIds = new Set(nodes.rows.map((row) => row.id));

    const crossings = await query<{
      id: string;
      crossing_id: string;
      source_facet: string;
      source_ref_id: string;
      target_facet: string;
      target_ref_id: string;
      created_at: Date | string;
    }>(
      `SELECT id::text AS id, crossing_id, source_facet, source_ref_id,
              target_facet, target_ref_id, created_at
         FROM member_facet_crossings
        WHERE member_id = $1::uuid
          AND (source_facet = 'reflections' OR target_facet = 'reflections')
        ORDER BY created_at ASC`,
      [memberId],
    );

    const threads: WebThread[] = [];
    for (const row of crossings.rows) {
      const out = row.source_facet === 'reflections';
      const reflectionId = out ? row.source_ref_id : row.target_ref_id;
      if (!nodeIds.has(reflectionId)) continue;

      let other: WebThread['other'] = null;
      if (out && TARGET_FACETS.has(row.target_facet)) {
        const end = await resolveFacetTarget(memberId, row.target_facet as RelationTargetFacet, row.target_ref_id);
        if (end) other = { facet: end.facet, label: end.label, href: end.href };
      } else if (!out && SOURCE_FACETS.has(row.source_facet)) {
        const end = await resolveFacetFlowSource(memberId, row.source_facet as RelationSourceFacet, row.source_ref_id);
        if (end) other = { facet: end.facet, label: end.label, href: end.href };
      }

      threads.push({
        id: row.id,
        reflectionId,
        direction: out ? 'out' : 'in',
        gesture: GESTURES.get(row.crossing_id) ?? null,
        createdAt: iso(row.created_at),
        other,
      });
    }

    const body: WebPayload = {
      nodes: nodes.rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: iso(row.created_at),
        sourceType: row.source_type,
        element: row.element,
        draft: row.draft,
      })),
      threads,
      truncated: nodes.rows.length === MAX_NODES,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error('[API] GET /api/reflections/river error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The Web could not be opened just now' }, { status: 500 });
  }
}
