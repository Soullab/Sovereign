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
  resolveFacetCarrySource,
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

/**
 * At most this many other-end lookups run at once. The shared pool holds 20 connections and a
 * waiting query gives up after 2s (lib/db/postgres.ts), so one member's river must never take
 * the whole pool from everyone else's requests.
 */
const LOOKUP_CONCURRENCY = 4;

async function mapBounded<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Journal and Dream ends are the member's own writing, so the Web names them by kind and date
 * ("Journal entry", "Dream") rather than by their first line — founder ruling D, 2026-11-27:
 * "labels and return links, never copied prose". Other rooms' labels are titles, not prose.
 */
const ENTRY_KINDS: Record<string, string> = { journal: 'Journal entry', dream: 'Dream' };

async function resolveEntry(memberId: string, facet: 'journal' | 'dream', refId: string): Promise<WebThread['other']> {
  const end = await resolveFacetCarrySource(memberId, facet, refId);
  if (!end) return null;
  return { facet, label: ENTRY_KINDS[facet], href: end.returnHref, at: end.createdAt ? iso(end.createdAt) : null };
}

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
        ORDER BY created_at DESC
        LIMIT $2`,
      // The most recent MAX_NODES, so what was just kept always reaches "Now";
      // one extra row tells us honestly whether anything older was left out.
      [memberId, MAX_NODES + 1],
    );

    const truncated = nodes.rows.length > MAX_NODES;
    const kept = nodes.rows.slice(0, MAX_NODES).reverse();
    const nodeIds = new Set(kept.map((row) => row.id));

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

    // A crossing can touch two Reflections (reflections → reflections); each end gets its own thread.
    const ends = crossings.rows.flatMap((row) => {
      const list: Array<{ row: typeof row; out: boolean; reflectionId: string }> = [];
      if (row.source_facet === 'reflections' && nodeIds.has(row.source_ref_id)) {
        list.push({ row, out: true, reflectionId: row.source_ref_id });
      }
      if (row.target_facet === 'reflections' && nodeIds.has(row.target_ref_id)) {
        list.push({ row, out: false, reflectionId: row.target_ref_id });
      }
      return list;
    });

    const threads: WebThread[] = await mapBounded(ends, LOOKUP_CONCURRENCY,
      async ({ row, out, reflectionId }) => {
        let other: WebThread['other'] = null;
        const otherFacet = out ? row.target_facet : row.source_facet;
        const otherRef = out ? row.target_ref_id : row.source_ref_id;
        if (otherFacet === 'journal' || otherFacet === 'dream') {
          other = await resolveEntry(memberId, otherFacet, otherRef);
        } else if (out && TARGET_FACETS.has(row.target_facet)) {
          const end = await resolveFacetTarget(memberId, row.target_facet as RelationTargetFacet, row.target_ref_id);
          if (end) other = { facet: end.facet, label: end.label, href: end.href };
        } else if (!out && SOURCE_FACETS.has(row.source_facet)) {
          const end = await resolveFacetFlowSource(memberId, row.source_facet as RelationSourceFacet, row.source_ref_id);
          if (end) other = { facet: end.facet, label: end.label, href: end.href };
        }
        return {
          id: `${row.id}:${out ? 'out' : 'in'}`,
          reflectionId,
          direction: out ? ('out' as const) : ('in' as const),
          gesture: GESTURES.get(row.crossing_id) ?? null,
          createdAt: iso(row.created_at),
          other,
        };
      },
    );

    const body: WebPayload = {
      nodes: kept.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: iso(row.created_at),
        sourceType: row.source_type,
        element: row.element,
        draft: row.draft,
      })),
      threads,
      truncated,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error('[API] GET /api/reflections/river error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The Web could not be opened just now' }, { status: 500 });
  }
}
