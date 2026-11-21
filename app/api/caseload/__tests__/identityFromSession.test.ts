/**
 * PRACTITIONER-API-IDENTITY-01 — caseload family · the acting identity is the SESSION.
 *
 * Every /api/caseload handler used to take "who is acting" from the request itself
 * (`?memberId=` on GET, `memberId` in the JSON body on writes) and pass it to the
 * case store. The store's ownership predicate (`practitioner_id = $2`) was therefore
 * only as strong as a value the caller chose: account A could name B's member id and
 * the store would answer as B.
 *
 * The boundary check (I1-I5) lives in tests/support/sessionBoundaryHarness.ts and is run
 * here against every real handler AND against deliberately wrong handlers, each of which
 * must be caught. The session is resolved by the REAL `getMemberIdFromRequest` against a
 * mocked `auth_sessions` row; only the stores/services behind the routes are replaced by
 * an in-memory world that enforces the same ownership predicate the real store does.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
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

const CASE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CASE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/* ── session: real helper, mocked auth_sessions row ─────────────────────────── */

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

type CaseRow = { id: string; practitioner_id: string; client_identifier: string };
type NoteRow = { id: string; case_id: string; practitioner_id: string; content: string };
type LinkRow = { case_id: string; capture_session_id: string };

let cases: CaseRow[] = [];
let notes: NoteRow[] = [];
let links: LinkRow[] = [];
let memoryChunks: Array<{ caseId: string; memberId: string | null; content: string }> = [];
let consultations: Array<{ caseId: string; memberId: string }> = [];
let practitionerFlags: Record<string, boolean> = {};
let identities: string[] = [];
let calls = 0;

function seed(): void {
  cases = [
    { id: CASE_A, practitioner_id: MEMBER_A, client_identifier: 'client-of-A' },
    { id: CASE_B, practitioner_id: MEMBER_B, client_identifier: `client-of-${B_SECRET}` },
  ];
  notes = [
    { id: 'n-a', case_id: CASE_A, practitioner_id: MEMBER_A, content: 'note-of-A' },
    { id: 'n-b', case_id: CASE_B, practitioner_id: MEMBER_B, content: `note-of-${B_SECRET}` },
  ];
  links = [
    { case_id: CASE_A, capture_session_id: 'cap-A' },
    { case_id: CASE_B, capture_session_id: 'cap-B' },
  ];
  memoryChunks = [];
  consultations = [];
  practitionerFlags = { [MEMBER_A]: true, [MEMBER_B]: true };
  identities = [];
  calls = 0;
}

/** a store/service call made AS `identity` */
function as(identity: string): void {
  calls++;
  identities.push(identity);
}

const world: World = {
  seed,
  stateOfB: () =>
    JSON.stringify({
      cases: cases.filter((c) => c.practitioner_id === MEMBER_B),
      notes: notes.filter((n) => n.practitioner_id === MEMBER_B),
      links: links.filter((l) => l.case_id === CASE_B),
      memory: memoryChunks.filter((m) => m.caseId === CASE_B || m.memberId === MEMBER_B),
      consultations: consultations.filter((c) => c.caseId === CASE_B || c.memberId === MEMBER_B),
      flag: practitionerFlags[MEMBER_B],
    }),
  identitiesUsed: () => new Set(identities),
  callCount: () => calls,
};

function mockCaseStore() {
  const owned = (caseId: string, who: string) =>
    cases.find((c) => c.id === caseId && c.practitioner_id === who) ?? null;
  return {
    isPractitioner: async (memberId: string) => {
      as(memberId);
      return !!practitionerFlags[memberId];
    },
    enablePractitionerMode: async (memberId: string) => {
      as(memberId);
      practitionerFlags[memberId] = true;
      return true;
    },
    createCase: async (practitionerId: string, input: { client_identifier: string }) => {
      as(practitionerId);
      const row = { id: 'case-new', practitioner_id: practitionerId, client_identifier: input.client_identifier };
      cases.push(row);
      return row;
    },
    listCases: async (practitionerId: string) => {
      as(practitionerId);
      return cases.filter((c) => c.practitioner_id === practitionerId);
    },
    getCaseCounts: async (practitionerId: string) => {
      as(practitionerId);
      return { total: cases.filter((c) => c.practitioner_id === practitionerId).length };
    },
    getCase: async (caseId: string, practitionerId: string) => {
      as(practitionerId);
      return owned(caseId, practitionerId);
    },
    getCaseWithStats: async (caseId: string, practitionerId: string) => {
      as(practitionerId);
      return owned(caseId, practitionerId);
    },
    listNotes: async (caseId: string, practitionerId: string) => {
      as(practitionerId);
      return notes.filter((n) => n.case_id === caseId && n.practitioner_id === practitionerId);
    },
    createNote: async (caseId: string, practitionerId: string, input: { content: string }) => {
      as(practitionerId);
      const row = { id: 'note-new', case_id: caseId, practitioner_id: practitionerId, content: input.content };
      notes.push(row);
      return { ...row, note_type: 'session', session_date: '2026-11-17', themes_observed: [], interventions_used: [], element_focus: null, spiral_movement: null };
    },
    updateCase: async (caseId: string, practitionerId: string, input: Partial<CaseRow>) => {
      as(practitionerId);
      const row = owned(caseId, practitionerId);
      if (!row) return null;
      Object.assign(row, input, { id: caseId, practitioner_id: practitionerId });
      return row;
    },
    archiveCase: async (caseId: string, practitionerId: string) => {
      as(practitionerId);
      const row = owned(caseId, practitionerId);
      if (!row) return null;
      (row as CaseRow & { case_status?: string }).case_status = 'archived';
      return row;
    },
    getCaptureLinks: async (caseId: string) => {
      calls++;
      return links.filter((l) => l.case_id === caseId);
    },
    linkCaptureSession: async (caseId: string, captureSessionId: string, practitionerId: string) => {
      as(practitionerId);
      const row = { case_id: caseId, capture_session_id: captureSessionId };
      links.push(row);
      return { ...row, linked_by: practitionerId };
    },
    unlinkCaptureSession: async (caseId: string, captureSessionId: string) => {
      calls++;
      const before = links.length;
      links = links.filter((l) => !(l.case_id === caseId && l.capture_session_id === captureSessionId));
      return links.length < before;
    },
    getUnlinkedCaptureSessions: async (practitionerId: string) => {
      as(practitionerId);
      return practitionerId === MEMBER_B ? [{ id: `unlinked-${B_SECRET}` }] : [{ id: 'unlinked-A' }];
    },
  };
}
jest.mock('@/lib/caseload/CaseStore', () => {
  const store = mockCaseStore();
  return { __esModule: true, CaseStore: store, ...store };
});
jest.mock('@/lib/caseload/CaseMemoryService', () => ({
  __esModule: true,
  CaseMemoryService: {
    ingestText: async (a: { caseId: string; memberId: string; content: string }) => {
      as(a.memberId);
      memoryChunks.push({ caseId: a.caseId, memberId: a.memberId, content: a.content });
      return { inserted: 1 };
    },
    listRecent: async (a: { caseId: string }) => {
      calls++;
      return memoryChunks.filter((m) => m.caseId === a.caseId);
    },
    searchSimilar: async (a: { caseId: string }) => {
      calls++;
      return memoryChunks.filter((m) => m.caseId === a.caseId);
    },
  },
}));
jest.mock('@/lib/caseload/CasePatternService', () => ({
  __esModule: true,
  CasePatternService: {
    upsert: async () => {
      calls++;
      return { themes: [] };
    },
    get: async () => {
      calls++;
      return null;
    },
  },
}));
jest.mock('@/lib/caseload/CaseConsultationService', () => ({
  __esModule: true,
  CaseConsultationService: {
    list: async (a: { caseId: string; memberId: string }) => {
      as(a.memberId);
      return consultations.filter((c) => c.caseId === a.caseId);
    },
    generate: async (a: { caseId: string; memberId: string }) => {
      as(a.memberId);
      consultations.push({ caseId: a.caseId, memberId: a.memberId });
      return { id: 'consult-new' };
    },
  },
}));
jest.mock('@/lib/capture/captureStore', () => ({
  __esModule: true,
  getSession: async (id: string) => {
    calls++;
    if (id === 'cap-A') return { id, user_id: MEMBER_A };
    if (id === 'cap-B') return { id, user_id: MEMBER_B };
    return null;
  },
}));

beforeEach(() => {
  seed();
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => authSessionRows(sql, params) ?? { rows: [] });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

/* ── request plumbing ───────────────────────────────────────────────────────── */

type Handler = (req: NextRequest, ctx: { params: Promise<{ caseId: string }> }) => Promise<Response>;
type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type Spec = {
  name: string;
  method: Method;
  /** route directory relative to app/api/caseload, e.g. '[caseId]/notes' */
  route: string;
  /** true when the handler is scoped to one case id */
  caseScoped: boolean;
  build: (a: { claim: string; caseId: string }) => { query?: Record<string, string>; body?: Record<string, unknown> };
};

async function loadHandler(spec: Spec): Promise<Handler> {
  const mod = (await import(`../${spec.route}/route`)) as Record<string, unknown>;
  return mod[spec.method] as Handler;
}

function fakeRequest(spec: Spec, a: { claim: string; caseId: string; token?: string; headers?: Record<string, string> }): NextRequest {
  const headers = new Headers(a.headers ?? {});
  if (a.token) headers.set('x-session-token', a.token);
  const { query, body } = spec.build({ claim: a.claim, caseId: a.caseId });
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  const url = `https://soullab.life/api/caseload/${a.caseId}${qs}`;
  return { headers, url, nextUrl: new URL(url), json: async () => body ?? {} } as unknown as NextRequest;
}

function opFor(spec: Spec, handler: Handler): Op {
  return {
    name: spec.name,
    resourceScoped: spec.caseScoped,
    okStatus: 200,
    invoke: ({ claim, mine, token, headers }) => {
      const caseId = mine ? CASE_A : CASE_B;
      return handler(fakeRequest(spec, { claim, caseId, token, headers }), { params: Promise.resolve({ caseId }) });
    },
  };
}

const capFor = (caseId: string) => (caseId === CASE_B ? 'cap-B' : 'cap-A');

const SPECS: Spec[] = [
  { name: 'GET  /list (list cases)', method: 'GET', route: 'list', caseScoped: false,
    build: ({ claim }) => ({ query: { memberId: claim } }) },
  { name: 'POST /list (create case)', method: 'POST', route: 'list', caseScoped: false,
    build: ({ claim }) => ({ body: { memberId: claim, client_identifier: 'new-client' } }) },
  { name: 'GET  /[caseId]/list (case detail)', method: 'GET', route: '[caseId]/list', caseScoped: true,
    build: ({ claim }) => ({ query: { memberId: claim } }) },
  { name: 'PATCH /[caseId]/list (update case)', method: 'PATCH', route: '[caseId]/list', caseScoped: true,
    build: ({ claim }) => ({ body: { memberId: claim, client_identifier: 'renamed' } }) },
  { name: 'DELETE /[caseId]/list (archive case)', method: 'DELETE', route: '[caseId]/list', caseScoped: true,
    build: ({ claim }) => ({ body: { memberId: claim } }) },
  { name: 'GET  /[caseId]/notes', method: 'GET', route: '[caseId]/notes', caseScoped: true,
    build: ({ claim }) => ({ query: { memberId: claim } }) },
  { name: 'POST /[caseId]/notes', method: 'POST', route: '[caseId]/notes', caseScoped: true,
    build: ({ claim }) => ({ body: { memberId: claim, note_type: 'session', content: 'a new note' } }) },
  { name: 'GET  /[caseId]/captures (linked)', method: 'GET', route: '[caseId]/captures', caseScoped: true,
    build: ({ claim }) => ({ query: { memberId: claim } }) },
  { name: 'GET  /[caseId]/captures?unlinked=true', method: 'GET', route: '[caseId]/captures', caseScoped: true,
    build: ({ claim }) => ({ query: { memberId: claim, unlinked: 'true' } }) },
  { name: 'POST /[caseId]/captures (link)', method: 'POST', route: '[caseId]/captures', caseScoped: true,
    build: ({ claim, caseId }) => ({ body: { memberId: claim, captureSessionId: capFor(caseId) } }) },
  { name: 'DELETE /[caseId]/captures (unlink)', method: 'DELETE', route: '[caseId]/captures', caseScoped: true,
    build: ({ claim, caseId }) => ({ body: { memberId: claim, captureSessionId: capFor(caseId) } }) },
  { name: 'GET  /[caseId]/consultations', method: 'GET', route: '[caseId]/consultations', caseScoped: true,
    build: ({ claim }) => ({ query: { memberId: claim } }) },
  { name: 'POST /[caseId]/consultations (generate)', method: 'POST', route: '[caseId]/consultations', caseScoped: true,
    build: ({ claim }) => ({ body: { memberId: claim, consultationType: 'pattern_analysis' } }) },
  { name: 'GET  /[caseId]/memories/list', method: 'GET', route: '[caseId]/memories/list', caseScoped: true,
    build: ({ claim }) => ({ query: { memberId: claim } }) },
  { name: 'POST /[caseId]/memories/list (ingest)', method: 'POST', route: '[caseId]/memories/list', caseScoped: true,
    build: ({ claim }) => ({ body: { memberId: claim, content: 'ingest this' } }) },
  { name: 'POST /[caseId]/memories/search', method: 'POST', route: '[caseId]/memories/search', caseScoped: true,
    build: ({ claim }) => ({ body: { memberId: claim, query: 'anything' } }) },
  { name: 'GET  /[caseId]/patterns', method: 'GET', route: '[caseId]/patterns', caseScoped: true,
    build: ({ claim }) => ({ query: { memberId: claim } }) },
];

/* ── the real routes ────────────────────────────────────────────────────────── */

describe('PRACTITIONER-API-IDENTITY-01 · caseload — every handler acts as the session', () => {
  it.each(SPECS.map((s) => [s.name, s] as const))('%s', async (_name, spec) => {
    const handler = await loadHandler(spec);
    expect(await exerciseBoundary(spec.name, opFor(spec, handler), world)).toEqual([]);
  });

  it('POST /list never flips is_practitioner for the identity a caller names', async () => {
    const spec = SPECS[1]!;
    const handler = await loadHandler(spec);
    seed();
    practitionerFlags = { [MEMBER_A]: false, [MEMBER_B]: false };
    const res = await opFor(spec, handler).invoke({ claim: MEMBER_B, mine: true, token: TOKEN_A });
    expect(res.status).toBe(200);
    // A may enable practitioner mode for A (the existing first-case behaviour); B is untouched.
    expect(practitionerFlags[MEMBER_B]).toBe(false);
    expect(practitionerFlags[MEMBER_A]).toBe(true);
    expect(cases.filter((c) => c.client_identifier === 'new-client').map((c) => c.practitioner_id)).toEqual([MEMBER_A]);
  });

  it("POST /captures: a capture session that is not the SESSION member's is refused (resource id checked against the session)", async () => {
    const spec = SPECS.find((s) => s.name.startsWith('POST /[caseId]/captures'))!;
    const handler = await loadHandler(spec);
    seed();
    // A's own case, but the capture session id is B's.
    const own: Spec = { ...spec, build: ({ claim }) => ({ body: { memberId: claim, captureSessionId: 'cap-B' } }) };
    const res = await handler(
      fakeRequest(own, { claim: MEMBER_A, caseId: CASE_A, token: TOKEN_A }),
      { params: Promise.resolve({ caseId: CASE_A }) },
    );
    expect(res.status).toBe(404);
    // B's capture session was NOT linked into A's case (A's own seeded link is untouched)
    expect(links.some((l) => l.case_id === CASE_A && l.capture_session_id === 'cap-B')).toBe(false);
  });

  it('transcribe was already session-derived and still refuses without a session', async () => {
    const { POST } = await import('../transcribe/route');
    const req = { headers: new Headers(), url: 'https://soullab.life/api/caseload/transcribe', json: async () => ({}) } as unknown as NextRequest;
    expect((await POST(req)).status).toBe(401);
  });

  it('the specs cover the WHOLE caseload handler population, found by census (nothing quietly omitted)', () => {
    const root = path.resolve(__dirname, '..');
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir)) {
        const full = path.join(dir, e);
        if (statSync(full).isDirectory()) {
          if (e !== '__tests__') walk(full);
        } else if (e === 'route.ts') {
          const src = readFileSync(full, 'utf8');
          for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/g)) {
            found.push(`${path.relative(root, path.dirname(full))}::${m[1]}`);
          }
        }
      }
    };
    walk(root);
    const covered = new Set(SPECS.map((s) => `${s.route}::${s.method}`));
    covered.add('transcribe::POST'); // already session-derived; refusal pinned in its own test above
    expect(found.length).toBe(17);
    expect(found.filter((f) => !covered.has(f))).toEqual([]);
  });
});

/* ── LETHALITY: wrong handlers the boundary check must catch ─────────────────── */

async function sessionMember(req: NextRequest): Promise<string | null> {
  const { getMemberIdFromRequest } = await import('@/lib/auth/getMemberFromRequest');
  return getMemberIdFromRequest(req);
}

/** the shape every wrong candidate shares: GET /[caseId]/notes over the same fake store */
function wrongNotesHandler(
  resolve: (req: NextRequest, claimed: string | null) => Promise<string | null>,
  opts: { checkOwnership: boolean },
): Handler {
  return async (req, ctx) => {
    const { caseId } = await ctx.params;
    const claimed = new URL(req.url).searchParams.get('memberId');
    const memberId = await resolve(req, claimed);
    if (!memberId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const store = (await import('@/lib/caseload/CaseStore')).CaseStore as unknown as ReturnType<typeof mockCaseStore>;
    if (opts.checkOwnership) {
      const row = await store.getCase(caseId, memberId);
      if (!row) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    return NextResponse.json({ notes: await store.listNotes(caseId, memberId) });
  };
}

describe('PRACTITIONER-API-IDENTITY-01 · caseload — defeat candidates (each must be caught)', () => {
  const spec = SPECS.find((s) => s.name === 'GET  /[caseId]/notes')!;
  const run = (label: string, h: Handler) => exerciseBoundary(label, opFor(spec, h), world);

  it('control: a handler that resolves the session and checks ownership passes the same check', async () => {
    expect(await run('CONTROL', wrongNotesHandler(async (req) => sessionMember(req), { checkOwnership: true }))).toEqual([]);
  });

  it('DC-1 body/query identity, no session at all (the shipped defect)', async () => {
    const v = await run('DC-1', wrongNotesHandler(async (_req, claimed) => claimed, { checkOwnership: true }));
    expect(v.some((m) => m.includes('I1'))).toBe(true);
    expect(v.some((m) => m.includes('I2'))).toBe(true);
  });

  it('DC-2 session first, but the caller-supplied id wins when present', async () => {
    const v = await run('DC-2', wrongNotesHandler(async (req, claimed) => claimed ?? (await sessionMember(req)), { checkOwnership: true }));
    expect(v.some((m) => m.includes('I2') || m.includes('I3'))).toBe(true);
  });

  it('DC-3 session identity, with the body value as a fallback when there is no session', async () => {
    const v = await run('DC-3', wrongNotesHandler(async (req, claimed) => (await sessionMember(req)) ?? claimed, { checkOwnership: true }));
    expect(v.some((m) => m.includes('I1'))).toBe(true);
  });

  it('DC-4 session identity, but the case id is trusted without an ownership check', async () => {
    const v = await run('DC-4', wrongNotesHandler(async (req) => sessionMember(req), { checkOwnership: false }));
    // listNotes is owner-scoped in the fake, so the leak shows as the missing 403/404 on a case A does not own.
    expect(v.some((m) => m.includes('I2'))).toBe(true);
  });

  it('DC-5 session identity, but x-member-id is honoured as an override', async () => {
    const v = await run(
      'DC-5',
      wrongNotesHandler(async (req) => req.headers.get('x-member-id') ?? (await sessionMember(req)), { checkOwnership: true }),
    );
    expect(v.some((m) => m.includes('I5'))).toBe(true);
  });
});
