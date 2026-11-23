/**
 * PRACTITIONER-API-IDENTITY-01 — practitioners family · the acting identity is the SESSION.
 *
 *   POST /api/practitioners/check        looked up "does THIS member have a practice" for a
 *                                        body-supplied memberId — and returned the practice's
 *                                        slug, name and EMAIL. (The route is public in the access
 *                                        matrix, so the handler is the only gate.)
 *   POST /api/practitioners/create       built a practitioner row for a body-supplied memberId,
 *                                        and flipped that member's is_practitioner flag.
 *   GET/POST /api/practitioners/onboarding
 *                                        read / completed onboarding for any practitioner id,
 *                                        with no session at all.
 *
 * For `onboarding` the client id is a RESOURCE id (a practitioners.id), so it stays — checked
 * against the session member's own practitioner row, 404 when it is not theirs.
 *
 * Boundary check (I1-I5): tests/support/sessionBoundaryHarness.ts, run against every handler and
 * against deliberately wrong handlers that must each be caught.
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

const P_A = 'pa000000-0000-4000-8000-00000000000a';
const P_B = 'pb000000-0000-4000-8000-00000000000b';

/* ── world ───────────────────────────────────────────────────────────────────── */

type Prac = { id: string; member_id: string; slug: string; name: string; email: string; status: string };

let mode: 'create' | 'onboarding' = 'create';
let practitioners: Prac[] = [];
let isPractitionerFlag: Record<string, boolean> = {};
let themes: string[] = [];
let identities: Set<string> = new Set();
let calls = 0;

function seed(): void {
  // B always has a practice, carrying a secret in every field a leak could expose.
  practitioners = [
    { id: P_B, member_id: MEMBER_B, slug: 'bob-practice', name: `Bob ${B_SECRET} Practice`, email: `bob-${B_SECRET}@example.test`, status: 'onboarding' },
  ];
  // For onboarding, A has one too (so "mine" addresses a real row); for create/check A has none.
  if (mode === 'onboarding') {
    practitioners.push({ id: P_A, member_id: MEMBER_A, slug: 'alice-practice', name: 'Alice Practice', email: 'alice@example.test', status: 'onboarding' });
  }
  isPractitionerFlag = { [MEMBER_A]: false, [MEMBER_B]: true };
  themes = [P_B];
  identities = new Set();
  calls = 0;
}

function sawParams(params: unknown[]): void {
  for (const p of params) if (p === MEMBER_A || p === MEMBER_B) identities.add(p as string);
}

const world: World = {
  seed,
  stateOfB: () =>
    JSON.stringify({
      practitioners: practitioners.filter((p) => p.member_id === MEMBER_B),
      flag: isPractitionerFlag[MEMBER_B],
      themes: themes.filter((t) => t === P_B),
    }),
  identitiesUsed: () => identities,
  callCount: () => calls,
};

type Result = { rows: unknown[]; rowCount?: number };

function dbQuery(sql: string, params: unknown[] = []): Result {
  const session = authSessionRows(sql, params);
  if (session) return session;
  calls++;
  sawParams(params);

  if (/FROM\s+members\s+WHERE\s+id\s*=\s*\$1/i.test(sql)) {
    const id = params[0] as string;
    return { rows: id === MEMBER_A ? [{ id, name: 'Alice' }] : id === MEMBER_B ? [{ id, name: 'Bob' }] : [] };
  }
  if (/FROM\s+practitioners\s+WHERE\s+member_id\s*=\s*\$1/i.test(sql)) {
    return { rows: practitioners.filter((p) => p.member_id === params[0]) };
  }
  if (/FROM\s+practitioners\s+WHERE\s+slug\s*=\s*\$1/i.test(sql)) {
    return { rows: practitioners.filter((p) => p.slug === params[0]) };
  }
  // onboarding: ownership pre-check and the select
  if (/FROM\s+practitioners\s+p\b/i.test(sql) || /SELECT\s+id\s+FROM\s+practitioners\s+WHERE\s+id\s*=\s*\$1/i.test(sql)) {
    const scoped = /member_id\s*=\s*\$2/i.test(sql);
    const hit = practitioners.filter((p) => p.id === params[0] && (!scoped || p.member_id === params[1]));
    return {
      rows: hit.map((p) => ({ id: p.id, status: p.status, onboarded_at: null, has_theme: themes.includes(p.id) })),
    };
  }
  if (/UPDATE\s+practitioners\s+SET\s+status/i.test(sql)) {
    const scoped = /member_id\s*=\s*\$2/i.test(sql);
    let n = 0;
    for (const p of practitioners) {
      if (p.id === params[0] && (!scoped || p.member_id === params[1]) && p.status === 'onboarding') {
        p.status = 'active';
        n++;
      }
    }
    return { rows: [], rowCount: n };
  }
  return { rows: [] };
}

jest.mock('@/lib/db/postgres', () => ({
  __esModule: true,
  default: { query: (sql: string, params?: unknown[]) => dbQuery(sql, params) },
  query: async (sql: string, params?: unknown[]) => dbQuery(sql, params),
  pool: { query: async (sql: string, params?: unknown[]) => dbQuery(sql, params) },
  // the create route's transaction: run the callback with a client over the same world
  transaction: async (cb: (client: { query: (sql: string, params?: unknown[]) => Promise<Result> }) => Promise<unknown>) =>
    cb({
      query: async (sql: string, params: unknown[] = []) => {
        calls++;
        sawParams(params);
        if (/INSERT\s+INTO\s+practitioners\b/i.test(sql)) {
          practitioners.push({
            id: params[0] as string, member_id: params[1] as string, slug: params[2] as string,
            name: params[3] as string, email: params[4] as string, status: 'active',
          });
        } else if (/UPDATE\s+members\s+SET\s+is_practitioner/i.test(sql)) {
          isPractitionerFlag[params[0] as string] = true;
        } else if (/INSERT\s+INTO\s+practitioner_themes/i.test(sql)) {
          themes.push(params[1] as string);
        }
        return { rows: [] };
      },
    }),
  describeDbError: (e: unknown) => String(e),
}));
jest.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));
// `uuid` ships ESM that this jest transform cannot load; the create route only needs a fresh id.
let uuidSeq = 0;
jest.mock('uuid', () => ({ v4: () => `0000000${++uuidSeq}-0000-4000-8000-000000000000` }));

beforeEach(() => {
  mode = 'create';
  seed();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

/* ── request plumbing ───────────────────────────────────────────────────────── */

type Handler = (req: NextRequest) => Promise<Response>;

function fakeRequest(
  route: string,
  a: { token?: string; headers?: Record<string, string>; query?: Record<string, string>; body?: Record<string, unknown> },
): NextRequest {
  const headers = new Headers(a.headers ?? {});
  if (a.token) headers.set('x-session-token', a.token);
  const qs = a.query ? `?${new URLSearchParams(a.query).toString()}` : '';
  const url = `https://soullab.life/api/practitioners/${route}${qs}`;
  return { headers, url, nextUrl: new URL(url), json: async () => a.body ?? {} } as unknown as NextRequest;
}

const createBody = (claim: string) => ({
  memberId: claim, practiceName: 'Alice Practice', slug: 'alice-practice', email: 'alice@example.test',
});

const CHECK: Op = {
  name: 'POST /check (does this member have a practice)',
  resourceScoped: false,
  okStatus: 200,
  invoke: async ({ claim, token, headers }) => {
    const { POST } = await import('../check/route');
    return (POST as unknown as Handler)(fakeRequest('check', { token, headers, body: { memberId: claim } }));
  },
};
const CREATE: Op = {
  name: 'POST /create',
  resourceScoped: false,
  okStatus: 200,
  invoke: async ({ claim, token, headers }) => {
    const { POST } = await import('../create/route');
    return (POST as unknown as Handler)(fakeRequest('create', { token, headers, body: createBody(claim) }));
  },
};
const ONBOARDING_GET: Op = {
  name: 'GET  /onboarding',
  resourceScoped: true,
  okStatus: 200,
  invoke: async ({ mine, token, headers }) => {
    const { GET } = await import('../onboarding/route');
    return (GET as unknown as Handler)(fakeRequest('onboarding', { token, headers, query: { practitionerId: mine ? P_A : P_B } }));
  },
};
const ONBOARDING_POST: Op = {
  name: 'POST /onboarding (complete)',
  resourceScoped: true,
  okStatus: 200,
  invoke: async ({ mine, token, headers }) => {
    const { POST } = await import('../onboarding/route');
    return (POST as unknown as Handler)(fakeRequest('onboarding', { token, headers, body: { practitionerId: mine ? P_A : P_B } }));
  },
};

/* ── the real routes ────────────────────────────────────────────────────────── */

describe('PRACTITIONER-API-IDENTITY-01 · practitioners — every handler acts as the session', () => {
  it('POST /check', async () => {
    mode = 'create';
    expect(await exerciseBoundary(CHECK.name, CHECK, world)).toEqual([]);
  });

  it('POST /create', async () => {
    mode = 'create';
    expect(await exerciseBoundary(CREATE.name, CREATE, world)).toEqual([]);
  });

  it('GET /onboarding', async () => {
    mode = 'onboarding';
    expect(await exerciseBoundary(ONBOARDING_GET.name, ONBOARDING_GET, world)).toEqual([]);
  });

  it('POST /onboarding', async () => {
    mode = 'onboarding';
    expect(await exerciseBoundary(ONBOARDING_POST.name, ONBOARDING_POST, world)).toEqual([]);
  });

  it("POST /check answers about the SESSION member, not the id in the body (A has no practice though B does)", async () => {
    mode = 'create';
    seed();
    const res = await CHECK.invoke({ claim: MEMBER_B, mine: true, token: TOKEN_A });
    const body = await res.json();
    expect(body.hasPractitioner).toBe(false);
    expect(JSON.stringify(body)).not.toContain(B_SECRET);
  });

  it('POST /create builds the practice for the SESSION member and flips only that member', async () => {
    mode = 'create';
    seed();
    const res = await CREATE.invoke({ claim: MEMBER_B, mine: true, token: TOKEN_A });
    expect(res.status).toBe(200);
    const created = practitioners.find((p) => p.slug === 'alice-practice');
    expect(created?.member_id).toBe(MEMBER_A);
    expect(isPractitionerFlag[MEMBER_A]).toBe(true);
    expect(practitioners.filter((p) => p.member_id === MEMBER_B)).toHaveLength(1);
  });

  it('POST /onboarding: owned row completes; a non-owned id is a 404 and the row stays as it was', async () => {
    mode = 'onboarding';
    seed();
    expect((await ONBOARDING_POST.invoke({ claim: MEMBER_A, mine: true, token: TOKEN_A })).status).toBe(200);
    expect(practitioners.find((p) => p.id === P_A)?.status).toBe('active');
    expect((await ONBOARDING_POST.invoke({ claim: MEMBER_A, mine: false, token: TOKEN_A })).status).toBe(404);
    expect(practitioners.find((p) => p.id === P_B)?.status).toBe('onboarding');
  });

  it('GET /practitioners/check?slug= (slug availability) still needs no identity', async () => {
    const { GET } = await import('../check/route');
    const res = await (GET as unknown as Handler)(fakeRequest('check', { query: { slug: 'free-slug-1' } }));
    expect(res.status).toBe(200);
    expect((await res.json()).available).toBe(true);
  });
});

/* ── LETHALITY ──────────────────────────────────────────────────────────────── */

async function sessionMember(req: NextRequest): Promise<string | null> {
  const { getMemberIdFromRequest } = await import('@/lib/auth/getMemberFromRequest');
  return getMemberIdFromRequest(req);
}

/** POST /check with the identity rule under test */
function wrongCheck(resolve: (req: NextRequest, claimed: string | null) => Promise<string | null>): Handler {
  return async (req) => {
    const body = (await req.json()) as { memberId?: string };
    const id = await resolve(req, body.memberId ?? null);
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { query } = await import('@/lib/db/postgres');
    const r = await query('SELECT id, slug, name, email, status FROM practitioners WHERE member_id = $1', [id]);
    return NextResponse.json({ hasPractitioner: r.rows.length > 0, practitioner: r.rows[0] ?? null });
  };
}

/** POST /onboarding that requires a session but trusts the practitioner id it is handed */
function wrongOnboardingUnowned(): Handler {
  return async (req) => {
    const id = await sessionMember(req);
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { practitionerId } = (await req.json()) as { practitionerId: string };
    const { pool } = await import('@/lib/db/postgres');
    // ← no member_id predicate: the resource id is trusted
    await pool!.query("UPDATE practitioners SET status = 'active' WHERE id = $1 AND status = 'onboarding'", [practitionerId]);
    return NextResponse.json({ success: true });
  };
}

describe('PRACTITIONER-API-IDENTITY-01 · practitioners — defeat candidates (each must be caught)', () => {
  const run = (label: string, op: Op, h: Handler, m: 'create' | 'onboarding' = 'create') => {
    mode = m;
    return exerciseBoundary(
      label,
      { ...op, invoke: ({ claim, mine, token, headers }) => h(fakeRequest(label, { token, headers, body: { memberId: claim, practitionerId: mine ? P_A : P_B } })) },
      world,
    );
  };

  it('control: session identity only', async () => {
    expect(await run('CONTROL', CHECK, wrongCheck(async (req) => sessionMember(req)))).toEqual([]);
  });

  it('DC-1 body identity, no session (the shipped defect)', async () => {
    const v = await run('DC-1', CHECK, wrongCheck(async (_req, claimed) => claimed));
    expect(v.some((m) => m.includes('I1'))).toBe(true);
    expect(v.some((m) => m.includes('I2'))).toBe(true);
  });

  it('DC-2 the body id wins over the session', async () => {
    const v = await run('DC-2', CHECK, wrongCheck(async (req, claimed) => claimed ?? (await sessionMember(req))));
    expect(v.some((m) => m.includes('I2') || m.includes('I3'))).toBe(true);
  });

  it('DC-3 the body id is a fallback when there is no session', async () => {
    const v = await run('DC-3', CHECK, wrongCheck(async (req, claimed) => (await sessionMember(req)) ?? claimed));
    expect(v.some((m) => m.includes('I1'))).toBe(true);
  });

  it('DC-4 x-member-id overrides the session', async () => {
    const v = await run('DC-4', CHECK, wrongCheck(async (req) => req.headers.get('x-member-id') ?? (await sessionMember(req))));
    expect(v.some((m) => m.includes('I5'))).toBe(true);
  });

  it('DC-5 session required, but the onboarding practitioner id is trusted (no ownership predicate)', async () => {
    const v = await run('DC-5', ONBOARDING_POST, wrongOnboardingUnowned(), 'onboarding');
    expect(v.some((m) => m.includes('I2'))).toBe(true);
  });
});
