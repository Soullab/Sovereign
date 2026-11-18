/**
 * WS-RELATIONAL-ARCHITECTURE step 4 — the editorial pass as a server run.
 * Founder ruling 2026-11-17: resume on request only. The run advances while a page is watching; with no page watching it stops
 * before its next paid step, and the writer's Continue resumes it. Finished readings are kept and never paid for twice.
 *   GET     the run's true state ("5 of 9 readings done"). Only looks: it never starts or continues paid work. It counts the page as
 *           watching, and settles a run nothing is advancing (a restart) as stopped, so the page offers Continue.
 *   POST    the writer starts, or continues, a run. Keep gate first: nothing is started in Sanctuary.
 *   DELETE  the writer cancels the run; it reads nothing more.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ageGateForManuscript, ageGateRefusal } from '@/lib/studios/workAgeGate';
import { getMemberIdFromRequest } from '@/lib/auth/getMemberFromRequest';
import { keepGate } from '@/lib/sanctuary/keepGate';
import { advanceRun, cancelRun, noteWatching, settleStranded, startRun, viewRun } from '@/lib/writersStudio/studio/passRun';
import { WHOLE_WORK_REFUSAL } from '@/lib/writersStudio/wholeWorkAccess';
import { meteredRoute, bindMaiaMeter } from '@/lib/writersStudio/maiaMeter';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function member(req: NextRequest, params: Promise<{ id: string }>) {
  const memberId = await getMemberIdFromRequest(req);
  const { id } = await params;
  return { memberId, id };
}

async function getHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { memberId, id } = await member(req, params);
  if (!memberId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!UUID.test(id)) return NextResponse.json({ refusal: 'not_found' }, { status: 404 });
  bindMaiaMeter(memberId, { sanctuary: false });
  /* Founder ruling 2026-11-16 (#1900): on a program that requires it, MAIA does not read or answer without the age attestation. */
  { const age = await ageGateForManuscript(memberId, id); if (!age.ok) { const r = ageGateRefusal(age); return NextResponse.json(r.body, { status: r.status }); } }
  noteWatching(memberId, id);
  /* Opening the page never continues paid work (ruling 2026-11-17). A run nothing is advancing is shown as stopped, with Continue. */
  const run = await settleStranded(memberId, id);
  return NextResponse.json({ run });
}

export const GET = meteredRoute('editorial_pass', getHandler);

async function postHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { memberId, id } = await member(req, params);
  if (!memberId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!UUID.test(id)) return NextResponse.json({ refusal: 'not_found' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const gate = await keepGate(memberId, body);
  if (gate) return gate;
  bindMaiaMeter(memberId, { sanctuary: false });
  /* Founder ruling 2026-11-16 (#1900): on a program that requires it, MAIA does not read or answer without the age attestation. */
  { const age = await ageGateForManuscript(memberId, id); if (!age.ok) { const r = ageGateRefusal(age); return NextResponse.json(r.body, { status: r.status }); } }
  noteWatching(memberId, id);
  const out = await startRun(memberId, id);
  if (!out.ok) {
    const status = out.refusal === 'daily_limit' ? 429 : out.refusal === WHOLE_WORK_REFUSAL ? 403 : 409;
    return NextResponse.json({ refusal: out.refusal }, { status });
  }
  void advanceRun(memberId, id).catch(() => undefined);
  return NextResponse.json({ runId: out.runId, resumed: out.resumed, run: await viewRun(memberId, id) }, { status: 202 });
}

export const POST = meteredRoute('editorial_pass', postHandler);

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { memberId, id } = await member(req, params);
  if (!memberId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!UUID.test(id)) return NextResponse.json({ refusal: 'not_found' }, { status: 404 });
  return NextResponse.json({ cancelled: await cancelRun(memberId, id) });
}
