/**
 * PRACTITIONER-SESSION-OWNERSHIP-01 — supervision family · a session is reachable only by its owner.
 *
 * Fourteen /api/supervision handlers address a session by id (`session/[id]` GET/PATCH/DELETE and
 * `/essence`, `session/stop`, `insights/list`, `insights/stream`, `scribe`, `transcript/list` GET and
 * POST, `transcript/stream` POST and GET), one lists sessions (`sessions`) and one creates them
 * (`session/start`). Before this change they accepted any authenticated practitioner (or, for most,
 * nobody) and answered for ANY session id: transcripts, essence summaries, live streams, stop and
 * DELETE. The list returned every practitioner's sessions; start read its owner from the request body
 * and its recorders never sent one, so most rows were created with no owner at all.
 *
 * Policy (founder-delegated 2026-11-17, FAIL CLOSED, RECOVERABLE):
 *   P1  owner-only; a non-owner and an absent id are indistinguishable (404, same body)
 *   P2  every created session is owned by the SESSION member
 *   P3  a legacy session whose owner is NULL is reachable by nobody
 *   P4  DELETE is owner-only (no admin gate exists under supervision to defer to)
 *   P5  the list returns only the session member's own sessions
 *
 * ⛔ EVIDENCE CLASS: every STORE here is a fake. The ownership lookup is the REAL
 * `requireOwnedSession` over `FakeDb.query`, which evaluates the statement it is handed and refuses any
 * shape it does not model. The SQL is separately run on a throwaway PostgreSQL 16 (reported in the commit
 * message, not committed).
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  FakeDb,
  IDS,
  LEGACY_SECRET,
  MEMBER_A,
  MEMBER_B,
  SECRET,
  TOKEN_A,
  exerciseCreate,
  exerciseList,
  exerciseOwnership,
  type CreateOp,
  type ListOp,
  type OwnershipOp,
  type OwnershipWorld,
} from '@/tests/support/sessionOwnershipHarness';

const db = new FakeDb();
const mockQuery = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown>>();
jest.mock('@/lib/db/postgres', () => ({
  __esModule: true,
  default: { query: (sql: string, params?: unknown[]) => mockQuery(sql, params) },
  query: (sql: string, params?: unknown[]) => mockQuery(sql, params),
}));
jest.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

/* ── the world behind the stores ─────────────────────────────────────────────── */

type Seg = { id: string; session_id: string; text: string };

let segments: Seg[] = [];
let calls = 0;
let touchedIds = new Set<string>();
let created: Array<{ practitioner_id: string | null }> = [];
/** the member the Lab Tools gate resolved (cookie session); null = signed out */
let labActor: string | null = null;

function seed(): void {
  db.reset();
  segments = db.sessions.map((s) => ({ id: `seg-${s.id}`, session_id: s.id, text: `transcript of ${s.title}` }));
  calls = 0;
  touchedIds = new Set<string>();
  created = [];
  labActor = null;
}
function hit(sessionId: unknown): void {
  calls++;
  if (typeof sessionId === 'string') touchedIds.add(sessionId);
}

const isOwnershipLookup = (sql: string) => /^SELECT id, '\w+' AS source FROM /i.test(sql);

const world: OwnershipWorld = {
  db,
  seed,
  snapshot: () => JSON.stringify({ sessions: db.sessions, segments }),
  // a refused request must also issue no statement OTHER than the ownership lookup
  storeCalls: () => calls + db.issued.filter((q) => !isOwnershipLookup(q.sql)).length,
  touched: () => {
    const t = new Set(touchedIds);
    for (const q of db.issued) {
      if (isOwnershipLookup(q.sql)) continue;
      for (const p of q.params) if (typeof p === 'string') t.add(p);
    }
    return t;
  },
};

const supSession = (id: string) => {
  const s = db.sessions.find((x) => x.id === id && x.kind === 'supervision');
  return s
    ? {
        id: s.id, practitioner_id: s.practitioner_id, case_id: null, session_type: 'consultation', title: s.title,
        started_at: 't0', ended_at: s.ended_at, recording_path: null, transcript_path: null,
        processing_status: s.processing_status, total_duration_ms: null, speaker_count: null, metadata: {},
        created_at: 't0', updated_at: 't0', transcript_count: 0,
      }
    : null;
};

jest.mock('@/lib/supervision/SupervisionStore', () => ({
  __esModule: true,
  createSession: async (p: { practitionerId?: string; title?: string }) => {
    calls++;
    const row = {
      id: `e0000000-0000-4000-8000-${String(db.sessions.length).padStart(12, '0')}`,
      kind: 'supervision' as const,
      practitioner_id: p.practitionerId || null,
      title: p.title ?? 'new',
      ended_at: null,
      processing_status: 'recording',
    };
    db.sessions.push(row);
    created.push({ practitioner_id: row.practitioner_id });
    return { ...supSession(row.id)!, session_type: 'consultation' };
  },
  // like the real store: with no practitionerId there is NO filter at all
  listSessions: async (p: { practitionerId?: string }) => {
    calls++;
    return db.sessions
      .filter((s) => s.kind === 'supervision' && (!p.practitionerId || s.practitioner_id === p.practitionerId))
      .map((s) => supSession(s.id)!);
  },
  getActiveSession: async () => { calls++; return null; },
  getSession: async (id: string) => { hit(id); return supSession(id); },
  updateSession: async (id: string, u: { processing_status?: string }) => {
    hit(id);
    const s = db.sessions.find((x) => x.id === id && x.kind === 'supervision');
    if (!s) return null;
    if (u.processing_status) s.processing_status = u.processing_status;
    return supSession(id);
  },
  stopSession: async (id: string) => {
    hit(id);
    const s = db.sessions.find((x) => x.id === id && x.kind === 'supervision' && x.ended_at === null);
    if (!s) return null;
    s.ended_at = 'now'; s.processing_status = 'processing';
    return supSession(id);
  },
  getTranscript: async (id: string) => { hit(id); return segments.filter((x) => x.session_id === id).map((x) => ({ ...x, speaker: 's', start_ms: 0, end_ms: 1 })); },
  getRecentTranscript: async (id: string) => { hit(id); return []; },
  getTranscriptSegments: async (id: string) => { hit(id); return segments.filter((x) => x.session_id === id).map((x) => ({ ...x, speaker: 's', start_ms: 0, end_ms: 1 })); },
  addTranscriptSegment: async (p: { sessionId: string; text: string }) => {
    hit(p.sessionId);
    const row = { id: `seg-new-${segments.length}`, session_id: p.sessionId, text: p.text };
    segments.push(row);
    return { ...row, speaker: 's', start_ms: 0, end_ms: 1 };
  },
  getInsights: async (id: string) => { hit(id); return []; },
  getInsightsSince: async (id: string) => { hit(id); return []; },
  getJobsForSession: async (id: string) => { hit(id); return []; },
  enqueueJob: async (p: { sessionId: string }) => { hit(p.sessionId); },
  getRecentTranscriptTexts: async (id: string) => { hit(id); return []; },
  getLastChunkTail: async (id: string) => { hit(id); return null; },
}));
jest.mock('@/lib/supervision/SessionSynthesizer', () => ({
  __esModule: true,
  getEssenceSummary: async (id: string) => { hit(id); return null; },
  runSessionSynthesis: async (id: string) => { hit(id); return null; },
}));
jest.mock('@/lib/supervision/ClinicalSupervisionEngine', () => ({
  __esModule: true,
  analyzeSession: async (id: string) => { hit(id); return []; },
  analyzeRecentActivity: async (id: string) => { hit(id); return []; },
}));
jest.mock('@/lib/supervision/transcriptAssembler', () => ({
  __esModule: true,
  runAssembly: async (id: string) => { hit(id); },
}));
jest.mock('@/lib/supervision/segmentGate', () => ({
  __esModule: true,
  flushPendingCandidate: (id: string) => { hit(id); return { shouldFinalize: false }; },
  evaluate: () => ({ shouldFinalize: false }),
}));
jest.mock('@/lib/scribe/transcriptCleaner', () => ({
  __esModule: true,
  isLikelyPhantomDuplicate: () => false,
}));
jest.mock('@/lib/access/labAccess', () => ({
  __esModule: true,
  requireLabAccess: async () =>
    labActor
      ? { ok: true, memberId: labActor }
      : { ok: false, status: 401, error: 'Authentication required' },
}));

beforeEach(() => {
  seed();
  process.env.ALLOW_AUDIO_UPLOADS = 'true';
  mockQuery.mockReset();
  mockQuery.mockImplementation((sql, params) => db.query(sql, params ?? []));
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

/* ── request plumbing ───────────────────────────────────────────────────────── */

type Ctx = { params: Promise<{ id: string }> };
type Handler = (req: NextRequest, ctx?: Ctx) => Promise<Response>;
type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type Claim = { memberId?: string; practitionerId?: string };
type Spec = {
  name: string;
  method: Method;
  route: string; // relative to app/api/supervision
  okStatus?: number;
  /** the id travels in the path segment `[id]` */
  pathId?: boolean;
  stream?: boolean;
  multipart?: boolean;
  lab?: boolean;
  build: (a: { sessionId: string; claim: Claim }) => { query?: Record<string, string>; body?: unknown };
};

async function loadHandler(route: string, method: Method): Promise<Handler> {
  const mod = (await import(`../${route}/route`)) as Record<string, unknown>;
  return mod[method] as Handler;
}

type Call = { sessionId: string; token?: string; headers?: Record<string, string>; claim?: Claim };

function fakeRequest(spec: Pick<Spec, 'route' | 'build' | 'multipart'>, a: Call, signal?: AbortSignal): NextRequest {
  const headers = new Headers(a.headers ?? {});
  if (a.token) headers.set('x-session-token', a.token);
  const { query, body } = spec.build({ sessionId: a.sessionId, claim: a.claim ?? {} });
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  const url = `https://soullab.life/api/supervision/${spec.route}${qs}`;
  const req: Record<string, unknown> = { headers, url, nextUrl: new URL(url), signal: signal ?? new AbortController().signal };
  if (spec.multipart) {
    headers.set('content-type', 'multipart/form-data; boundary=x');
    req.formData = async () => body as FormData;
  } else {
    req.json = async () => body ?? {};
  }
  return req as unknown as NextRequest;
}

/** invoke one handler; a live stream is aborted as soon as its first answer is in (its timers die with the signal) */
async function call(spec: Spec, h: Handler, a: Call): Promise<Response> {
  if (spec.lab) labActor = a.token === TOKEN_A ? MEMBER_A : null;
  const ac = new AbortController();
  const req = fakeRequest(spec, a, ac.signal);
  const res = await h(req, spec.pathId ? { params: Promise.resolve({ id: a.sessionId }) } : undefined);
  if (spec.stream) ac.abort();
  return res;
}

function opFor(spec: Spec, h: Handler): OwnershipOp {
  return {
    name: spec.name,
    kinds: ['supervision'],
    okStatus: spec.okStatus ?? 200,
    okProof: spec.stream ? 'status' : 'touched',
    skipO5: spec.lab ? 'the Lab Tools gate reads the cookie session and ignores x-member-id claims by design' : undefined,
    invoke: (a) => call(spec, h, a),
  };
}

const claimQuery = (c: Claim): Record<string, string> => {
  const q: Record<string, string> = {};
  if (c.memberId) q.memberId = c.memberId;
  if (c.practitionerId) q.practitionerId = c.practitionerId;
  return q;
};

function audioForm(sessionId: string): FormData {
  const fd = new FormData();
  if (sessionId) fd.append('sessionId', sessionId);
  // 100 bytes: below the route's silence gate, so a lawful call returns without reaching Whisper
  fd.append('audio', new Blob([new Uint8Array(100)], { type: 'audio/webm' }), 'chunk.webm');
  fd.append('startMs', '0');
  fd.append('endMs', '1000');
  return fd;
}

const SPECS: Spec[] = [
  { name: 'GET  /session/[id]', method: 'GET', route: 'session/[id]', pathId: true,
    build: ({ claim }) => ({ query: claimQuery(claim) }) },
  { name: 'GET  /session/[id]?transcript&insights&jobs', method: 'GET', route: 'session/[id]', pathId: true,
    build: ({ claim }) => ({ query: { transcript: 'true', insights: 'true', jobs: 'true', ...claimQuery(claim) } }) },
  { name: 'PATCH /session/[id]', method: 'PATCH', route: 'session/[id]', pathId: true,
    build: ({ claim }) => ({ query: claimQuery(claim), body: { title: 'renamed', processingStatus: 'complete' } }) },
  { name: 'DELETE /session/[id]', method: 'DELETE', route: 'session/[id]', pathId: true,
    build: ({ claim }) => ({ query: claimQuery(claim) }) },
  { name: 'GET  /session/[id]/essence', method: 'GET', route: 'session/[id]/essence', pathId: true,
    build: ({ claim }) => ({ query: claimQuery(claim) }) },
  { name: 'POST /session/stop', method: 'POST', route: 'session/stop',
    build: ({ sessionId, claim }) => ({ body: { sessionId, triggerAnalysis: false, ...claim } }) },
  { name: 'GET  /insights/list', method: 'GET', route: 'insights/list',
    build: ({ sessionId, claim }) => ({ query: { sessionId, ...claimQuery(claim) } }) },
  { name: 'GET  /insights/stream (SSE)', method: 'GET', route: 'insights/stream', stream: true,
    build: ({ sessionId, claim }) => ({ query: { sessionId, ...claimQuery(claim) } }) },
  { name: 'GET  /scribe (SSE)', method: 'GET', route: 'scribe', stream: true,
    build: ({ sessionId, claim }) => ({ query: { sessionId, ...claimQuery(claim) } }) },
  { name: 'GET  /transcript/list (Lab Tools)', method: 'GET', route: 'transcript/list', lab: true,
    build: ({ sessionId, claim }) => ({ query: { sessionId, ...claimQuery(claim) } }) },
  { name: 'POST /transcript/list', method: 'POST', route: 'transcript/list',
    build: ({ sessionId, claim }) => ({ body: { sessionId, speaker: 'practitioner', startMs: 0, endMs: 900, text: 'a new line', ...claim } }) },
  { name: 'POST /transcript/stream (audio chunk)', method: 'POST', route: 'transcript/stream', multipart: true,
    build: ({ sessionId }) => ({ body: audioForm(sessionId) }) },
  { name: 'GET  /transcript/stream (SSE)', method: 'GET', route: 'transcript/stream', stream: true,
    build: ({ sessionId, claim }) => ({ query: { sessionId, ...claimQuery(claim) } }) },
];

const specNamed = (n: string) => SPECS.find((s) => s.name === n)!;

/* ── the real routes ────────────────────────────────────────────────────────── */

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · supervision — every session-addressed handler is owner-only', () => {
  it.each(SPECS.map((s) => [s.name, s] as const))('%s', async (_name, spec) => {
    const handler = await loadHandler(spec.route, spec.method);
    expect(await exerciseOwnership(spec.name, opFor(spec, handler), world)).toEqual([]);
  });

  it('POST /transcript/list refuses the WHOLE batch when any segment names a session that is not the practitioner\'s (no partial write)', async () => {
    const spec = specNamed('POST /transcript/list');
    const handler = await loadHandler(spec.route, spec.method);
    seed();
    const mixed: Spec = { ...spec, build: () => ({ body: [
      { sessionId: IDS.supervision.mine, speaker: 's', startMs: 0, endMs: 1, text: 'mine' },
      { sessionId: IDS.supervision.theirs, speaker: 's', startMs: 0, endMs: 1, text: 'into B' },
    ] }) };
    const before = world.snapshot();
    const res = await handler(fakeRequest(mixed, { sessionId: '', token: TOKEN_A }));
    expect(res.status).toBe(404);
    expect(world.snapshot()).toBe(before);
    expect(calls).toBe(0);
  });

  it('POST /transcript/list accepts a batch whose every segment is the practitioner\'s own', async () => {
    const spec = specNamed('POST /transcript/list');
    const handler = await loadHandler(spec.route, spec.method);
    seed();
    const own: Spec = { ...spec, build: () => ({ body: [
      { sessionId: IDS.supervision.mine, speaker: 's', startMs: 0, endMs: 1, text: 'one' },
      { sessionId: IDS.supervision.mine, speaker: 's', startMs: 1, endMs: 2, text: 'two' },
    ] }) };
    const res = await handler(fakeRequest(own, { sessionId: '', token: TOKEN_A }));
    expect(res.status).toBe(200);
    expect(segments.filter((s) => s.session_id === IDS.supervision.mine && /^(one|two)$/.test(s.text))).toHaveLength(2);
  });

  it('session/stop makes no side effect (flush, assembly) for a session that is not the practitioner\'s', async () => {
    const spec = specNamed('POST /session/stop');
    const handler = await loadHandler(spec.route, spec.method);
    seed();
    const res = await handler(fakeRequest(spec, { sessionId: IDS.supervision.theirs, token: TOKEN_A }));
    expect(res.status).toBe(404);
    expect(calls).toBe(0); // flushPendingCandidate / runAssembly / stopSession all count as calls
  });

  it('a refused request issues NO statement beyond the one ownership lookup', async () => {
    const spec = specNamed('GET  /session/[id]');
    const handler = await loadHandler(spec.route, spec.method);
    seed();
    await call(spec, handler, { sessionId: IDS.supervision.theirs, token: TOKEN_A });
    expect(db.issued).toHaveLength(1);
    expect(db.issued[0]!.params).toEqual([IDS.supervision.theirs, MEMBER_A]);
  });

  it('DELETE carries the owner IN THE SQL: `id = $1 AND practitioner_id = $2`, params [id, session member]', async () => {
    const spec = specNamed('DELETE /session/[id]');
    const handler = await loadHandler(spec.route, spec.method);
    seed();
    const res = await call(spec, handler, { sessionId: IDS.supervision.mine, token: TOKEN_A, claim: { memberId: MEMBER_B, practitionerId: MEMBER_B } });
    expect(res.status).toBe(200);
    const del = db.issued.filter((q) => /^DELETE /i.test(q.sql));
    expect(del).toHaveLength(1);
    expect(del[0]!.sql).toMatch(/WHERE id = \$1 AND practitioner_id = \$2/);
    expect(del[0]!.params).toEqual([IDS.supervision.mine, MEMBER_A]);
    expect(db.sessions.some((s) => s.id === IDS.supervision.mine)).toBe(false);
    for (const other of [IDS.supervision.theirs, IDS.supervision.unowned]) expect(db.sessions.some((s) => s.id === other)).toBe(true);
  });

  it('PATCH title is owner-scoped in the SQL too: `id = $2 AND practitioner_id = $3`', async () => {
    const spec = specNamed('PATCH /session/[id]');
    const handler = await loadHandler(spec.route, spec.method);
    seed();
    await call(spec, handler, { sessionId: IDS.supervision.mine, token: TOKEN_A });
    const upd = db.issued.filter((q) => /^UPDATE supervision_sessions SET title/i.test(q.sql));
    expect(upd).toHaveLength(1);
    expect(upd[0]!.sql).toMatch(/WHERE id = \$2 AND practitioner_id = \$3/);
    expect(upd[0]!.params).toEqual(['renamed', IDS.supervision.mine, MEMBER_A]);
  });

  it('a second session can be started while one is active (the old 409 lived behind the body identity this change closes; it is not extended into a lockout)', async () => {
    const handler = await loadHandler('session/start', 'POST');
    const spec: Spec = { name: 'start', method: 'POST', route: 'session/start', build: () => ({ body: { sessionType: 'live_scribe', title: 't' } }) };
    seed();
    expect((await call(spec, handler, { sessionId: '', token: TOKEN_A })).status).toBe(200);
    expect((await call(spec, handler, { sessionId: '', token: TOKEN_A })).status).toBe(200);
    expect(created.map((c) => c.practitioner_id)).toEqual([MEMBER_A, MEMBER_A]);
  });

  it('an owned session of the signed-in practitioner behaves as before (GET returns it, transcript included)', async () => {
    const spec = specNamed('GET  /session/[id]?transcript&insights&jobs');
    const handler = await loadHandler(spec.route, spec.method);
    seed();
    const res = await call(spec, handler, { sessionId: IDS.supervision.mine, token: TOKEN_A });
    const body = await res.json() as { session: { id: string; title: string }; transcript: Array<{ text: string }> };
    expect(body.session.id).toBe(IDS.supervision.mine);
    expect(body.transcript.map((t) => t.text)).toEqual(['transcript of supervision-session-of-A']);
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(JSON.stringify(body)).not.toContain(LEGACY_SECRET);
  });
});

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · supervision — the list is the session practitioner\'s own (P5)', () => {
  const listSpec: Spec = { name: 'GET /sessions', method: 'GET', route: 'sessions', build: ({ claim }) => ({ query: claimQuery(claim) }) };
  const listOp = (h: Handler): ListOp => ({
    name: listSpec.name,
    invoke: (a) => call(listSpec, h, { sessionId: '', ...a }),
    idsIn: (b) => (b as { sessions: Array<{ id: string }> }).sessions.map((s) => s.id),
  });

  it('lists only the owner\'s sessions, whatever `?practitionerId=` names, and never an unowned legacy one', async () => {
    const handler = await loadHandler('sessions', 'GET');
    expect(await exerciseList('GET /sessions', listOp(handler), world, 'supervision')).toEqual([]);
  });

  it('DC-L1 the shipped defect: `?practitionerId=` is the filter, and with none it lists EVERY session', async () => {
    const wrong: Handler = async (req) => {
      const { getMemberIdFromRequest } = await import('@/lib/auth/getMemberFromRequest');
      if (!(await getMemberIdFromRequest(req))) return NextResponse.json({ success: false }, { status: 401 });
      const { listSessions } = await import('@/lib/supervision/SupervisionStore');
      const sessions = await listSessions({ practitionerId: new URL(req.url).searchParams.get('practitionerId') || undefined });
      return NextResponse.json({ success: true, sessions });
    };
    const v = await exerciseList('DC-L1', listOp(wrong), world, 'supervision');
    expect(v.some((m) => m.includes('L1(no claim)'))).toBe(true);
    expect(v.some((m) => m.includes('L1(claim names B)'))).toBe(true);
  });

  it('DC-L2 session identity, but the list is not filtered by it (lists everything)', async () => {
    const wrong: Handler = async (req) => {
      const { getMemberIdFromRequest } = await import('@/lib/auth/getMemberFromRequest');
      if (!(await getMemberIdFromRequest(req))) return NextResponse.json({ success: false }, { status: 401 });
      const { listSessions } = await import('@/lib/supervision/SupervisionStore');
      return NextResponse.json({ success: true, sessions: await listSessions({}) });
    };
    const v = await exerciseList('DC-L2', listOp(wrong), world, 'supervision');
    expect(v.some((m) => m.includes('not the owner') || m.includes('listed'))).toBe(true);
  });

  it('DC-L3 the list is filtered to the owner OR to unowned rows (legacy rows leak into everyone\'s list)', async () => {
    const wrong: Handler = async (req) => {
      const { getMemberIdFromRequest } = await import('@/lib/auth/getMemberFromRequest');
      const me = await getMemberIdFromRequest(req);
      if (!me) return NextResponse.json({ success: false }, { status: 401 });
      const { listSessions } = await import('@/lib/supervision/SupervisionStore');
      const all = (await listSessions({})) as Array<{ practitioner_id: string | null }>;
      return NextResponse.json({ success: true, sessions: all.filter((s) => s.practitioner_id === null || s.practitioner_id === me) });
    };
    const v = await exerciseList('DC-L3', listOp(wrong), world, 'supervision');
    expect(v.some((m) => m.includes('unowned legacy session was listed'))).toBe(true);
  });
});

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · supervision — a new session is owned by the SESSION member (P2)', () => {
  const startSpec: Spec = {
    name: 'POST /session/start', method: 'POST', route: 'session/start',
    build: ({ claim }) => ({ body: { sessionType: 'live_scribe', title: 'Live', ...claim } }),
  };
  const createOp = (h: Handler): CreateOp => ({
    name: startSpec.name,
    invoke: (a) => call(startSpec, h, { sessionId: '', ...a }),
    createdOwner: () => created[created.length - 1]?.practitioner_id,
    createdCount: () => created.length,
  });

  it('refuses without a session and records the session member as the owner, whatever the body names', async () => {
    const handler = await loadHandler('session/start', 'POST');
    expect(await exerciseCreate('POST /session/start', createOp(handler), world)).toEqual([]);
  });

  it('DC-C1 the shipped defect: the owner is `body.practitionerId`, and absent when none is sent', async () => {
    const wrong: Handler = async (req) => {
      const body = (await req.json()) as { practitionerId?: string };
      const { createSession } = await import('@/lib/supervision/SupervisionStore');
      const s = await createSession({ practitionerId: body.practitionerId, sessionType: 'live_scribe' } as never);
      return NextResponse.json({ success: true, session: { id: (s as { id: string }).id } });
    };
    const v = await exerciseCreate('DC-C1', createOp(wrong), world);
    expect(v.some((m) => m.includes('C0'))).toBe(true);
    expect(v.some((m) => m.includes('C1(no claim)') && m.includes('NO owner'))).toBe(true);
    expect(v.some((m) => m.includes('C1(claim names B)'))).toBe(true);
  });

  it('DC-C2 authenticated, but the body identity wins over the session', async () => {
    const wrong: Handler = async (req) => {
      const { getMemberIdFromRequest } = await import('@/lib/auth/getMemberFromRequest');
      const me = await getMemberIdFromRequest(req);
      if (!me) return NextResponse.json({ success: false }, { status: 401 });
      const body = (await req.json()) as { practitionerId?: string };
      const { createSession } = await import('@/lib/supervision/SupervisionStore');
      await createSession({ practitionerId: body.practitionerId ?? me, sessionType: 'live_scribe' } as never);
      return NextResponse.json({ success: true });
    };
    const v = await exerciseCreate('DC-C2', createOp(wrong), world);
    expect(v.some((m) => m.includes('C1(claim names B)'))).toBe(true);
  });

  it('DC-C3 authenticated, but the session is created with NO owner', async () => {
    const wrong: Handler = async (req) => {
      const { getMemberIdFromRequest } = await import('@/lib/auth/getMemberFromRequest');
      if (!(await getMemberIdFromRequest(req))) return NextResponse.json({ success: false }, { status: 401 });
      const { createSession } = await import('@/lib/supervision/SupervisionStore');
      await createSession({ sessionType: 'live_scribe' } as never);
      return NextResponse.json({ success: true });
    };
    const v = await exerciseCreate('DC-C3', createOp(wrong), world);
    expect(v.some((m) => m.includes('NO owner'))).toBe(true);
  });
});

/* ── LETHALITY: wrong handlers, each of which must be caught ───────────────── */

async function sessionMember(req: NextRequest): Promise<string | null> {
  const { getMemberIdFromRequest } = await import('@/lib/auth/getMemberFromRequest');
  return getMemberIdFromRequest(req);
}
const notFound = () => NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
const unauthorized = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · supervision — defeat candidates (each must be caught)', () => {
  const getSpec = specNamed('GET  /session/[id]');
  const delSpec = specNamed('DELETE /session/[id]');
  const run = (label: string, spec: Spec, h: Handler) => exerciseOwnership(label, opFor(spec, h), world);

  /** GET /session/[id] with the ownership rule under test */
  const wrongGet = (gate: (me: string, row: ReturnType<typeof supSession>) => Response | undefined): Handler =>
    async (req, ctx) => {
      const me = await sessionMember(req);
      if (!me) return unauthorized();
      const { id } = await ctx!.params;
      const { getSession } = await import('@/lib/supervision/SupervisionStore');
      const row = db.sessions.find((s) => s.id === id && s.kind === 'supervision');
      const refused = gate(me, row ? supSession(row.id) : null);
      if (refused) return refused;
      const s = await getSession(id);
      return s ? NextResponse.json({ success: true, session: { id: s.id, title: s.title } }) : notFound();
    };

  it('control: a correct owner-only GET is clean under the same checker', async () => {
    expect(await run('CONTROL', getSpec, wrongGet((me, row) => (row && row.practitioner_id === me ? undefined : notFound())))).toEqual([]);
  });

  it('DC-S1 session id only: an authenticated practitioner reads any session', async () => {
    const v = await run('DC-S1', getSpec, wrongGet(() => undefined));
    expect(v.some((m) => m.includes('O1'))).toBe(true);
    expect(v.some((m) => m.includes('O3'))).toBe(true);
  });

  it('DC-S2 existence oracle: 403 when the session exists and is not yours, 404 when it does not', async () => {
    const v = await run('DC-S2', getSpec, wrongGet((me, row) => {
      if (!row) return notFound();
      return row.practitioner_id === me ? undefined : NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }));
    expect(v.some((m) => m.includes('distinguishable'))).toBe(true);
  });

  it('DC-S3 an unowned legacy session is allowed through', async () => {
    const v = await run('DC-S3', getSpec, wrongGet((me, row) => (row && (row.practitioner_id === null || row.practitioner_id === me) ? undefined : notFound())));
    expect(v.some((m) => m.includes('O3'))).toBe(true);
  });

  it('DC-S4 the owner is read from the query string (`?practitionerId=`), not the session', async () => {
    const v = await run('DC-S4', getSpec, async (req, ctx) => {
      const me = await sessionMember(req);
      if (!me) return unauthorized();
      const owner = new URL(req.url).searchParams.get('practitionerId') ?? me;
      const { id } = await ctx!.params;
      const row = db.sessions.find((s) => s.id === id && s.kind === 'supervision');
      if (!row || row.practitioner_id !== owner) return notFound();
      const { getSession } = await import('@/lib/supervision/SupervisionStore');
      return NextResponse.json({ success: true, session: await getSession(id) });
    });
    expect(v.some((m) => m.includes('O1'))).toBe(true);
  });

  it('DC-D1 DELETE with the shipped shape: session exists → `DELETE … WHERE id = $1`, no owner anywhere', async () => {
    const v = await run('DC-D1', delSpec, async (req, ctx) => {
      const me = await sessionMember(req);
      if (!me) return unauthorized();
      const { id } = await ctx!.params;
      const { getSession } = await import('@/lib/supervision/SupervisionStore');
      if (!(await getSession(id))) return notFound();
      await db.query('DELETE FROM supervision_sessions WHERE id = $1', [id]);
      return NextResponse.json({ success: true });
    });
    expect(v.some((m) => m.includes('O1'))).toBe(true);
    expect(v.some((m) => m.includes('changed data'))).toBe(true);
  });

  it('DC-D2 DELETE guarded by a prior read, then an UNSCOPED statement: behaviourally equal on a quiet database, so it is caught by the SQL pin', async () => {
    const wrong: Handler = async (req, ctx) => {
      const me = await sessionMember(req);
      if (!me) return unauthorized();
      const { id } = await ctx!.params;
      const row = db.sessions.find((s) => s.id === id && s.kind === 'supervision');
      if (!row || row.practitioner_id !== me) return notFound();
      await db.query('DELETE FROM supervision_sessions WHERE id = $1', [id]);
      return NextResponse.json({ success: true });
    };
    seed();
    expect((await call(delSpec, wrong, { sessionId: IDS.supervision.mine, token: TOKEN_A })).status).toBe(200);
    const del = db.issued.filter((q) => /^DELETE /i.test(q.sql));
    // the pin the real route must satisfy (see "DELETE carries the owner IN THE SQL" above) — this candidate does not
    expect(/WHERE id = \$1 AND practitioner_id = \$2/.test(del[0]!.sql)).toBe(false);
  });

  it('DC-D3 DELETE ownership checked AFTER the delete: the row is gone when it is refused', async () => {
    const v = await run('DC-D3', delSpec, async (req, ctx) => {
      const me = await sessionMember(req);
      if (!me) return unauthorized();
      const { id } = await ctx!.params;
      const row = db.sessions.find((s) => s.id === id && s.kind === 'supervision');
      await db.query('DELETE FROM supervision_sessions WHERE id = $1', [id]);
      return row && row.practitioner_id === me ? NextResponse.json({ success: true }) : notFound();
    });
    expect(v.some((m) => m.includes('changed data') || m.includes('reached a store'))).toBe(true);
  });

  it('DC-T1 a transcript write that checks only the FIRST segment of a batch', async () => {
    const spec = specNamed('POST /transcript/list');
    const wrong: Handler = async (req) => {
      const me = await sessionMember(req);
      if (!me) return unauthorized();
      const raw = (await req.json()) as unknown;
      const segs = (Array.isArray(raw) ? raw : [raw]) as Array<{ sessionId: string; text: string }>;
      const first = db.sessions.find((s) => s.id === segs[0]!.sessionId && s.kind === 'supervision');
      if (!first || first.practitioner_id !== me) return notFound();
      const { addTranscriptSegment } = await import('@/lib/supervision/SupervisionStore');
      for (const s of segs) await addTranscriptSegment({ sessionId: s.sessionId, text: s.text } as never);
      return NextResponse.json({ success: true });
    };
    // the single-id harness cases pass (one segment); the BATCH case below is what catches it
    expect(await exerciseOwnership('DC-T1', opFor(spec, wrong), world)).toEqual([]);
    const handler = wrong;
    seed();
    const mixed: Spec = { ...spec, build: () => ({ body: [
      { sessionId: IDS.supervision.mine, speaker: 's', startMs: 0, endMs: 1, text: 'mine' },
      { sessionId: IDS.supervision.theirs, speaker: 's', startMs: 0, endMs: 1, text: 'into B' },
    ] }) };
    const res = await handler(fakeRequest(mixed, { sessionId: '', token: TOKEN_A }));
    expect(res.status).toBe(200); // the wrong handler wrote into B's session
    expect(segments.some((s) => s.session_id === IDS.supervision.theirs && s.text === 'into B')).toBe(true);
  });

  it('DC-N1 no authentication at all (the shipped state of insights/list, scribe, session/stop …)', async () => {
    const spec = specNamed('GET  /insights/list');
    const v = await run('DC-N1', spec, async (req) => {
      const sessionId = new URL(req.url).searchParams.get('sessionId')!;
      const { getSession, getInsights } = await import('@/lib/supervision/SupervisionStore');
      const s = await getSession(sessionId);
      if (!s) return notFound();
      return NextResponse.json({ success: true, insights: await getInsights(sessionId) });
    });
    expect(v.some((m) => m.includes('O0'))).toBe(true);
    expect(v.some((m) => m.includes('O1'))).toBe(true);
  });
});

