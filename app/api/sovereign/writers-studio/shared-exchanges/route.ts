import { NextRequest, NextResponse } from 'next/server';
import { getMemberIdFromRequest } from '@/lib/auth/getMemberFromRequest';
import { keepGate } from '@/lib/sanctuary/keepGate';
import { isFounder } from '@/lib/writersStudio/journeyServer';
import { shareEnabledFromEnv } from '@/lib/writersStudio/sharedExchanges';
import { listOwnShares, listSharesForFounder, shareExchange, withdrawShare } from '@/lib/writersStudio/sharedExchangesServer';

/**
 * "Share this with Soullab" (Studio Academy slice 6; founder rulings 2026-11-19). BUILT DARK.
 *
 *   GET ?work=<id>   which of this Work's MAIA turns the writer has shared (no content)
 *   GET ?scope=all   the founder's view: every current share, decrypted (founder only)
 *   POST             share one stored MAIA turn { workId, threadId, maiaTurnIndex } + declared posture (refused in Sanctuary)
 *   DELETE ?id=<id>  withdraw: deletes the only copy
 *
 * ⛔ With WS_SHARE_EXCHANGE_ENABLED off, GET and POST answer 404. ⭐ DELETE always works: a writer can withdraw whatever the flag.
 */
export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, x-session-token' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const off = () => NextResponse.json({ error: 'not_found' }, { status: 404, headers: privateHeaders });
const notReady = (error: unknown) => (error as { code?: string })?.code === '42P01'
  ? NextResponse.json({ refusal: 'share_not_ready' }, { status: 503, headers: privateHeaders })
  : null;

export async function GET(req: NextRequest) {
  if (!shareEnabledFromEnv(process.env)) return off();
  const memberId = await getMemberIdFromRequest(req);
  if (!memberId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: privateHeaders });
  try {
    if (req.nextUrl.searchParams.get('scope') === 'all') {
      if (!(await isFounder(memberId))) return NextResponse.json({ refusal: 'founder_only' }, { status: 403, headers: privateHeaders });
      return NextResponse.json({ shares: await listSharesForFounder() }, { headers: privateHeaders });
    }
    const workId = req.nextUrl.searchParams.get('work') ?? '';
    if (!UUID.test(workId)) return NextResponse.json({ refusal: 'malformed' }, { status: 400, headers: privateHeaders });
    return NextResponse.json({ shares: await listOwnShares(memberId, workId) }, { headers: privateHeaders });
  } catch (error) {
    const r = notReady(error); if (r) return r; throw error;
  }
}

export async function POST(req: NextRequest) {
  if (!shareEnabledFromEnv(process.env)) return off();
  const memberId = await getMemberIdFromRequest(req);
  if (!memberId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: privateHeaders });
  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return NextResponse.json({ refusal: 'malformed' }, { status: 400, headers: privateHeaders });
  /* Sanctuary closure (founder ruling 2026-11-09): sharing keeps something, so it needs a declared ordinary posture. */
  { const refused = await keepGate(memberId, raw); if (refused) return refused; }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['workId', 'threadId', 'maiaTurnIndex']);
  if (Object.keys(body).some((k) => !allowed.has(k))) return NextResponse.json({ refusal: 'malformed', detail: 'unknown_field' }, { status: 400, headers: privateHeaders });
  const workId = typeof body.workId === 'string' ? body.workId : '';
  const threadId = typeof body.threadId === 'string' ? body.threadId : '';
  const maiaTurnIndex = Number.isInteger(body.maiaTurnIndex) ? Number(body.maiaTurnIndex) : -1;
  if (!UUID.test(workId) || !UUID.test(threadId) || maiaTurnIndex < 0) return NextResponse.json({ refusal: 'malformed' }, { status: 400, headers: privateHeaders });
  try {
    const outcome = await shareExchange({ memberId, workId, threadId, maiaTurnIndex, betaEnd: process.env.WS_BETA_END_DATE ?? null });
    if (!outcome.ok) return NextResponse.json({ refusal: outcome.refusal }, { status: outcome.status, headers: privateHeaders });
    return NextResponse.json({ share: outcome.share }, { headers: privateHeaders });
  } catch (error) {
    const r = notReady(error); if (r) return r; throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const memberId = await getMemberIdFromRequest(req);
  if (!memberId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: privateHeaders });
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!UUID.test(id)) return NextResponse.json({ refusal: 'malformed' }, { status: 400, headers: privateHeaders });
  try {
    const deleted = await withdrawShare(memberId, id);
    return deleted
      ? NextResponse.json({ withdrawn: true }, { headers: privateHeaders })
      : NextResponse.json({ refusal: 'not_found' }, { status: 404, headers: privateHeaders });
  } catch (error) {
    const r = notReady(error); if (r) return r; throw error;
  }
}
