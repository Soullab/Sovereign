/**
 * "Keep with MAIA" — carry one own-chart Pro exchange into MAIA's memory
 * (ASTRO-PRO-KEEP Phase 2; founder ruling Kelly 2026-11-23, "Approve as designed").
 *
 * POST { threadId, turnIndex }  (turnIndex = MAIA's turn of the exchange)
 *
 * The press is the member's deliberate, member-selected transfer (R4H principle 1,
 * #1817). Each press carries one exchange and authorizes nothing else (principle 2).
 * Refused unless the stored thread is the caller's own kept thread about their own
 * chart alone: a client chart, a two-chart thread or another member's thread can
 * never become memory. The atom is minted through keepSource, the one governed
 * Keep path, and is seen, resealed and archived on /maia/keep-capture like any keep.
 * Carrying the same exchange twice returns the same atom.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PRO_RESPONSE_HEADERS, proError, resolveProOwner } from '@/lib/astrology/proRouteAccess';
import { isThreadId, resolveCarrySource } from '@/lib/astrology/proConversationStore';
import { keepSource } from '@/lib/psyche/portfolio';

/** MAIA's answer is kept verbatim up to this length; never summarised. */
const CARRY_READING_MAX = 1200;
const QUESTION_MAX = 2000;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

export async function POST(request: NextRequest) {
  const owner = await resolveProOwner(request, true);
  if (!owner.ok) return owner.response;
  let body: { threadId?: unknown; turnIndex?: unknown };
  try {
    body = await request.json();
  } catch {
    return proError(400, 'invalid_request');
  }
  if (!body || typeof body !== 'object' || Object.keys(body).some((k) => k !== 'threadId' && k !== 'turnIndex') ||
      !isThreadId(body.threadId) || typeof body.turnIndex !== 'number' || !Number.isInteger(body.turnIndex)) {
    return proError(400, 'invalid_request');
  }
  try {
    const resolved = await resolveCarrySource(owner.memberId, body.threadId, body.turnIndex);
    if (!resolved.ok) {
      if (resolved.reason === 'not_own_chart') return proError(403, 'own_chart_only');
      return proError(404, resolved.reason);
    }
    const { source } = resolved;
    const atom = await keepSource(owner.memberId, {
      memberId: owner.memberId,
      sourceType: 'astro_pro_exchange',
      sourceId: source.maiaTurnId,
      title: clip(source.memberTurn, QUESTION_MAX),
      body: clip(source.maiaTurn, CARRY_READING_MAX),
      astroProOrigin: {
        provenance: {
          surface: 'astro_pro', section: source.section, thread_id: body.threadId,
          turn_index: body.turnIndex, asked_at: source.askedAt,
        },
      },
    });
    // Privacy: record only that an exchange was carried, never its content.
    console.log('[astrology/pro/carry] carried');
    return NextResponse.json({ carried: true, atomId: atom.id, created: atom.wasCreated }, { headers: PRO_RESPONSE_HEADERS });
  } catch {
    return proError(503, 'carry_unavailable');
  }
}
