/**
 * PRACTITIONER-API-IDENTITY-01 — static guard · no route under the four practitioner API
 * families may take its ACTING identity from the request.
 *
 *   app/api/caseload/**   app/api/practice/**   app/api/supervision/**   app/api/practitioners/**
 *
 * ⛔ NOT the primary proof. The behavioural two-account suites next to each family are
 * (`caseload/__tests__`, `practice/__tests__`, `practitioners/__tests__`). This is the
 * source-structural guard, same evidence class as `rawIdentityAuthorityGuard.test.ts`: it
 * exists so a future handler cannot CASUALLY reintroduce `?memberId=` / `body.memberId` /
 * `practitionerId` as who-is-acting. `rawIdentityAuthorityGuard` censuses `x-member-id`
 * headers repo-wide and pins a `?memberId=` count; it does not see a BODY field at all, and
 * body fields were the larger half of this defect.
 *
 * WHAT IT FLAGS, as the acting identity (memberId · practitionerId · userId and their
 * snake_case forms): a query read (`.get('memberId')` — searchParams, FormData alike); a
 * property or bracket read on a request body (`body.memberId`, `body['memberId']`, and on any
 * variable assigned from `await x.json()`); `(await x.json()).memberId`; and destructuring
 * from any of those. A fallback (`session ?? body.memberId`) is the same read and is flagged
 * the same way — the rule is "no read", not "no read first".
 *
 * AND, per HANDLER (the unit of exposure — a file can mix a fixed handler with an open one),
 * that each exported GET/POST/PATCH/PUT/DELETE derives a session identity.
 *
 * THREE NAMED SETS, the work NOT done by this unit, each a RATCHET (a stale entry FAILS, so a
 * set can only shrink). Enforced as law until a product decision lets them close:
 *   OPEN_ACTING_IDENTITY      files still reading identity from the request
 *   OPEN_NO_SESSION_IDENTITY  handlers that derive no session identity (resource-id only)
 *   OPEN_UNOWNED_RESOURCE     handlers that DO authenticate but never compare the session
 *                             member to the owner of the session/resource id they act on
 *
 * LETHALITY: the scanners are functions; they are run against defeat candidates built by
 * mutating the real, fixed route sources. A guard that only ever saw conforming code is not
 * evidence.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');

const FAMILIES = ['app/api/caseload', 'app/api/practice', 'app/api/supervision', 'app/api/practitioners'];

const KEY = '(?:memberId|practitionerId|userId|member_id|practitioner_id|user_id)';

/** Fields that ARE identity-named but are RESOURCE ids, allowed only with ownership evidence. */
const RESOURCE_ID_FIELDS: Record<string, string[]> = {
  // practitioners.id — checked against the session member's own row (`member_id = $2`).
  'app/api/practitioners/onboarding/route.ts': ['practitionerId'],
};

/**
 * ⛔ OPEN — files still reading ACTING identity from the request. Not repaired by this unit.
 * Must SHRINK, never grow.
 */
const OPEN_ACTING_IDENTITY: Record<string, string> = {
  'app/api/supervision/session/start/route.ts':
    'body.practitionerId. Replacing it with the session identity also decides the active-session 409 ' +
    '(today enforced only when the client supplied the id; the scribe/studio flows never do) and starts ' +
    'giving every new session an owner. A product decision, not a mechanical swap.',
  'app/api/supervision/sessions/route.ts':
    '?practitionerId= — and with none supplied it lists EVERY supervision session. Scoping it to the ' +
    'session member empties the list for the (majority) sessions that were created with no owner.',
};

/**
 * ⛔ OPEN — handlers that derive NO session identity: they are addressed by a session id alone.
 * The ownership check they need depends on a decision about legacy UNOWNED rows:
 * practice_sessions.practitioner_id is nullable, and getSession() falls back to supervision_sessions,
 * whose rows are overwhelmingly created with no owner (the live-scribe and studio recorders never
 * send one). Deny-unowned breaks PracticePanel and the supervision list; allow-unowned leaves the
 * hole. Keys are `file::METHOD`. Must SHRINK, never grow.
 */
const OPEN_NO_SESSION_IDENTITY: Record<string, string> = {
  'app/api/practice/insights/generate/route.ts::POST': 'sessionId only; PracticePanel calls it for supervision sessions that have no owner',
  'app/api/practice/insights/generate/route.ts::GET': 'sessionId only',
  'app/api/practice/insights/list/route.ts::GET': 'sessionId only',
  'app/api/practice/insights/list/route.ts::POST': 'sessionId only; adds an insight to any session',
  'app/api/practice/session/stop/route.ts::POST': 'sessionId only; stops any session',
  'app/api/practice/session/worlds/route.ts::GET': 'sessionId only',
  'app/api/practice/session/worlds/route.ts::POST': 'sessionId only; records a world on any session',
  'app/api/practice/sessions/route.ts::PATCH': 'sessionId only; updates any session (the LIST branch of GET is fixed)',
  'app/api/practice/transcript/route.ts::GET': 'sessionId only; transcript text is PHI',
  'app/api/practice/transcript/route.ts::POST': 'sessionId only; adds a transcript segment to any session',
  'app/api/practice/worlds/detect/route.ts::POST': 'optional recordDetections writes session_worlds for any sessionId',
  'app/api/supervision/insights/list/route.ts::GET': 'sessionId only',
  'app/api/supervision/insights/stream/route.ts::GET': 'sessionId only (SSE)',
  'app/api/supervision/scribe/route.ts::GET': 'sessionId only (SSE)',
  'app/api/supervision/session/[id]/essence/route.ts::GET': 'session id only',
  'app/api/supervision/session/[id]/route.ts::GET': 'session id only',
  'app/api/supervision/session/[id]/route.ts::PATCH': 'session id only',
  'app/api/supervision/session/[id]/route.ts::DELETE': 'session id only — documented "admin only", checks nothing',
  'app/api/supervision/session/start/route.ts::POST': 'reads body.practitionerId; derives no session identity (also OPEN_ACTING_IDENTITY)',
  'app/api/supervision/session/stop/route.ts::POST': 'sessionId only',
  'app/api/supervision/sessions/route.ts::GET': 'reads ?practitionerId=; derives no session identity (also OPEN_ACTING_IDENTITY)',
  'app/api/supervision/transcript/list/route.ts::POST': 'writes transcript segments for any sessionId (its GET is lab-gated)',
};

/** Handlers that need no identity by design. Keys are `file::METHOD`. */
const PUBLIC_BY_DESIGN: Record<string, string> = {
  'app/api/practice/worlds/list/route.ts::GET': 'catalogue of practice worlds; no member data',
  'app/api/practitioners/check/route.ts::GET': 'slug availability; public in the access matrix, no member data (its POST is session-derived)',
};

/**
 * ⛔ OPEN — handlers that authenticate, but never compare the session member to the owner of the
 * session id they act on. `contains` must still match the handler: when it stops matching, the
 * handler was changed and the entry must be re-examined, not left to rot. Keys are `file::METHOD`.
 */
const OPEN_UNOWNED_RESOURCE: Record<string, { contains: RegExp; reason: string }> = {
  'app/api/practice/sessions/route.ts::GET': {
    contains: /getSession\(sessionId\)/,
    reason: 'the single-session lookup (?sessionId=) returns any session; only the LIST branch is scoped',
  },
  'app/api/supervision/transcript/list/route.ts::GET': {
    contains: /getSession\(sessionId\)/,
    reason: 'lab-gated, but returns the transcript of any sessionId',
  },
  'app/api/supervision/transcript/stream/route.ts::POST': {
    contains: /getSession\(sessionId\)/,
    reason: 'authenticated, but accepts an audio chunk for any sessionId',
  },
  'app/api/supervision/transcript/stream/route.ts::GET': {
    contains: /searchParams\.get\('sessionId'\)/,
    reason: 'authenticated, but streams the transcript of any sessionId',
  },
};

const SESSION_HELPER =
  /\b(?:requireSessionMember|getMemberIdFromRequest|requirePractitioner|getCurrentPractitioner|getAuthenticatedMember|requireLabAccess|getCurrentSession)\s*\(/;

/* ── scanners ───────────────────────────────────────────────────────────────── */

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
}

/** names a request body is held under: the usual ones plus any `const x = await req.json()` */
function bodyLikeNames(code: string): string[] {
  const names = new Set(['body', 'data', 'payload', 'json', 'input', 'form', 'formData']);
  for (const m of code.matchAll(/(?:const|let|var)\s+(\w+)\s*(?::[^=\n]+)?=\s*await\s+[\w.$]+\.(?:json|formData)\(\)/g)) {
    names.add(m[1]!);
  }
  return [...names];
}

export function findIdentityFromRequest(src: string, opts: { resourceKeys?: string[] } = {}): string[] {
  const code = stripComments(src);
  const found = new Set<string>();
  const allowed = new Set(opts.resourceKeys ?? []);
  const add = (key: string, form: string) => {
    if (!allowed.has(key)) found.add(`${key} via ${form}`);
  };
  const names = bodyLikeNames(code).join('|');

  // `.get('memberId')` — URLSearchParams and FormData alike
  for (const m of code.matchAll(new RegExp(`\\.get\\(\\s*['"\`](${KEY})['"\`]\\s*\\)`, 'g'))) add(m[1]!, '.get()');
  // body.memberId / body?.memberId
  for (const m of code.matchAll(new RegExp(`\\b(?:${names})\\s*\\??\\.\\s*(${KEY})\\b`, 'g'))) add(m[1]!, 'property read');
  // body['memberId']
  for (const m of code.matchAll(new RegExp(`\\b(?:${names})\\s*\\[\\s*['"\`](${KEY})['"\`]\\s*\\]`, 'g'))) add(m[1]!, 'bracket read');
  // (await req.json()).memberId
  for (const m of code.matchAll(new RegExp(`\\.(?:json|formData)\\(\\)\\s*\\)\\s*\\??\\.\\s*(${KEY})\\b`, 'g'))) add(m[1]!, 'inline json read');
  // const { memberId, ... } = body | await req.json() | searchParams
  for (const m of code.matchAll(/\{([^{}]*)\}\s*=\s*(?:await\s+)?([\w$.]+(?:\(\))?)/g)) {
    const rhs = m[2]!;
    const isRequest = new RegExp(`^(?:${names})$|\\.(?:json|formData)\\(\\)$|searchParams$`).test(rhs);
    if (!isRequest) continue;
    for (const k of m[1]!.matchAll(new RegExp(`\\b(${KEY})\\b`, 'g'))) add(k[1]!, 'destructure');
  }
  return [...found].sort();
}

/** the exported HTTP handlers of a route file, each with its own body (top-level `}` ends one) */
export function handlersOf(src: string): Array<{ method: string; body: string }> {
  const code = stripComments(src);
  const out: Array<{ method: string; body: string }> = [];
  const re = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    const rest = code.slice(m.index);
    const end = rest.search(/\n\}\s*(?:\n|$)/);
    out.push({ method: m[1]!, body: end < 0 ? rest : rest.slice(0, end + 2) });
  }
  return out;
}

export const derivesSessionIdentity = (body: string): boolean => SESSION_HELPER.test(stripComments(body));

/** a resource-id field is only allowed when the file shows the ownership predicate */
function hasOwnershipEvidence(src: string): boolean {
  const code = stripComments(src);
  return /\brequireSessionMember\s*\(/.test(code) && /member_id\s*=\s*\$2/.test(code);
}

/* ── population ─────────────────────────────────────────────────────────────── */

function routeFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') routeFiles(full, acc);
    } else if (/^route\.(ts|tsx|js)$/.test(entry)) {
      acc.push(path.relative(repoRoot, full));
    }
  }
  return acc;
}

const files = FAMILIES.flatMap((f) => routeFiles(path.join(repoRoot, f)));
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), 'utf8');
const handlers = files.flatMap((rel) => handlersOf(read(rel)).map((h) => ({ key: `${rel}::${h.method}`, rel, ...h })));

function violationsOf(rel: string): string[] {
  const src = read(rel);
  const rk = RESOURCE_ID_FIELDS[rel];
  return findIdentityFromRequest(src, { resourceKeys: rk && hasOwnershipEvidence(src) ? rk : [] });
}

/* ── the guard ──────────────────────────────────────────────────────────────── */

describe('PRACTITIONER-API-IDENTITY-01 · static guard — acting identity is never read from the request', () => {
  it('finds the population (the guard is not vacuously passing)', () => {
    expect(files.length).toBeGreaterThanOrEqual(38);
    expect(handlers.length).toBeGreaterThanOrEqual(62);
    for (const fam of FAMILIES) expect(files.some((f) => f.startsWith(`${fam}/`))).toBe(true);
    const keys = new Set(handlers.map((h) => h.key));
    for (const k of [...Object.keys(OPEN_NO_SESSION_IDENTITY), ...Object.keys(PUBLIC_BY_DESIGN), ...Object.keys(OPEN_UNOWNED_RESOURCE)]) {
      expect(keys.has(k)).toBe(true);
    }
    for (const rel of [...Object.keys(OPEN_ACTING_IDENTITY), ...Object.keys(RESOURCE_ID_FIELDS)]) expect(files).toContain(rel);
  });

  it('no route reads its acting identity from the query string or body, outside the open set', () => {
    const offenders = files
      .filter((rel) => !(rel in OPEN_ACTING_IDENTITY))
      .map((rel) => ({ rel, v: violationsOf(rel) }))
      .filter((x) => x.v.length > 0)
      .map((x) => `${x.rel} — ${x.v.join('; ')}`);
    expect(offenders).toEqual([]);
  });

  it('OPEN_ACTING_IDENTITY is a RATCHET: every entry still violates (fix a route and its entry must go)', () => {
    expect(Object.keys(OPEN_ACTING_IDENTITY).filter((rel) => violationsOf(rel).length === 0)).toEqual([]);
  });

  it('every handler derives a session identity, outside the open and public sets', () => {
    const offenders = handlers
      .filter((h) => !(h.key in OPEN_NO_SESSION_IDENTITY) && !(h.key in PUBLIC_BY_DESIGN) && !derivesSessionIdentity(h.body))
      .map((h) => h.key);
    expect(offenders).toEqual([]);
  });

  it('OPEN_NO_SESSION_IDENTITY is a RATCHET: every entry still lacks a session identity', () => {
    const stale = handlers.filter((h) => h.key in OPEN_NO_SESSION_IDENTITY && derivesSessionIdentity(h.body)).map((h) => h.key);
    expect(stale).toEqual([]);
  });

  it('OPEN_UNOWNED_RESOURCE is a RATCHET: each entry authenticates and still acts on the unowned id', () => {
    for (const [key, { contains }] of Object.entries(OPEN_UNOWNED_RESOURCE)) {
      const h = handlers.find((x) => x.key === key)!;
      expect(derivesSessionIdentity(h.body)).toBe(true);
      expect(contains.test(stripComments(h.body))).toBe(true);
    }
  });

  it('the three open sets do not overlap, and no handler is both open and public', () => {
    const a = Object.keys(OPEN_NO_SESSION_IDENTITY);
    const b = Object.keys(PUBLIC_BY_DESIGN);
    const c = Object.keys(OPEN_UNOWNED_RESOURCE);
    expect(new Set([...a, ...b, ...c]).size).toBe(a.length + b.length + c.length);
  });

  it('resource-id exemptions hold only with ownership evidence', () => {
    for (const [rel, keys] of Object.entries(RESOURCE_ID_FIELDS)) {
      expect(keys.length).toBeGreaterThan(0);
      expect(hasOwnershipEvidence(read(rel))).toBe(true);
    }
  });

  it('every open entry carries a reason', () => {
    const reasons = [
      ...Object.values(OPEN_ACTING_IDENTITY),
      ...Object.values(OPEN_NO_SESSION_IDENTITY),
      ...Object.values(PUBLIC_BY_DESIGN),
      ...Object.values(OPEN_UNOWNED_RESOURCE).map((x) => x.reason),
    ];
    for (const r of reasons) expect(r.length).toBeGreaterThan(12);
  });
});

/* ── LETHALITY: defeat candidates, each built by mutating a real fixed route ──── */

describe('PRACTITIONER-API-IDENTITY-01 · static guard — defeat candidates (each must be caught)', () => {
  const NOTES = 'app/api/caseload/[caseId]/notes/route.ts';
  const CASELOAD_LIST = 'app/api/caseload/list/route.ts';
  const GROWTH = 'app/api/practice/growth/route.ts';
  const ONBOARDING = 'app/api/practitioners/onboarding/route.ts';

  /** apply a mutation to a real source; refuse to run if it did not actually change anything */
  function mutate(rel: string, from: string | RegExp, to: string): string {
    const src = read(rel);
    const out = src.replace(from, to);
    if (out === src) throw new Error(`mutation did not apply to ${rel}: ${String(from)}`);
    return out;
  }

  it('control: the real, fixed sources are clean', () => {
    for (const rel of [NOTES, CASELOAD_LIST, GROWTH, 'app/api/practitioners/create/route.ts', ONBOARDING]) {
      expect(violationsOf(rel)).toEqual([]);
    }
  });

  it("DC-G1 a query read comes back: searchParams.get('memberId')", () => {
    const src = mutate(NOTES, /const caseData\b/, "const memberId = searchParams.get('memberId');\n    const caseData");
    expect(findIdentityFromRequest(src).join()).toMatch(/memberId via \.get\(\)/);
  });

  it('DC-G2 the double-quoted and nextUrl forms are the same read', () => {
    const src = mutate(NOTES, /const caseData\b/, 'const memberId = request.nextUrl.searchParams.get("memberId");\n    const caseData');
    expect(findIdentityFromRequest(src).join()).toMatch(/memberId via \.get\(\)/);
  });

  it('DC-G3 destructuring the body comes back: const { memberId, ...x } = body', () => {
    const src = mutate(CASELOAD_LIST, /const caseInput\b[^\n]*/, 'const { memberId, ...caseInput } = body;');
    expect(findIdentityFromRequest(src).join()).toMatch(/memberId via destructure/);
  });

  it('DC-G4 destructuring straight from await req.json() is caught', () => {
    const src = mutate(GROWTH, /const \{\s*growthType,/, 'const { practitionerId, growthType,');
    expect(findIdentityFromRequest(src).join()).toMatch(/practitionerId via destructure/);
  });

  it('DC-G5 a fallback is still a read: actor.memberId ?? body.memberId', () => {
    const src = mutate(NOTES, /const caseData\b/, 'const memberId2 = actor.memberId ?? body.memberId;\n    const caseData');
    expect(findIdentityFromRequest(src).join()).toMatch(/memberId via property read/);
  });

  it("DC-G6 bracket access: body['practitionerId']", () => {
    const src = mutate(GROWTH, /return NextResponse\.json\(\{\s*success: true,\s*growth\s*\}\);/, "const who = body['practitionerId']; return NextResponse.json({ success: true, growth });");
    expect(findIdentityFromRequest(src).join()).toMatch(/practitionerId via bracket read/);
  });

  it('DC-G7 inline: (await request.json()).memberId', () => {
    const src = mutate(NOTES, /const caseData\b/, 'const memberId = (await request.json()).memberId;\n    const caseData');
    expect(findIdentityFromRequest(src).join()).toMatch(/memberId via inline json read/);
  });

  it('DC-G8 the body renamed first: const b = await req.json(); b.practitionerId', () => {
    const src = mutate(GROWTH, /export async function PATCH\(req: NextRequest\) \{/, 'export async function PATCH(req: NextRequest) {\n  const b = await req.json();\n  const who = b.practitionerId;');
    expect(findIdentityFromRequest(src).join()).toMatch(/practitionerId via property read/);
  });

  it("DC-G9 FormData: formData.get('memberId') on an upload-style route", () => {
    const src = 'export async function POST(r){ const formData = await r.formData(); const memberId = formData.get("memberId"); }';
    expect(findIdentityFromRequest(src).join()).toMatch(/memberId via \.get\(\)/);
  });

  it('DC-G10 snake_case and userId spellings are the same channel', () => {
    expect(findIdentityFromRequest("const a = searchParams.get('member_id');").length).toBe(1);
    expect(findIdentityFromRequest('const a = body.practitioner_id;').length).toBe(1);
    expect(findIdentityFromRequest('const { userId } = await request.json();').length).toBe(1);
  });

  it('DC-G11 the session helper removed from ONE handler of a fixed route is caught, and only that handler', () => {
    // caseload/list exports GET and POST; strip the helper from POST alone.
    const src = read(CASELOAD_LIST);
    const post = src.indexOf('export async function POST');
    expect(post).toBeGreaterThan(0);
    const mutated = src.slice(0, post) + src.slice(post).replace(/await requireSessionMember\(/, 'await somethingElse(');
    expect(mutated).not.toBe(src);
    const hs = handlersOf(mutated);
    expect(hs.find((h) => h.method === 'GET')!.body).toBeDefined();
    expect(derivesSessionIdentity(hs.find((h) => h.method === 'GET')!.body)).toBe(true);
    expect(derivesSessionIdentity(hs.find((h) => h.method === 'POST')!.body)).toBe(false);
    // and the real source has both
    for (const h of handlersOf(src)) expect(derivesSessionIdentity(h.body)).toBe(true);
  });

  it('DC-G12 a helper that is only MENTIONED in a comment does not count as deriving identity', () => {
    const src = '// requireSessionMember(request) goes here\nexport async function GET(){\n  return 1;\n}\n';
    expect(handlersOf(src).map((h) => derivesSessionIdentity(h.body))).toEqual([false]);
  });

  it('DC-G13 the resource-id exemption without its ownership predicate is NOT allowed', () => {
    const src = mutate(ONBOARDING, /member_id\s*=\s*\$2/g, 'id = $1');
    expect(hasOwnershipEvidence(src)).toBe(false);
    // with no evidence the exemption is not granted, so the read is flagged
    expect(findIdentityFromRequest(src, { resourceKeys: [] }).join()).toMatch(/practitionerId/);
  });

  it('DC-G14 the exemption covers ONLY the named key: a memberId read in the exempt file is still flagged', () => {
    const src = read(ONBOARDING) + '\nconst x = body.memberId;';
    expect(findIdentityFromRequest(src, { resourceKeys: ['practitionerId'] }).join()).toMatch(/memberId via property read/);
  });

  it('DC-G15 comments that describe the old shape do not trip the guard (no false positive on prose)', () => {
    expect(findIdentityFromRequest("// was: searchParams.get('memberId')\n/* body.practitionerId */\nconst ok = 1;")).toEqual([]);
  });

  it('DC-G16 a NEW handler with no session identity is not in any open set, so the guard would fail it', () => {
    const src = 'export async function GET(request) {\n  return Response.json({});\n}\n';
    const h = handlersOf(src)[0]!;
    const key = 'app/api/practice/brand-new/route.ts::GET';
    expect(derivesSessionIdentity(h.body)).toBe(false);
    expect(key in OPEN_NO_SESSION_IDENTITY || key in PUBLIC_BY_DESIGN).toBe(false);
  });

  it('DC-G17 an open-set entry whose handler gained a session identity is STALE and would fail the ratchet', () => {
    // practice/session/stop::POST is open; give it the helper and the ratchet condition flips.
    const rel = 'app/api/practice/session/stop/route.ts';
    const src = mutate(rel, /try \{/, 'try {\n    const actor = await requireSessionMember(req);');
    const h = handlersOf(src).find((x) => x.method === 'POST')!;
    expect(derivesSessionIdentity(h.body)).toBe(true); // → "stale entry" in the real ratchet
    expect(`${rel}::POST` in OPEN_NO_SESSION_IDENTITY).toBe(true);
  });
});
