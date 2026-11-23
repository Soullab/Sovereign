/**
 * PRACTITIONER-SESSION-OWNERSHIP-01 — practice family · a session is reachable only by its owner.
 *
 * Thirteen /api/practice handlers address a session by id alone (`insights/generate` GET+POST,
 * `insights/list` GET+POST, `session/stop`, `session/worlds` GET+POST, `sessions` single lookup +
 * PATCH, `transcript` GET+POST, `worlds/detect` and `worlds/suggest` with a sessionId). Before this change an
 * authenticated practitioner could read, write or stop ANY session by naming its id, including the
 * PHI transcript of someone else's client session.
 *
 * Policy (founder-delegated 2026-11-17, FAIL CLOSED, RECOVERABLE):
 *   P1  reachable only by the practitioner who owns it; a non-owner and an absent id are
 *       indistinguishable (404, same body)
 *   P3  a legacy session whose owner is NULL is reachable by nobody
 *
 * The boundary check is `tests/support/sessionOwnershipHarness.ts` (O0-O6), run against every
 * handler below and against deliberately wrong handlers that must each be caught.
 *
 * ⛔ EVIDENCE CLASS: every STORE here is a fake (the routes never reach PostgreSQL in this suite).
 * The ownership lookup itself is the REAL `requireOwnedSession` over a fake `query` that
 * evaluates the statement it is handed (see the harness); the SQL is separately run on a
 * throwaway PostgreSQL 16 and reported in the commit message, not committed.
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
  exerciseOwnership,
  type OwnershipOp,
  type OwnershipWorld,
  type SessionRow,
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
type Ins = { id: string; session_id: string; content: string };
type SW = { session_id: string; world_id: string };

let segments: Seg[] = [];
let insights: Ins[] = [];
let sessionWorlds: SW[] = [];
let calls = 0;
let touchedIds = new Set<string>();

function seed(): void {
  db.reset();
  const titleOf = (id: string) => db.sessions.find((s) => s.id === id)?.title ?? 'x';
  segments = db.sessions.map((s) => ({ id: `seg-${s.id}`, session_id: s.id, text: `transcript of ${titleOf(s.id)}` }));
  insights = db.sessions.map((s) => ({ id: `ins-${s.id}`, session_id: s.id, content: `insight about ${titleOf(s.id)}` }));
  sessionWorlds = db.sessions.map((s) => ({ session_id: s.id, world_id: 'w1' }));
  calls = 0;
  touchedIds = new Set<string>();
}

/** a store/service entry point was reached with this session id */
function hit(sessionId: unknown): void {
  calls++;
  if (typeof sessionId === 'string') touchedIds.add(sessionId);
}

const world: OwnershipWorld = {
  db,
  seed,
  snapshot: () => JSON.stringify({ sessions: db.sessions, segments, insights, sessionWorlds }),
  storeCalls: () => calls,
  touched: () => touchedIds,
};

const asPracticeSession = (id: string) => {
  const s = db.sessions.find((x) => x.id === id);
  return s ? { id: s.id, practitioner_id: s.practitioner_id, title: s.title, ended_at: s.ended_at, processing_status: s.processing_status } : null;
};

// NOTE (fake, not a model of the real store): the real `stopSession`/`updateSession` only UPDATE
// practice_sessions, so for a supervision-kind id they answer null. These fakes act on either kind so the
// ownership checks can be exercised for both; which kind a store reaches is unchanged by this change.
jest.mock('@/lib/practice/PracticeStore', () => ({
  __esModule: true,
  getSession: async (id: string) => { hit(id); return asPracticeSession(id); },
  stopSession: async (id: string) => {
    hit(id);
    const s = db.sessions.find((x) => x.id === id && x.ended_at === null);
    if (!s) return null;
    s.ended_at = 'now'; s.processing_status = 'processing';
    return asPracticeSession(id);
  },
  updateSession: async (id: string, u: { title?: string }) => {
    hit(id);
    const s = db.sessions.find((x) => x.id === id);
    if (!s) return null;
    if (u.title) s.title = u.title;
    return asPracticeSession(id);
  },
  listSessions: async () => { calls++; return []; },
  getTranscriptSegments: async (id: string) => { hit(id); return segments.filter((x) => x.session_id === id); },
  getFullTranscript: async (id: string) => { hit(id); return segments.filter((x) => x.session_id === id); },
  addTranscriptSegment: async (p: { sessionId: string; text: string }) => {
    hit(p.sessionId);
    const row = { id: `seg-new-${segments.length}`, session_id: p.sessionId, text: p.text };
    segments.push(row);
    return row;
  },
  getSessionInsights: async (id: string) => { hit(id); return insights.filter((x) => x.session_id === id); },
  getInsightsGroupedByType: async (id: string) => { hit(id); return { pattern: insights.filter((x) => x.session_id === id) }; },
  addInsight: async (p: { sessionId: string; content: string }) => {
    hit(p.sessionId);
    const row = { id: `ins-new-${insights.length}`, session_id: p.sessionId, content: p.content };
    insights.push(row);
    return row;
  },
}));
jest.mock('@/lib/practice/WorldsStore', () => ({
  __esModule: true,
  getSessionWorlds: async (id: string) => { hit(id); return sessionWorlds.filter((x) => x.session_id === id).map((x) => ({ ...x, usage_type: 'detected' })); },
  recordSessionWorld: async (p: { sessionId: string; worldId: string }) => {
    hit(p.sessionId);
    const row = { session_id: p.sessionId, world_id: p.worldId };
    sessionWorlds.push(row);
    return row;
  },
  detectWorldsInText: async () => [{ worldId: 'w1', worldCode: 'somatic', markerCount: 2 }],
  suggestWorldForContext: async () => { calls++; return { suggestedWorld: null, reason: 'ok' }; },
}));
jest.mock('@/lib/practice/InsightGenerator', () => ({
  __esModule: true,
  generateInsight: async (p: { sessionId: string }) => {
    hit(p.sessionId);
    const row = { id: 'ins-gen', session_id: p.sessionId, content: `generated from ${p.sessionId}`, world_code: 'somatic', significance: 0.5 };
    insights.push(row as unknown as Ins);
    return { success: true, insight: row, modelInfo: { source: 'local' } };
  },
  generateAllInsightsForWorld: async (sessionId: string) => {
    hit(sessionId);
    return { success: true, insights: [], errors: [] };
  },
  getSessionInsights: async (sessionId: string) => {
    hit(sessionId);
    return insights.filter((x) => x.session_id === sessionId).map((x) => ({ ...x, world_code: 'somatic', significance: 0.5 }));
  },
}));

beforeEach(() => {
  seed();
  mockQuery.mockReset();
  mockQuery.mockImplementation((sql, params) => db.query(sql, params ?? []));
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

/* ── request plumbing ───────────────────────────────────────────────────────── */

type Handler = (req: NextRequest) => Promise<Response>;
type Method = 'GET' | 'POST' | 'PATCH';

type Spec = {
  name: string;
  method: Method;
  route: string; // relative to app/api/practice
  okStatus?: number;
  /** an empty `sessionId` is "no session named": the route takes its sessionless branch (a list, a suggestion) */
  emptyIdIsList?: boolean;
  build: (a: { sessionId: string; claim: { memberId?: string; practitionerId?: string } }) => {
    query?: Record<string, string>;
    body?: Record<string, unknown>;
  };
};

async function loadHandler(route: string, method: Method): Promise<Handler> {
  const mod = (await import(`../${route}/route`)) as Record<string, unknown>;
  return mod[method] as Handler;
}

function fakeRequest(
  spec: Pick<Spec, 'route' | 'build'>,
  a: { sessionId: string; token?: string; headers?: Record<string, string>; claim?: { memberId?: string; practitionerId?: string } },
): NextRequest {
  const headers = new Headers(a.headers ?? {});
  if (a.token) headers.set('x-session-token', a.token);
  const { query, body } = spec.build({ sessionId: a.sessionId, claim: a.claim ?? {} });
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  const url = `https://soullab.life/api/practice/${spec.route}${qs}`;
  return { headers, url, nextUrl: new URL(url), json: async () => body ?? {} } as unknown as NextRequest;
}

const claimQuery = (c: { memberId?: string; practitionerId?: string }): Record<string, string> => {
  const q: Record<string, string> = {};
  if (c.memberId) q.memberId = c.memberId;
  if (c.practitionerId) q.practitionerId = c.practitionerId;
  return q;
};

function opFor(spec: Spec, handler: Handler): OwnershipOp {
  return {
    name: spec.name,
    kinds: ['practice', 'supervision'],
    okStatus: spec.okStatus ?? 200,
    emptyIdSelectsAnotherBranch: spec.emptyIdIsList ? 'an empty sessionId means no session was named: the route takes its sessionless branch' : undefined,
    invoke: (a) => handler(fakeRequest(spec, a)),
  };
}

const SPECS: Spec[] = [
  { name: 'POST /insights/generate (single)', method: 'POST', route: 'insights/generate',
    build: ({ sessionId, claim }) => ({ body: { sessionId, worldCode: 'somatic', insightType: 'somatic_cue', ...claim } }) },
  { name: 'POST /insights/generate (generateAll)', method: 'POST', route: 'insights/generate',
    build: ({ sessionId, claim }) => ({ body: { sessionId, worldCode: 'somatic', generateAll: true, ...claim } }) },
  { name: 'GET  /insights/generate', method: 'GET', route: 'insights/generate',
    build: ({ sessionId, claim }) => ({ query: { sessionId, ...claimQuery(claim) } }) },
  { name: 'GET  /insights/list', method: 'GET', route: 'insights/list',
    build: ({ sessionId, claim }) => ({ query: { sessionId, ...claimQuery(claim) } }) },
  { name: 'GET  /insights/list?grouped=true', method: 'GET', route: 'insights/list',
    build: ({ sessionId, claim }) => ({ query: { sessionId, grouped: 'true', ...claimQuery(claim) } }) },
  { name: 'POST /insights/list', method: 'POST', route: 'insights/list',
    build: ({ sessionId, claim }) => ({ body: { sessionId, insightType: 'pattern', content: 'a new insight', ...claim } }) },
  { name: 'POST /session/stop', method: 'POST', route: 'session/stop',
    build: ({ sessionId, claim }) => ({ body: { sessionId, ...claim } }) },
  { name: 'GET  /session/worlds', method: 'GET', route: 'session/worlds',
    build: ({ sessionId, claim }) => ({ query: { sessionId, ...claimQuery(claim) } }) },
  { name: 'POST /session/worlds', method: 'POST', route: 'session/worlds',
    build: ({ sessionId, claim }) => ({ body: { sessionId, worldId: 'w2', ...claim } }) },
  { name: 'GET  /sessions?sessionId= (single lookup)', method: 'GET', route: 'sessions', emptyIdIsList: true,
    build: ({ sessionId, claim }) => ({ query: { sessionId, ...claimQuery(claim) } }) },
  { name: 'PATCH /sessions', method: 'PATCH', route: 'sessions',
    build: ({ sessionId, claim }) => ({ body: { sessionId, title: 'renamed', ...claim } }) },
  { name: 'GET  /transcript (incremental)', method: 'GET', route: 'transcript',
    build: ({ sessionId, claim }) => ({ query: { sessionId, ...claimQuery(claim) } }) },
  { name: 'GET  /transcript?full=true', method: 'GET', route: 'transcript',
    build: ({ sessionId, claim }) => ({ query: { sessionId, full: 'true', ...claimQuery(claim) } }) },
  { name: 'POST /transcript', method: 'POST', route: 'transcript',
    build: ({ sessionId, claim }) => ({ body: { sessionId, speaker: 'practitioner', startMs: 0, endMs: 900, text: 'a new line', ...claim } }) },
  { name: 'POST /worlds/suggest (with a sessionId)', method: 'POST', route: 'worlds/suggest', emptyIdIsList: true,
    build: ({ sessionId, claim }) => ({ body: { transcriptSample: 'I feel it in my chest', sessionId, ...claim } }) },
  { name: 'POST /worlds/detect (record into a session)', method: 'POST', route: 'worlds/detect',
    build: ({ sessionId, claim }) => ({ body: { text: 'I feel it in my chest', sessionId, recordDetections: true, ...claim } }) },
];

/* ── the real routes ────────────────────────────────────────────────────────── */

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · practice — every session-addressed handler is owner-only', () => {
  it.each(SPECS.map((s) => [s.name, s] as const))('%s', async (_name, spec) => {
    const handler = await loadHandler(spec.route, spec.method);
    expect(await exerciseOwnership(spec.name, opFor(spec, handler), world)).toEqual([]);
  });

  it('POST /worlds/detect without a sessionId is pure text detection: needs the session, touches no session row', async () => {
    const handler = await loadHandler('worlds/detect', 'POST');
    const spec: Pick<Spec, 'route' | 'build'> = { route: 'worlds/detect', build: () => ({ body: { text: 'hello' } }) };
    seed();
    expect((await handler(fakeRequest(spec, { sessionId: '' }))).status).toBe(401);
    const ok = await handler(fakeRequest(spec, { sessionId: '', token: TOKEN_A }));
    expect(ok.status).toBe(200);
    expect(touchedIds.size).toBe(0);
  });

  it('POST /worlds/detect with a sessionId that is not the practitioner\'s refuses even when recordDetections is false', async () => {
    const handler = await loadHandler('worlds/detect', 'POST');
    const spec: Pick<Spec, 'route' | 'build'> = {
      route: 'worlds/detect',
      build: ({ sessionId }) => ({ body: { text: 'hello', sessionId, recordDetections: false } }),
    };
    seed();
    const res = await handler(fakeRequest(spec, { sessionId: IDS.practice.theirs, token: TOKEN_A }));
    expect(res.status).toBe(404);
    expect(calls).toBe(0);
  });

  it('a refused request issues NO statement beyond the one ownership lookup', async () => {
    const handler = await loadHandler('transcript', 'GET');
    const spec = SPECS.find((s) => s.name === 'GET  /transcript (incremental)')!;
    seed();
    await handler(fakeRequest(spec, { sessionId: IDS.practice.theirs, token: TOKEN_A }));
    expect(db.issued).toHaveLength(1);
    expect(db.issued[0]!.sql).toMatch(/practitioner_id = \$2/);
    expect(db.issued[0]!.params).toEqual([IDS.practice.theirs, MEMBER_A]);
  });

  it('the ownership lookup binds the SESSION member, never a value from the request', async () => {
    const handler = await loadHandler('session/stop', 'POST');
    const spec = SPECS.find((s) => s.name === 'POST /session/stop')!;
    seed();
    await handler(fakeRequest(spec, { sessionId: IDS.practice.mine, token: TOKEN_A, claim: { memberId: MEMBER_B, practitionerId: MEMBER_B } }));
    expect(db.issued.every((q) => !q.params.includes(MEMBER_B))).toBe(true);
    expect(db.issued[0]!.params).toEqual([IDS.practice.mine, MEMBER_A]);
  });

  it('an owned session of the signed-in practitioner behaves as before (stop ends it, PATCH renames it, transcript returns its own text)', async () => {
    seed();
    const stop = await (await loadHandler('session/stop', 'POST'))(fakeRequest(SPECS.find((s) => s.name === 'POST /session/stop')!, { sessionId: IDS.practice.mine, token: TOKEN_A }));
    expect(stop.status).toBe(200);
    expect(db.sessions.find((s) => s.id === IDS.practice.mine)?.ended_at).toBe('now');
    const patch = await (await loadHandler('sessions', 'PATCH'))(fakeRequest(SPECS.find((s) => s.name === 'PATCH /sessions')!, { sessionId: IDS.practice.mine, token: TOKEN_A }));
    expect(patch.status).toBe(200);
    expect(db.sessions.find((s) => s.id === IDS.practice.mine)?.title).toBe('renamed');
    const tr = await (await loadHandler('transcript', 'GET'))(fakeRequest(SPECS.find((s) => s.name === 'GET  /transcript (incremental)')!, { sessionId: IDS.practice.mine, token: TOKEN_A }));
    const body = await tr.json() as { segments: Seg[] };
    expect(body.segments.map((s) => s.session_id)).toEqual([IDS.practice.mine]);
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(JSON.stringify(body)).not.toContain(LEGACY_SECRET);
  });
});

/* ── LETHALITY: wrong handlers, each of which must be caught ───────────────── */

async function sessionMember(req: NextRequest): Promise<string | null> {
  const { getMemberIdFromRequest } = await import('@/lib/auth/getMemberFromRequest');
  return getMemberIdFromRequest(req);
}
const notFound = () => NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
const unauthorized = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

/** what a competent but wrong `session/stop` looks like, with the ownership rule under test */
function wrongStop(rule: {
  /** decide, given the actor and the row (or null), what to answer; undefined = proceed */
  gate?: (actor: string, row: SessionRow | null, req: NextRequest) => Promise<Response | undefined>;
  /** run the write BEFORE the gate */
  writeFirst?: boolean;
}): Handler {
  return async (req) => {
    const actor = await sessionMember(req);
    if (!actor) return unauthorized();
    const body = (await req.json()) as { sessionId: string; practitionerId?: string };
    const { stopSession, getSession } = await import('@/lib/practice/PracticeStore');
    // the wrong handlers read the row through the (fake) store so the check is attributable to the rule, not to SQL
    const row = db.sessions.find((s) => s.id === body.sessionId) ?? null;
    if (rule.writeFirst) await stopSession(body.sessionId);
    const refused = rule.gate ? await rule.gate(actor, row, req) : undefined;
    if (refused) return refused;
    if (!rule.writeFirst) await stopSession(body.sessionId);
    const s = await getSession(body.sessionId);
    return s ? NextResponse.json({ success: true, session: s }) : notFound();
  };
}

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · practice — defeat candidates (each must be caught)', () => {
  const stopSpec = SPECS.find((s) => s.name === 'POST /session/stop')!;
  const run = (label: string, h: Handler) => exerciseOwnership(label, opFor(stopSpec, h), world);

  it('control: a correct owner-only stop is clean under the same checker', async () => {
    const v = await run('CONTROL', wrongStop({
      gate: async (actor, row) => (row && row.practitioner_id === actor ? undefined : notFound()),
    }));
    // the control reads the row itself instead of calling the SQL helper, so it makes store calls only when allowed
    expect(v).toEqual([]);
  });

  it('DC-P1 session id only (the shipped defect): any authenticated practitioner stops any session', async () => {
    const v = await run('DC-P1', wrongStop({}));
    expect(v.some((m) => m.includes('O1'))).toBe(true);
    expect(v.some((m) => m.includes('O3'))).toBe(true);
  });

  it('DC-P2 existence oracle: 403 for a session that exists and is not yours, 404 for an absent one', async () => {
    const v = await run('DC-P2', wrongStop({
      gate: async (actor, row) => {
        if (!row) return notFound();
        return row.practitioner_id === actor ? undefined : NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      },
    }));
    expect(v.some((m) => m.includes('O1') && m.includes('distinguishable'))).toBe(true);
  });

  it('DC-P3 the owner is trusted from the request body (`practitionerId`), not the session', async () => {
    const v = await run('DC-P3', wrongStop({
      gate: async (actor, row, req) => {
        const claimed = ((await req.json().catch(() => ({}))) as { practitionerId?: string }).practitionerId;
        const owner = claimed ?? actor;
        return row && row.practitioner_id === owner ? undefined : notFound();
      },
    }));
    expect(v.some((m) => m.includes('O1'))).toBe(true);
  });

  it('DC-P4 an unowned (NULL-owner) legacy session is allowed through', async () => {
    const v = await run('DC-P4', wrongStop({
      gate: async (actor, row) => (row && (row.practitioner_id === null || row.practitioner_id === actor) ? undefined : notFound()),
    }));
    expect(v.some((m) => m.includes('O3'))).toBe(true);
  });

  it('DC-P5 the owner is checked AFTER the write: the row is already stopped when it is refused', async () => {
    const v = await run('DC-P5', wrongStop({
      writeFirst: true,
      gate: async (actor, row) => (row && row.practitioner_id === actor ? undefined : notFound()),
    }));
    expect(v.some((m) => m.includes('changed data') || m.includes('reached a store'))).toBe(true);
  });

  it('DC-P6 a transcript GET that reads the transcript and only then decides', async () => {
    const spec = SPECS.find((s) => s.name === 'GET  /transcript (incremental)')!;
    const wrong: Handler = async (req) => {
      const actor = await sessionMember(req);
      if (!actor) return unauthorized();
      const sessionId = new URL(req.url).searchParams.get('sessionId')!;
      const { getTranscriptSegments } = await import('@/lib/practice/PracticeStore');
      const segs = await getTranscriptSegments(sessionId);
      const row = db.sessions.find((s) => s.id === sessionId);
      if (!row || row.practitioner_id !== actor) return notFound();
      return NextResponse.json({ success: true, segments: segs });
    };
    const v = await exerciseOwnership('DC-P6', opFor(spec, wrong), world);
    expect(v.some((m) => m.includes('reached a store'))).toBe(true);
  });

  it('DC-P7 a handler that authenticates but never checks the id it is handed (insights list)', async () => {
    const spec = SPECS.find((s) => s.name === 'GET  /insights/list')!;
    const wrong: Handler = async (req) => {
      const actor = await sessionMember(req);
      if (!actor) return unauthorized();
      const sessionId = new URL(req.url).searchParams.get('sessionId')!;
      const { getSessionInsights } = await import('@/lib/practice/PracticeStore');
      return NextResponse.json({ success: true, insights: await getSessionInsights(sessionId) });
    };
    const v = await exerciseOwnership('DC-P7', opFor(spec, wrong), world);
    expect(v.some((m) => m.includes('O1') || m.includes('O2'))).toBe(true);
  });

  it('DC-P8 no authentication at all (the shipped state of insights/list POST)', async () => {
    const spec = SPECS.find((s) => s.name === 'POST /insights/list')!;
    const wrong: Handler = async (req) => {
      const body = (await req.json()) as { sessionId: string; content: string };
      const { addInsight } = await import('@/lib/practice/PracticeStore');
      return NextResponse.json({ success: true, insight: await addInsight({ sessionId: body.sessionId, content: body.content, insightType: 'pattern' } as never) });
    };
    const v = await exerciseOwnership('DC-P8', opFor(spec, wrong), world);
    expect(v.some((m) => m.includes('O0'))).toBe(true);
    expect(v.some((m) => m.includes('O1'))).toBe(true);
  });

  it('DC-P9 the owner matched only in the practice table: a supervision session of the owner is refused', async () => {
    const wrong = wrongStop({
      gate: async (actor, row) => (row && row.kind === 'practice' && row.practitioner_id === actor ? undefined : notFound()),
    });
    const v = await run('DC-P9', wrong);
    expect(v.some((m) => m.includes('O4[supervision]'))).toBe(true);
  });
});

