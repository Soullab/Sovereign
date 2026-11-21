/**
 * PORTAL INQUIRY ROUTE — who may read and change a practitioner's inquiries.
 *
 *   POST   public contact form        → stays public, unchanged
 *   GET    list a portal's inquiries  → only the practitioner who OWNS the portal
 *   PATCH  set an inquiry's status    → only the practitioner who OWNS the portal
 *
 * The inquiry rows carry other people's name, email, phone, topic and message,
 * and the portal slug is public by design, so a slug cannot be the thing that
 * opens them. Identity comes from the verified session (never a header, a query
 * string or a body field); ownership is the portal row's own member_id.
 *
 * What this file does NOT establish: that production holds any inquiry rows,
 * what ACCESS_CONTROL_MODE production runs, or that any row was ever read. It
 * runs the real route against an in-memory model of the few tables it touches.
 *
 * LETHALITY. Every law is also run against hand-made wrong versions of the
 * route (source mutations of the real file). A suite that only ever saw the
 * conforming route would not be evidence. Each candidate must (a) apply, and
 * (b) break exactly the laws listed for it, so a candidate cannot die for some
 * incidental reason.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { NextRequest } from 'next/server';

/* ── fictional world ─────────────────────────────────────────────────────── */

const M_ALPHA = 'aaaaaaaa-0000-4000-8000-000000000001'; // owns portal-alpha AND portal-alpha-two
const M_BETA = 'bbbbbbbb-0000-4000-8000-000000000002'; // owns portal-beta
const M_PLAIN = 'cccccccc-0000-4000-8000-000000000003'; // a member who is not a practitioner
const TOKENS: Record<string, string> = {
  'token-alpha': M_ALPHA,
  'token-beta': M_BETA,
  'token-plain': M_PLAIN,
};

type Row = Record<string, unknown>;

const seedPractitioners = (): Row[] => [
  { id: 'p-alpha', member_id: M_ALPHA, slug: 'portal-alpha', status: 'active', name: 'Alpha Practitioner', email: 'alpha@example.test', business_name: 'Alpha Studio', portal_type: 'generalist', enabled_modules: null },
  { id: 'p-alpha-2', member_id: M_ALPHA, slug: 'portal-alpha-two', status: 'active', name: 'Alpha Practitioner', email: 'alpha@example.test', business_name: 'Alpha Studio Two', portal_type: 'generalist', enabled_modules: null },
  { id: 'p-beta', member_id: M_BETA, slug: 'portal-beta', status: 'active', name: 'Beta Practitioner', email: 'beta@example.test', business_name: 'Beta Studio', portal_type: 'generalist', enabled_modules: null },
];

const inquiry = (id: string, slug: string, practitioner: string, name: string, minute: number): Row => ({
  id, portal_slug: slug, practitioner_id: practitioner, name,
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.test`,
  phone: '555-0100', timezone: 'UTC', topic: 'a fictional topic', message: `A fictional message from ${name}`,
  source: 'portal_inquiry_form', status: 'new', created_at: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
});

const I_A1 = '11111111-0000-4000-8000-0000000000a1';
const I_A2 = '11111111-0000-4000-8000-0000000000a2';
const I_A3 = '11111111-0000-4000-8000-0000000000a3';
const I_B1 = '11111111-0000-4000-8000-0000000000b1';

const seedInquiries = (): Row[] => [
  inquiry(I_A1, 'portal-alpha', 'p-alpha', 'First Visitor', 1),
  inquiry(I_A2, 'portal-alpha', 'p-alpha', 'Second Visitor', 2),
  inquiry(I_A3, 'portal-alpha-two', 'p-alpha-2', 'Third Visitor', 3),
  inquiry(I_B1, 'portal-beta', 'p-beta', 'Fourth Visitor', 4),
];

let practitioners: Row[] = [];
let inquiries: Row[] = [];
let contacts: Row[] = [];
let log: Array<{ sql: string; params: unknown[] }> = [];
let unmodelled: string[] = [];
const cookieJar: Record<string, string> = {};

/* ── a deliberately small SQL model — it refuses what it does not model ──── */

const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim();

/** WHERE a = $1 AND b = 'x' … → predicate. Anything else (OR, LIKE, IN …) is refused, not guessed at. */
function predicate(sql: string, params: unknown[]): (row: Row) => boolean {
  const m = /\bWHERE (.+?)(?: ORDER BY| LIMIT| RETURNING|$)/.exec(sql);
  if (!m) throw new Error(`no WHERE in: ${sql}`);
  const terms = m[1]!.split(/ AND /);
  const tests = terms.map((term) => {
    const t = /^(?:\w+\.)?(\w+) = (?:\$(\d+)|'([^']*)')$/.exec(term.trim());
    if (!t) throw new Error(`unmodelled condition "${term}" in: ${sql}`);
    const col = t[1]!;
    const want = t[2] !== undefined ? params[Number(t[2]) - 1] : t[3];
    return (row: Row) => row[col] === want;
  });
  return (row) => tests.every((fn) => fn(row));
}

async function fakeQuery(rawSql: string, params: unknown[] = []): Promise<{ rows: Row[]; rowCount: number }> {
  const sql = norm(rawSql);
  log.push({ sql, params });
  const out = (rows: Row[]) => ({ rows, rowCount: rows.length });

  if (/^SELECT s\.member_id, m\.tier, m\.roles FROM auth_sessions s/.test(sql)) {
    const member = TOKENS[String(params[0])];
    return out(member ? [{ member_id: member, tier: 'free', roles: [] }] : []);
  }
  if (/FROM practitioners p JOIN members m ON m\.id = p\.member_id WHERE/.test(sql)) {
    const hit = practitioners.filter(predicate(sql, params))[0];
    return out(hit ? [{ practitioner_id: hit.id, slug: hit.slug, name: hit.name, portal_type: hit.portal_type, enabled_modules: hit.enabled_modules, studio_mode: 'practice' }] : []);
  }
  if (/^SELECT [\w., ]+ FROM practitioners WHERE/.test(sql)) {
    return out(practitioners.filter(predicate(sql, params)));
  }
  if (/^SELECT COUNT\(\*\) FROM portal_inquiries WHERE/.test(sql)) {
    return out([{ count: String(inquiries.filter(predicate(sql, params)).length) }]);
  }
  if (/^SELECT [\w., ]+ FROM portal_inquiries WHERE/.test(sql)) {
    const paging = /LIMIT \$(\d+) OFFSET \$(\d+)/.exec(sql);
    if (!paging) throw new Error(`unmodelled paging in: ${sql}`);
    const limit = Number(params[Number(paging[1]) - 1]);
    const offset = Number(params[Number(paging[2]) - 1]);
    const rows = inquiries
      .filter(predicate(sql, params))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(offset, offset + limit);
    return out(rows.map((r) => ({ ...r })));
  }
  if (/^UPDATE portal_inquiries SET status = \$1 WHERE .+ RETURNING id, status$/.test(sql)) {
    const hits = inquiries.filter(predicate(sql.replace('SET status = $1 ', ''), params));
    for (const h of hits) h.status = params[0];
    return out(hits.map((h) => ({ id: h.id, status: h.status })));
  }
  const insert = /^INSERT INTO (portal_inquiries|marketing_contacts) \(([^)]*)\) VALUES \(([^)]*)\)/.exec(sql);
  if (insert) {
    const cols = insert[2]!.split(',').map((c) => c.trim());
    const vals = insert[3]!.split(',').map((v) => v.trim());
    const row: Row = {};
    cols.forEach((c, i) => {
      const v = vals[i]!;
      row[c] = v.startsWith('$') ? params[Number(v.slice(1)) - 1] : v.replace(/^'|'$/g, '');
    });
    (insert[1] === 'portal_inquiries' ? inquiries : contacts).push(row);
    return out([]);
  }
  if (/^SELECT id FROM marketing_contacts WHERE/.test(sql)) return out([]);
  unmodelled.push(sql);
  throw new Error(`unmodelled SQL: ${sql}`);
}

jest.mock('@/lib/db/postgres', () => ({
  __esModule: true,
  default: { query: (sql: string, params?: unknown[]) => fakeQuery(sql, params) },
  query: (sql: string, params?: unknown[]) => fakeQuery(sql, params),
}));
jest.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar[name] ? { value: cookieJar[name] } : undefined) }),
  headers: async () => new Headers(),
}));
jest.mock('@/lib/practitioner/features', () => ({
  getPractitionerFeaturesBySlug: async () => ({ inquiryFormEnabled: true }),
}));
jest.mock('@/lib/portal/notifications', () => ({
  sendInquiryNotification: async () => ({ success: false }),
}));
jest.mock('@/lib/focus/weightTracking', () => ({ logAction: async () => undefined }));

beforeEach(() => {
  practitioners = seedPractitioners();
  inquiries = seedInquiries();
  contacts = [];
  log = [];
  unmodelled = [];
  for (const k of Object.keys(cookieJar)) delete cookieJar[k];
});

/* ── driving a route module ──────────────────────────────────────────────── */

type Handler = (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => Promise<Response>;
interface RouteModule { GET: Handler; POST: Handler; PATCH: Handler }

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const url = (slug: string, query = '') => `https://soullab.example.test/api/portal/${slug}/inquiry${query}`;
const as = (token?: string, extra: Record<string, string> = {}) => ({ ...(token ? { 'x-session-token': token } : {}), ...extra });

const get = (r: RouteModule, slug: string, headers: Record<string, string> = {}, query = '') =>
  r.GET(new NextRequest(url(slug, query), { method: 'GET', headers }), ctx(slug));
const patch = (r: RouteModule, slug: string, body: Record<string, unknown>, headers: Record<string, string> = {}, query = '') =>
  r.PATCH(new NextRequest(url(slug, query), { method: 'PATCH', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }), ctx(slug));
const post = (r: RouteModule, slug: string, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  r.POST(new NextRequest(url(slug), { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }), ctx(slug));

const readInquiries = () => log.some((q) => /portal_inquiries/.test(q.sql) && /^SELECT/.test(q.sql));
const wroteInquiries = () => log.some((q) => /^UPDATE portal_inquiries/.test(q.sql));
const statusOf = (id: string) => inquiries.find((i) => i.id === id)?.status;
const idsOf = async (res: Response) => ((await res.json()) as { inquiries: Array<{ id: string }> }).inquiries.map((i) => i.id);

function expect_(cond: boolean, what: string): asserts cond {
  if (!cond) throw new Error(what);
}

/* ── the laws ─────────────────────────────────────────────────────────────── */

interface Law { id: string; says: string; run: (r: RouteModule) => Promise<void> }

const LAWS: Law[] = [
  {
    id: 'L1-unauthenticated-get-refused',
    says: 'GET with no credentials is 401 and no inquiry row is read or returned',
    async run(r) {
      const res = await get(r, 'portal-alpha');
      expect_(res.status === 401, `status ${res.status}`);
      expect_(!readInquiries(), 'inquiries were read');
      expect_(!/example\.test/.test(await res.text()), 'a visitor email was in the refusal');
    },
  },
  {
    id: 'L2-a-claim-is-not-an-identity',
    says: 'owner id supplied by header, cookie or query string, with no session, authenticates nobody',
    async run(r) {
      cookieJar['maia_member_id'] = M_ALPHA;
      const res = await get(r, 'portal-alpha', { 'x-member-id': M_ALPHA, 'x-maia-member-id': M_ALPHA }, `?member_id=${M_ALPHA}&practitioner_id=p-alpha`);
      expect_(res.status === 401, `status ${res.status}`);
      expect_(!readInquiries(), 'inquiries were read on a bare claim');
    },
  },
  {
    id: 'L3-other-practitioner-get-refused',
    says: 'a signed-in practitioner who does not own the portal gets 404 and no inquiry row is read',
    async run(r) {
      const res = await get(r, 'portal-alpha', as('token-beta'));
      expect_(res.status === 404, `status ${res.status}`);
      expect_(!readInquiries(), 'inquiries were read for a non-owner');
      expect_(!/example\.test/.test(await res.text()), 'a visitor email was in the refusal');
    },
  },
  {
    id: 'L4-non-owner-is-indistinguishable-from-absent',
    says: 'for a non-owner, an existing portal and a slug that does not exist answer identically',
    async run(r) {
      const existing = await get(r, 'portal-alpha', as('token-beta'));
      const absent = await get(r, 'no-such-portal', as('token-beta'));
      expect_(existing.status === absent.status, `status ${existing.status} vs ${absent.status}`);
      expect_((await existing.text()) === (await absent.text()), 'bodies differ');
    },
  },
  {
    id: 'L5-non-practitioner-get-refused',
    says: 'a signed-in member who is not a practitioner is refused (403) and no inquiry row is read',
    async run(r) {
      const res = await get(r, 'portal-alpha', as('token-plain'));
      expect_(res.status === 403, `status ${res.status}`);
      expect_(!readInquiries(), 'inquiries were read for a non-practitioner');
    },
  },
  {
    id: 'L6-owner-get-succeeds-and-is-scoped',
    says: 'the owner gets 200 with exactly their portal\'s inquiries, newest first, and the right total',
    async run(r) {
      const res = await get(r, 'portal-alpha', as('token-alpha'));
      expect_(res.status === 200, `status ${res.status}`);
      const body = (await res.json()) as { inquiries: Array<{ id: string }>; total: number };
      expect_(JSON.stringify(body.inquiries.map((i) => i.id)) === JSON.stringify([I_A2, I_A1]), `ids ${JSON.stringify(body.inquiries.map((i) => i.id))}`);
      expect_(body.total === 2, `total ${body.total}`);
    },
  },
  {
    id: 'L7-ownership-is-per-portal',
    says: 'an owner of two portals reads each, and is refused a third that is not theirs',
    async run(r) {
      const two = await get(r, 'portal-alpha-two', as('token-alpha'));
      expect_(two.status === 200, `own second portal: status ${two.status}`);
      expect_(JSON.stringify(await idsOf(two)) === JSON.stringify([I_A3]), 'second portal returned the wrong rows');
      const beta = await get(r, 'portal-beta', as('token-alpha'));
      expect_(beta.status === 404, `another practitioner's portal: status ${beta.status}`);
    },
  },
  {
    id: 'L8-unauthenticated-patch-refused',
    says: 'PATCH with no credentials is 401 and no inquiry changes',
    async run(r) {
      const res = await patch(r, 'portal-alpha', { inquiry_id: I_A1, status: 'archived' });
      expect_(res.status === 401, `status ${res.status}`);
      expect_(statusOf(I_A1) === 'new', `status became ${String(statusOf(I_A1))}`);
      expect_(!wroteInquiries(), 'an UPDATE was issued');
    },
  },
  {
    id: 'L9-a-claim-is-not-an-identity-patch',
    says: 'owner id supplied by header, query string or body, with no session, changes nothing',
    async run(r) {
      const res = await patch(r, 'portal-alpha',
        { inquiry_id: I_A1, status: 'archived', member_id: M_ALPHA, practitioner_id: 'p-alpha' },
        { 'x-member-id': M_ALPHA }, `?member_id=${M_ALPHA}`);
      expect_(res.status === 401, `status ${res.status}`);
      expect_(statusOf(I_A1) === 'new', `status became ${String(statusOf(I_A1))}`);
      expect_(!wroteInquiries(), 'an UPDATE was issued on a bare claim');
    },
  },
  {
    id: 'L10-other-practitioner-patch-refused',
    says: 'a signed-in practitioner who does not own the portal gets 404 and no inquiry changes',
    async run(r) {
      const res = await patch(r, 'portal-alpha', { inquiry_id: I_A1, status: 'archived' }, as('token-beta'));
      expect_(res.status === 404, `status ${res.status}`);
      expect_(statusOf(I_A1) === 'new', `status became ${String(statusOf(I_A1))}`);
      expect_(!wroteInquiries(), 'an UPDATE was issued for a non-owner');
    },
  },
  {
    id: 'L11-owner-patch-succeeds',
    says: 'the owner changes the status of their own inquiry, and only that one',
    async run(r) {
      const res = await patch(r, 'portal-alpha', { inquiry_id: I_A1, status: 'replied' }, as('token-alpha'));
      expect_(res.status === 200, `status ${res.status}`);
      expect_(statusOf(I_A1) === 'replied', `status is ${String(statusOf(I_A1))}`);
      expect_(statusOf(I_A2) === 'new', 'a neighbouring inquiry changed');
    },
  },
  {
    id: 'L12-patch-stays-inside-the-portal',
    says: 'an owner cannot reach another portal\'s inquiry, by its id on their own slug or on the other slug',
    async run(r) {
      const viaOwnSlug = await patch(r, 'portal-alpha', { inquiry_id: I_B1, status: 'archived' }, as('token-alpha'));
      expect_(viaOwnSlug.status === 404, `own slug: status ${viaOwnSlug.status}`);
      const viaOtherSlug = await patch(r, 'portal-beta', { inquiry_id: I_B1, status: 'archived' }, as('token-alpha'));
      expect_(viaOtherSlug.status === 404, `other slug: status ${viaOtherSlug.status}`);
      expect_(statusOf(I_B1) === 'new', `status became ${String(statusOf(I_B1))}`);
    },
  },
  {
    id: 'L13-post-stays-public',
    says: 'POST with no credentials still creates the inquiry for the slug\'s practitioner and consults no session',
    async run(r) {
      const res = await post(r, 'portal-alpha', { name: 'Fictional Newcomer', email: 'newcomer@example.test', message: 'A fictional hello' });
      expect_(res.status === 200, `status ${res.status}`);
      const body = (await res.json()) as Record<string, unknown>;
      expect_(body.success === true && typeof body.inquiry_id === 'string', 'no success envelope');
      expect_(!('inquiries' in body), 'POST returned a list');
      const made = inquiries.find((i) => i.id === body.inquiry_id);
      expect_(made?.practitioner_id === 'p-alpha' && made?.portal_slug === 'portal-alpha', 'inquiry not stored against the slug\'s practitioner');
      expect_(!log.some((q) => /auth_sessions/.test(q.sql)), 'POST consulted a session');
    },
  },
  {
    id: 'L14-post-ignores-a-bad-credential',
    says: 'a visitor carrying a stale or invalid session token can still use the public form',
    async run(r) {
      const res = await post(r, 'portal-alpha', { message: 'A fictional hello' }, as('token-expired'));
      expect_(res.status === 200, `status ${res.status}`);
      expect_(inquiries.length === 5, 'the inquiry was not stored');
    },
  },
];

async function failures(r: RouteModule): Promise<string[]> {
  const failed: string[] = [];
  for (const law of LAWS) {
    practitioners = seedPractitioners();
    inquiries = seedInquiries();
    contacts = [];
    log = [];
    for (const k of Object.keys(cookieJar)) delete cookieJar[k];
    try {
      await law.run(r);
    } catch {
      failed.push(law.id);
    }
  }
  return failed;
}

/* ── the real route ──────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const real = require('../route') as RouteModule;

describe('portal inquiry route — the real route', () => {
  for (const law of LAWS) {
    it(`${law.id}: ${law.says}`, async () => {
      await law.run(real);
      expect(unmodelled).toEqual([]);
    });
  }
});

/* ── defeat candidates: hand-made wrong versions of the real route ───────── */

const ROUTE_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'route.ts'), 'utf8');

function mutate(src: string, from: string | RegExp, to: string): string {
  if (typeof from === 'string') {
    const n = src.split(from).length - 1;
    if (n !== 1) throw new Error(`mutation target must occur exactly once (found ${n}): ${from.slice(0, 70)}`);
    return src.replace(from, () => to);
  }
  if (!from.test(src)) throw new Error(`mutation pattern did not match: ${String(from)}`);
  return src.replace(from, () => to);
}

/** Compile mutated route source and bind its imports to the same jest-mocked modules the real route sees. */
function load(source: string): RouteModule {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} as Record<string, unknown> };
  new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
  return mod.exports as unknown as RouteModule;
}

const GUARD_FN = /async function authorizePortalOwner\([\s\S]*?\n}\n/;
const GUARD_CALL = `const guard = await authorizePortalOwner(request, slug);
    if ('error' in guard) return guard.error;`;

const SLUG_ONLY_FN = `async function authorizePortalOwner(request: NextRequest, slug: string) {
  const found = await db.query(\`SELECT id FROM practitioners WHERE slug = $1 AND status = 'active'\`, [slug]);
  if (found.rows.length === 0) return { error: NextResponse.json({ error: 'Portal not found' }, { status: 404 }) };
  return { practitionerId: found.rows[0].id as string };
}
`;

interface Candidate { name: string; mutate: (s: string) => string; breaks: string[] }

const CANDIDATES: Candidate[] = [
  {
    // The shape this change replaces: the slug alone selects the practitioner. Nobody is asked who they are.
    name: 'DC1 the slug alone selects the practitioner (no identity, no ownership)',
    mutate: (s) => mutate(s, GUARD_FN, SLUG_ONLY_FN),
    breaks: ['L1-unauthenticated-get-refused', 'L2-a-claim-is-not-an-identity', 'L3-other-practitioner-get-refused', 'L4-non-owner-is-indistinguishable-from-absent',
      'L5-non-practitioner-get-refused', 'L7-ownership-is-per-portal', 'L8-unauthenticated-patch-refused', 'L9-a-claim-is-not-an-identity-patch',
      'L10-other-practitioner-patch-refused', 'L12-patch-stays-inside-the-portal'],
  },
  {
    name: 'DC2 authenticates the caller but never asks whether the portal is theirs',
    mutate: (s) => mutate(s, GUARD_FN, `async function authorizePortalOwner(request: NextRequest, slug: string) {
  const auth = await requirePractitioner(request);
  if ('error' in auth) return { error: auth.error };
  const found = await db.query(\`SELECT id FROM practitioners WHERE slug = $1 AND status = 'active'\`, [slug]);
  if (found.rows.length === 0) return { error: NextResponse.json({ error: 'Portal not found' }, { status: 404 }) };
  return { practitionerId: found.rows[0].id as string };
}
`),
    breaks: ['L3-other-practitioner-get-refused', 'L4-non-owner-is-indistinguishable-from-absent', 'L7-ownership-is-per-portal',
      'L10-other-practitioner-patch-refused', 'L12-patch-stays-inside-the-portal'],
  },
  {
    // The plausible wrong version: the session is honoured, and where there is none a caller-supplied id
    // (a header, the query string, or the body) is accepted instead, e.g. "for native clients".
    name: 'DC3 falls back to a member id supplied in a header, the query string or the body when there is no session',
    mutate: (s) => mutate(s, GUARD_FN, `async function authorizePortalOwner(request: NextRequest, slug: string) {
  const auth = await requirePractitioner(request);
  let memberId: string | undefined;
  if ('error' in auth) {
    const body = await request.clone().json().catch(() => ({}));
    memberId = request.headers.get('x-member-id') ?? new URL(request.url).searchParams.get('member_id') ?? (body as { member_id?: string }).member_id ?? undefined;
    if (!memberId) return { error: auth.error };
  } else {
    memberId = auth.identity.memberId;
  }
  const owned = await db.query(\`SELECT id FROM practitioners WHERE slug = $1 AND member_id = $2 AND status = 'active'\`, [slug, memberId]);
  if (owned.rows.length === 0) return { error: NextResponse.json({ error: 'Portal not found' }, { status: 404 }) };
  return { practitionerId: owned.rows[0].id as string };
}
`),
    breaks: ['L2-a-claim-is-not-an-identity', 'L9-a-claim-is-not-an-identity-patch'],
  },
  {
    name: 'DC4 protects GET but not PATCH',
    mutate: (s) => {
      const patched = s.slice(s.indexOf('export async function PATCH'));
      return s.replace(patched, mutate(patched, GUARD_CALL, ''));
    },
    breaks: ['L8-unauthenticated-patch-refused', 'L9-a-claim-is-not-an-identity-patch', 'L10-other-practitioner-patch-refused', 'L12-patch-stays-inside-the-portal'],
  },
  {
    name: 'DC5 protects PATCH but not GET',
    mutate: (s) => {
      const head = s.slice(0, s.indexOf('export async function PATCH'));
      const tail = s.slice(s.indexOf('export async function PATCH'));
      return mutate(head, GUARD_CALL, `const guard = { practitionerId: (await db.query(\`SELECT id FROM practitioners WHERE slug = $1 AND status = 'active'\`, [slug])).rows[0]?.id as string };
    if (!guard.practitionerId) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });`) + tail;
    },
    breaks: ['L1-unauthenticated-get-refused', 'L2-a-claim-is-not-an-identity', 'L3-other-practitioner-get-refused', 'L4-non-owner-is-indistinguishable-from-absent', 'L5-non-practitioner-get-refused', 'L7-ownership-is-per-portal'],
  },
  {
    // Over-correction: the public contact form is gated too, so a visitor can no longer write to a practitioner.
    name: 'DC6 gates POST as well, so the public contact form stops working',
    mutate: (s) => mutate(s, `    const { slug } = await params;
    const body = await request.json();
    const { name, email, phone, timezone, topic, message } = body;`, `    const { slug } = await params;
    const guard = await authorizePortalOwner(request, slug);
    if ('error' in guard) return guard.error;
    const body = await request.json();
    const { name, email, phone, timezone, topic, message } = body;`),
    breaks: ['L13-post-stays-public', 'L14-post-ignores-a-bad-credential'],
  },
  {
    // A 403 on a portal that exists and a 404 on one that does not lets any signed-in practitioner enumerate portal slugs.
    name: 'DC7 tells a non-owner that the portal exists but is not theirs',
    mutate: (s) => mutate(s, `  if (owned.rows.length === 0) {
    return { error: NextResponse.json({ error: 'Portal not found' }, { status: 404 }) };
  }`, `  if (owned.rows.length === 0) {
    const exists = await db.query(\`SELECT id FROM practitioners WHERE slug = $1 AND status = 'active'\`, [slug]);
    return exists.rows.length === 0
      ? { error: NextResponse.json({ error: 'Portal not found' }, { status: 404 }) }
      : { error: NextResponse.json({ error: 'Not the owner of this portal' }, { status: 403 }) };
  }`),
    breaks: ['L3-other-practitioner-get-refused', 'L4-non-owner-is-indistinguishable-from-absent', 'L7-ownership-is-per-portal', 'L10-other-practitioner-patch-refused', 'L12-patch-stays-inside-the-portal'],
  },
];

describe('portal inquiry route — defeat candidates (each wrong version must break exactly the laws it names)', () => {
  it('the loader is faithful: the unmutated source passes every law', async () => {
    expect(await failures(load(ROUTE_SOURCE))).toEqual([]);
  });

  for (const c of CANDIDATES) {
    it(`${c.name}`, async () => {
      const wrong = c.mutate(ROUTE_SOURCE);
      expect(wrong).not.toBe(ROUTE_SOURCE); // the mutation actually applied
      const broken = await failures(load(wrong));
      expect(broken.sort()).toEqual([...c.breaks].sort());
    });
  }
});
