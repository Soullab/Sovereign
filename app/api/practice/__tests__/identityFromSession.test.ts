/**
 * PRACTITIONER-API-IDENTITY-01 — practice family · the acting identity is the SESSION.
 *
 * Twelve /api/practice handlers took the practitioner from the request (`?practitionerId=`
 * on GET, `practitionerId` in the JSON body on writes): growth, preferences, the session
 * list and start, the worlds a practitioner has enabled, the world suggestion and the
 * experiments feed. Naming another practitioner's id read or wrote that practitioner's rows.
 * `PATCH /growth` carried no identity at all and acknowledged ANY growth row by id.
 *
 * Boundary check (I1-I5): tests/support/sessionBoundaryHarness.ts, run against every handler
 * below and against deliberately wrong handlers that must each be caught.
 *
 * ⛔ NOT in this suite, and not claimed: the practice handlers addressed by a SESSION id only
 * (`insights/*`, `session/stop`, `session/worlds`, `sessions` single/PATCH, `transcript`,
 * `worlds/detect`). `practice_sessions.practitioner_id` is nullable and `getSession` falls
 * back to `supervision_sessions`, whose rows are overwhelmingly unowned, so an ownership check
 * on them needs a product decision about legacy unowned rows. They are listed, by name, in the
 * static guard's open set (app/api/__tests__/practitionerFamiliesIdentityGuard.test.ts).
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  B_SECRET,
  MEMBER_A,
  MEMBER_B,
  TOKEN_A,
  authSessionRows,
  exerciseBoundary,
  type Op,
  type World,
} from '@/tests/support/sessionBoundaryHarness';

const mockQuery = jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>>();
jest.mock('@/lib/db/postgres', () => ({
  __esModule: true,
  default: { query: (sql: string, params?: unknown[]) => mockQuery(sql, params) },
  query: (sql: string, params?: unknown[]) => mockQuery(sql, params),
}));
jest.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

/* ── the world behind the routes ─────────────────────────────────────────────── */

const G_A = 'g-a';
const G_B = 'g-b';

type Growth = { id: string; practitioner_id: string; observation: string; acknowledged: boolean };
type Sess = { id: string; practitioner_id: string | null; title: string };
type PWorld = { practitioner_id: string; world_id: string; is_enabled: boolean; proficiency_level: string; learning_notes: string | null };

let growth: Growth[] = [];
let prefs: Record<string, { insight_depth: string; modality_vocabulary: string[] }> = {};
let sessions: Sess[] = [];
let pworlds: PWorld[] = [];
let suggestions: string[] = [];
let identities: string[] = [];
let calls = 0;

function seed(): void {
  growth = [
    { id: G_A, practitioner_id: MEMBER_A, observation: 'growth-of-A', acknowledged: false },
    { id: G_B, practitioner_id: MEMBER_B, observation: `growth-of-${B_SECRET}`, acknowledged: false },
  ];
  prefs = {
    [MEMBER_A]: { insight_depth: 'light', modality_vocabulary: ['somatic'] },
    [MEMBER_B]: { insight_depth: 'deep', modality_vocabulary: [B_SECRET] },
  };
  sessions = [
    { id: 's-a', practitioner_id: MEMBER_A, title: 'session-of-A' },
    { id: 's-b', practitioner_id: MEMBER_B, title: `session-of-${B_SECRET}` },
  ];
  pworlds = [
    { practitioner_id: MEMBER_A, world_id: 'w1', is_enabled: true, proficiency_level: 'beginner', learning_notes: null },
    { practitioner_id: MEMBER_B, world_id: 'w1', is_enabled: true, proficiency_level: 'expert', learning_notes: B_SECRET },
  ];
  suggestions = [];
  identities = [];
  calls = 0;
}

function as(identity: string | null | undefined): void {
  calls++;
  if (identity) identities.push(identity);
}

const world: World = {
  seed,
  stateOfB: () =>
    JSON.stringify({
      growth: growth.filter((g) => g.practitioner_id === MEMBER_B),
      prefs: prefs[MEMBER_B],
      sessions: sessions.filter((s) => s.practitioner_id === MEMBER_B),
      pworlds: pworlds.filter((p) => p.practitioner_id === MEMBER_B),
      suggestions: suggestions.filter((s) => s === MEMBER_B),
    }),
  identitiesUsed: () => new Set(identities),
  callCount: () => calls,
};

jest.mock('@/lib/practice/PracticeStore', () => ({
  __esModule: true,
  // growth
  getGrowthObservations: async (practitionerId: string) => {
    as(practitionerId);
    return growth.filter((g) => g.practitioner_id === practitionerId);
  },
  addGrowthObservation: async (p: { practitionerId: string; observation: string }) => {
    as(p.practitionerId);
    const row = { id: 'g-new', practitioner_id: p.practitionerId, observation: p.observation, acknowledged: false };
    growth.push(row);
    return row;
  },
  // the fixed contract scopes the acknowledge to the owner; an unscoped call (the old
  // two-argument shape) acts on any row, exactly as the real unscoped UPDATE did.
  // ⚠️ This mock enforces ownership ITSELF, so nothing in this file tests the real SQL predicate.
  // That boundary is pinned against the real function in
  // lib/practice/__tests__/acknowledgeGrowthOwner.test.ts.
  acknowledgeGrowth: async (growthId: string, _notes?: string, practitionerId?: string) => {
    as(practitionerId);
    const row = growth.find((g) => g.id === growthId && (practitionerId === undefined || g.practitioner_id === practitionerId));
    if (!row) return null;
    row.acknowledged = true;
    return row;
  },
  getRecentSessionsForGrowthAnalysis: async (practitionerId: string) => {
    as(practitionerId);
    return [];
  },
  // preferences
  getInsightPreferences: async (practitionerId: string) => {
    as(practitionerId);
    return prefs[practitionerId] ?? null;
  },
  upsertInsightPreferences: async (p: { practitionerId: string; insightDepth?: string; modalityVocabulary?: string[] }) => {
    as(p.practitionerId);
    prefs[p.practitionerId] = { insight_depth: p.insightDepth ?? 'balanced', modality_vocabulary: p.modalityVocabulary ?? [] };
    return prefs[p.practitionerId];
  },
  getModalityVocabulary: async () => [],
  // sessions
  createSession: async (p: { practitionerId?: string; title?: string }) => {
    as(p.practitionerId);
    const row = { id: 's-new', practitioner_id: p.practitionerId ?? null, title: p.title ?? '' };
    sessions.push(row);
    return row;
  },
  // like the real store: no practitionerId means NO filter at all
  listSessions: async (p: { practitionerId?: string }) => {
    as(p.practitionerId ?? 'ALL-SESSIONS-UNFILTERED');
    return sessions.filter((s) => p.practitionerId === undefined || s.practitioner_id === p.practitionerId);
  },
  getSession: async () => null,
  updateSession: async () => null,
}));
jest.mock('@/lib/practice/WorldsStore', () => ({
  __esModule: true,
  getPractitionerWorlds: async (practitionerId: string) => {
    as(practitionerId);
    return pworlds.filter((p) => p.practitioner_id === practitionerId);
  },
  enableWorldForPractitioner: async (p: { practitionerId: string; worldId: string; proficiencyLevel?: string }) => {
    as(p.practitionerId);
    const row = { practitioner_id: p.practitionerId, world_id: p.worldId, is_enabled: true, proficiency_level: p.proficiencyLevel ?? 'beginner', learning_notes: null };
    pworlds.push(row);
    return row;
  },
  disableWorldForPractitioner: async (practitionerId: string, worldId: string) => {
    as(practitionerId);
    const row = pworlds.find((p) => p.practitioner_id === practitionerId && p.world_id === worldId);
    if (row) row.is_enabled = false;
    return row ?? null;
  },
  updatePractitionerWorld: async (practitionerId: string, worldId: string, u: { proficiency_level?: string }) => {
    as(practitionerId);
    const row = pworlds.find((p) => p.practitioner_id === practitionerId && p.world_id === worldId);
    if (!row) return null;
    if (u.proficiency_level) row.proficiency_level = u.proficiency_level;
    return row;
  },
  incrementWorldUsage: async (practitionerId: string) => {
    as(practitionerId);
  },
  suggestWorldForContext: async (p: { practitionerId: string }) => {
    as(p.practitionerId);
    suggestions.push(p.practitionerId);
    return { suggestedWorld: null, reason: p.practitionerId === MEMBER_B ? B_SECRET : 'ok' };
  },
  getSessionWorlds: async () => [],
  getWorldExperiments: async () => {
    calls++;
    return [];
  },
  getExperimentsForPractitioner: async (practitionerId: string) => {
    as(practitionerId);
    return practitionerId === MEMBER_B ? [{ id: 'e-b', world_code: B_SECRET }] : [{ id: 'e-a', world_code: 'somatic' }];
  },
  recordSessionWorld: async () => null,
  detectWorldsInText: async () => [],
  getAllWorlds: async () => [],
  getWorld: async () => null,
  getWorldByCode: async () => null,
}));

beforeEach(() => {
  seed();
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => authSessionRows(sql, params) ?? { rows: [] });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

/* ── request plumbing ───────────────────────────────────────────────────────── */

type Handler = (req: NextRequest) => Promise<Response>;
type Method = 'GET' | 'POST' | 'PATCH';

type Spec = {
  name: string;
  method: Method;
  route: string; // relative to app/api/practice
  /** true when the op addresses one row by id that B owns (growth PATCH) */
  resourceScoped?: boolean;
  /** claim = the practitionerId the caller names; mine = which row the op addresses */
  build: (a: { claim: string; mine: boolean }) => { query?: Record<string, string>; body?: Record<string, unknown> };
};

async function loadHandler(spec: Spec): Promise<Handler> {
  const mod = (await import(`../${spec.route}/route`)) as Record<string, unknown>;
  return mod[spec.method] as Handler;
}

function fakeRequest(spec: Spec, a: { claim: string; mine: boolean; token?: string; headers?: Record<string, string> }): NextRequest {
  const headers = new Headers(a.headers ?? {});
  if (a.token) headers.set('x-session-token', a.token);
  const { query, body } = spec.build({ claim: a.claim, mine: a.mine });
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  const url = `https://soullab.life/api/practice/${spec.route}${qs}`;
  return { headers, url, nextUrl: new URL(url), json: async () => body ?? {} } as unknown as NextRequest;
}

function opFor(spec: Spec, handler: Handler): Op {
  return {
    name: spec.name,
    resourceScoped: spec.resourceScoped === true,
    okStatus: 200,
    invoke: ({ claim, mine, token, headers }) => handler(fakeRequest(spec, { claim, mine, token, headers })),
  };
}

const SPECS: Spec[] = [
  { name: 'GET  /growth', method: 'GET', route: 'growth',
    build: ({ claim }) => ({ query: { practitionerId: claim } }) },
  { name: 'POST /growth', method: 'POST', route: 'growth',
    build: ({ claim }) => ({ body: { practitionerId: claim, growthType: 'strength', observation: 'a new observation' } }) },
  { name: 'PATCH /growth (acknowledge by id)', method: 'PATCH', route: 'growth', resourceScoped: true,
    build: ({ claim, mine }) => ({ body: { practitionerId: claim, growthId: mine ? G_A : G_B } }) },
  { name: 'GET  /preferences', method: 'GET', route: 'preferences',
    build: ({ claim }) => ({ query: { practitionerId: claim } }) },
  { name: 'POST /preferences', method: 'POST', route: 'preferences',
    build: ({ claim }) => ({ body: { practitionerId: claim, insightDepth: 'deep', modalityVocabulary: ['x'] } }) },
  { name: 'GET  /sessions (list)', method: 'GET', route: 'sessions',
    build: ({ claim }) => ({ query: { practitionerId: claim } }) },
  { name: 'POST /session/start', method: 'POST', route: 'session/start',
    build: ({ claim }) => ({ body: { practitionerId: claim, title: 'my session' } }) },
  { name: 'POST /worlds/suggest', method: 'POST', route: 'worlds/suggest',
    build: ({ claim }) => ({ body: { practitionerId: claim, transcriptSample: 'some words' } }) },
  { name: 'GET  /worlds/practitioner', method: 'GET', route: 'worlds/practitioner',
    build: ({ claim }) => ({ query: { practitionerId: claim } }) },
  { name: 'POST /worlds/practitioner (enable)', method: 'POST', route: 'worlds/practitioner',
    build: ({ claim }) => ({ body: { practitionerId: claim, worldId: 'w2' } }) },
  { name: 'POST /worlds/practitioner (disable)', method: 'POST', route: 'worlds/practitioner',
    build: ({ claim }) => ({ body: { practitionerId: claim, worldId: 'w1', action: 'disable' } }) },
  { name: 'PATCH /worlds/practitioner', method: 'PATCH', route: 'worlds/practitioner',
    build: ({ claim }) => ({ body: { practitionerId: claim, worldId: 'w1', proficiencyLevel: 'advanced' } }) },
  { name: 'GET  /worlds/experiments (practitioner feed)', method: 'GET', route: 'worlds/experiments',
    build: ({ claim }) => ({ query: { practitionerId: claim } }) },
];

/* ── the real routes ────────────────────────────────────────────────────────── */

describe('PRACTITIONER-API-IDENTITY-01 · practice — every acting-identity handler acts as the session', () => {
  it.each(SPECS.map((s) => [s.name, s] as const))('%s', async (_name, spec) => {
    const handler = await loadHandler(spec);
    expect(await exerciseBoundary(spec.name, opFor(spec, handler), world)).toEqual([]);
  });

  it('GET /sessions with NO practitionerId lists only the session practitioner, never every session', async () => {
    const handler = await loadHandler(SPECS.find((s) => s.name.startsWith('GET  /sessions'))!);
    seed();
    const url = 'https://soullab.life/api/practice/sessions';
    const req = { headers: new Headers({ 'x-session-token': TOKEN_A }), url, nextUrl: new URL(url), json: async () => ({}) } as unknown as NextRequest;
    const body = await (await handler(req)).json();
    expect(JSON.stringify(body)).not.toContain(B_SECRET);
    expect((body.sessions as Sess[]).map((s) => s.practitioner_id)).toEqual([MEMBER_A]);
  });

  it('POST /session/start records the SESSION member as the practitioner, whatever the body says', async () => {
    const handler = await loadHandler(SPECS.find((s) => s.name === 'POST /session/start')!);
    seed();
    const res = await handler(fakeRequest(SPECS.find((s) => s.name === 'POST /session/start')!, { claim: MEMBER_B, mine: true, token: TOKEN_A }));
    expect(res.status).toBe(200);
    expect(sessions.find((s) => s.id === 's-new')?.practitioner_id).toBe(MEMBER_A);
  });

  it('PATCH /growth acknowledges the session practitioner\'s own row and leaves B\'s untouched', async () => {
    const spec = SPECS.find((s) => s.name.startsWith('PATCH /growth'))!;
    const handler = await loadHandler(spec);
    seed();
    expect((await handler(fakeRequest(spec, { claim: MEMBER_A, mine: true, token: TOKEN_A }))).status).toBe(200);
    expect(growth.find((g) => g.id === G_A)?.acknowledged).toBe(true);
    expect(growth.find((g) => g.id === G_B)?.acknowledged).toBe(false);
  });

  it('GET /worlds/experiments?worldId= (the catalogue branch) needs no identity and still answers', async () => {
    const handler = await loadHandler(SPECS.find((s) => s.name.startsWith('GET  /worlds/experiments'))!);
    seed();
    const url = 'https://soullab.life/api/practice/worlds/experiments?worldId=w1';
    const req = { headers: new Headers({ 'x-session-token': TOKEN_A }), url, nextUrl: new URL(url), json: async () => ({}) } as unknown as NextRequest;
    expect((await handler(req)).status).toBe(200);
  });
});

/* ── LETHALITY ──────────────────────────────────────────────────────────────── */

async function sessionMember(req: NextRequest): Promise<string | null> {
  const { getMemberIdFromRequest } = await import('@/lib/auth/getMemberFromRequest');
  return getMemberIdFromRequest(req);
}

/** GET /growth with the identity rule under test */
function wrongGrowthGet(resolve: (req: NextRequest, claimed: string | null) => Promise<string | null>): Handler {
  return async (req) => {
    const claimed = new URL(req.url).searchParams.get('practitionerId');
    const id = await resolve(req, claimed);
    if (!id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const { getGrowthObservations } = await import('@/lib/practice/PracticeStore');
    return NextResponse.json({ success: true, observations: await getGrowthObservations(id) });
  };
}

/** PATCH /growth whose acknowledge is NOT scoped to the session practitioner */
function wrongGrowthPatchUnscoped(): Handler {
  return async (req) => {
    const id = await sessionMember(req);
    if (!id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const body = (await req.json()) as { growthId: string };
    // typed loosely on purpose: the candidate models the OLD two-argument call shape
    const { acknowledgeGrowth } = (await import('@/lib/practice/PracticeStore')) as unknown as {
      acknowledgeGrowth: (growthId: string) => Promise<unknown>;
    };
    const g = await acknowledgeGrowth(body.growthId); // ← no owner passed
    return g ? NextResponse.json({ success: true, growth: g }) : NextResponse.json({ success: false }, { status: 404 });
  };
}

describe('PRACTITIONER-API-IDENTITY-01 · practice — defeat candidates (each must be caught)', () => {
  const getSpec = SPECS.find((s) => s.name === 'GET  /growth')!;
  const patchSpec = SPECS.find((s) => s.name.startsWith('PATCH /growth'))!;
  const run = (label: string, spec: Spec, h: Handler) => exerciseBoundary(label, opFor(spec, h), world);

  it('control: session identity only', async () => {
    expect(await run('CONTROL', getSpec, wrongGrowthGet(async (req) => sessionMember(req)))).toEqual([]);
  });

  it('DC-1 query identity, no session (the shipped defect)', async () => {
    const v = await run('DC-1', getSpec, wrongGrowthGet(async (_req, claimed) => claimed));
    expect(v.some((m) => m.includes('I1'))).toBe(true);
    expect(v.some((m) => m.includes('I2'))).toBe(true);
  });

  it('DC-2 the caller-supplied id wins over the session', async () => {
    const v = await run('DC-2', getSpec, wrongGrowthGet(async (req, claimed) => claimed ?? (await sessionMember(req))));
    expect(v.some((m) => m.includes('I2') || m.includes('I3'))).toBe(true);
  });

  it('DC-3 the query value is a fallback when there is no session', async () => {
    const v = await run('DC-3', getSpec, wrongGrowthGet(async (req, claimed) => (await sessionMember(req)) ?? claimed));
    expect(v.some((m) => m.includes('I1'))).toBe(true);
  });

  it('DC-4 x-member-id overrides the session', async () => {
    const v = await run('DC-4', getSpec, wrongGrowthGet(async (req) => req.headers.get('x-member-id') ?? (await sessionMember(req))));
    expect(v.some((m) => m.includes('I5'))).toBe(true);
  });

  it('DC-5 session identity, but the growth acknowledge is unscoped (resource id trusted)', async () => {
    const v = await run('DC-5', patchSpec, wrongGrowthPatchUnscoped());
    expect(v.some((m) => m.includes('I2'))).toBe(true);
  });
});
