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
 * THREE NAMED SETS were the work the first unit did NOT do, each a RATCHET (a stale entry FAILS,
 * so a set can only shrink):
 *   OPEN_ACTING_IDENTITY      files still reading identity from the request
 *   OPEN_NO_SESSION_IDENTITY  handlers that derive no session identity (resource-id only)
 *   OPEN_UNOWNED_RESOURCE     handlers that DO authenticate but never compare the session
 *                             member to the owner of the session/resource id they act on
 * PRACTITIONER-SESSION-OWNERSHIP-01 CLOSED ALL THREE (were 2 / 22 / 4; now 0 / 0 / 0). They remain as
 * empty ratchets, pinned EMPTY below, so an entry can only come back by a deliberate edit of this file.
 *
 * AND the session-OWNERSHIP law (PRACTITIONER-SESSION-OWNERSHIP-01): every handler that addresses a
 * practitioner session by id (a `sessionId` in the query/body, or a `session/[id]` path segment) must call
 * `requireOwnedSession(<session member>, id)` BEFORE it reads, writes, generates or streams anything, and
 * must RETURN its refusal; every `listSessions(` is scoped to the session member; every `createSession(`
 * records the session member as the owner. See "session-ownership law" below.
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
 * CLOSED by PRACTITIONER-SESSION-OWNERSHIP-01 (was 2 files: `supervision/session/start` read
 * `body.practitionerId`; `supervision/sessions` read `?practitionerId=`). Pinned EMPTY below.
 */
const OPEN_ACTING_IDENTITY: Record<string, string> = {};

/**
 * CLOSED by PRACTITIONER-SESSION-OWNERSHIP-01 (was 22 handlers addressed by a session id alone).
 * Pinned EMPTY below. Keys would be `file::METHOD`.
 */
const OPEN_NO_SESSION_IDENTITY: Record<string, string> = {};

/** Handlers that need no identity by design. Keys are `file::METHOD`. */
const PUBLIC_BY_DESIGN: Record<string, string> = {
  'app/api/practice/worlds/list/route.ts::GET': 'catalogue of practice worlds; no member data',
  'app/api/practitioners/check/route.ts::GET': 'slug availability; public in the access matrix, no member data (its POST is session-derived)',
};

/**
 * CLOSED by PRACTITIONER-SESSION-OWNERSHIP-01 (was 4 handlers that authenticated but acted on any
 * session id: practice `sessions` GET single lookup, supervision `transcript/list` GET and
 * `transcript/stream` POST + GET). Pinned EMPTY below. Keys would be `file::METHOD`.
 */
const OPEN_UNOWNED_RESOURCE: Record<string, { contains: RegExp; reason: string }> = {};

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

/** open-set entries whose handler now derives a session identity (the ratchet condition), over any set */
export function staleNoSessionEntries(open: Record<string, unknown>, hs: Array<{ key: string; body: string }>): string[] {
  return hs.filter((h) => h.key in open && derivesSessionIdentity(h.body)).map((h) => h.key);
}

/* ── the session-OWNERSHIP law (PRACTITIONER-SESSION-OWNERSHIP-01) ─────────────── */

/**
 * The names under which a handler holds the SESSION member: `actor.memberId` (requireSessionMember),
 * `practitionerId` (a `const practitionerId = actor.memberId` alias), `memberId` (getMemberIdFromRequest)
 * and `labMemberId` (the Lab Tools gate). Anything else as the owner argument is not the session member.
 */
const SESSION_MEMBER_ARG = /^(?:actor\.memberId|practitionerId|memberId|labMemberId)$/;

/** the first call of anything that reads, writes, generates or streams session data */
const SESSION_DATA_CALL =
  /\b(?:getSession|stopSession|updateSession|listSessions|getTranscript|getFullTranscript|getRecentTranscript|getTranscriptSegments|addTranscriptSegment|getSessionInsights|getInsightsGroupedByType|getInsights|getInsightsSince|addInsight|getSessionWorlds|recordSessionWorld|generateInsight|generateAllInsightsForWorld|suggestWorldForContext|flushPendingCandidate|runAssembly|enqueueJob|getEssenceSummary|runSessionSynthesis|analyzeSession|getJobsForSession|getRecentTranscriptTexts|getLastChunkTail|query)\s*\(/;

/** a handler names a practitioner session by id: a `sessionId`, or a `session/[id]` path segment */
export function addressesSessionId(rel: string, body: string): boolean {
  return /\bsessionId\b/.test(stripComments(body)) || /\/session\/\[id\]\//.test(rel);
}

/**
 * `const x = await requireOwnedSession(<arg>, …);  if ('error' in x) return x.error;` — the refusal is
 * RETURNED. A gate whose result is ignored is not a gate.
 */
const OWNER_GATE_SHAPE =
  /(?:const|let)\s+(\w+)\s*=\s*await\s+requireOwnedSession\(\s*([\w.]+)\s*,[^)]*\)\s*;\s*if\s*\(\s*'error'\s+in\s+\1\s*\)\s*return\s+\1\.error\s*;/g;

/** what is wrong with a session-addressed handler's owner gate; [] means it holds */
export function ownerGateProblems(body: string): string[] {
  const code = stripComments(body);
  const calls = [...code.matchAll(/\brequireOwnedSession\s*\(/g)];
  if (calls.length === 0) return ['no owner gate (requireOwnedSession)'];
  const out: string[] = [];
  const shaped = [...code.matchAll(OWNER_GATE_SHAPE)];
  if (shaped.length !== calls.length) out.push('an owner gate whose refusal is not returned');
  for (const m of shaped) {
    if (!SESSION_MEMBER_ARG.test(m[2]!)) out.push(`the owner argument "${m[2]}" is not the session member`);
  }
  const firstGate = calls[0]!.index!;
  const data = SESSION_DATA_CALL.exec(code);
  if (data && data.index < firstGate) out.push(`session data is touched (${data[0].trim()}) before the owner gate`);
  return out;
}

/** every `createSession({…})` must record the SESSION member as the owner (never absent, never a request value) */
export function createSessionProblems(body: string): string[] {
  const code = stripComments(body);
  const out: string[] = [];
  for (const m of code.matchAll(/createSession\(\s*\{([\s\S]*?)\}\s*\)/g)) {
    const k = /\bpractitionerId\b(?:\s*:\s*([^,\n]+))?/.exec(m[1]!);
    if (!k) { out.push('createSession without a practitionerId (an unowned row)'); continue; }
    const val = (k[1] ?? 'practitionerId').trim().replace(/\s*\|\|\s*undefined$/, '');
    if (val === 'actor.memberId' || val === 'memberId') continue;
    if (val === 'practitionerId' && /(?:const|let)\s+practitionerId\s*=\s*(?:actor\.memberId|memberId)\s*;/.test(code)) continue;
    out.push(`createSession owner is "${val}", not the session member`);
  }
  return out;
}

/** every `listSessions({…})` must be scoped to the SESSION member */
export function listSessionsProblems(body: string): string[] {
  const code = stripComments(body);
  const out: string[] = [];
  for (const m of code.matchAll(/listSessions\(\s*\{([\s\S]*?)\}\s*\)/g)) {
    const k = /\bpractitionerId\b(?:\s*:\s*([^,\n]+))?/.exec(m[1]!);
    if (!k) { out.push('listSessions is not scoped to a practitioner (it lists every practitioner\'s sessions)'); continue; }
    const val = (k[1] ?? 'practitionerId').trim();
    if (val === 'actor.memberId' || val === 'memberId') continue;
    if (val === 'practitionerId' && /(?:const|let)\s+practitionerId\s*=\s*(?:actor\.memberId|memberId)\s*;/.test(code)) continue;
    out.push(`listSessions is scoped to "${val}", not the session member`);
  }
  return out;
}

/** Handlers that mention a `sessionId` but do not address an EXISTING session. Keys are `file::METHOD`. */
const SESSION_ID_NOT_OWNER_GATED: Record<string, string> = {
  'app/api/supervision/upload/route.ts::POST':
    'CREATES the session it names (`enqueueJob({ sessionId: session.id })` follows `createSession({ practitionerId })`, ' +
    'whose owner is the session member); there is no pre-existing session id to gate',
};

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
    expect(staleNoSessionEntries(OPEN_NO_SESSION_IDENTITY, handlers)).toEqual([]);
  });

  it('the three open sets are CLOSED — empty. (PRACTITIONER-SESSION-OWNERSHIP-01 took them from 2 / 22 / 4 to 0.) An entry can come back only by editing this file on purpose.', () => {
    expect(Object.keys(OPEN_ACTING_IDENTITY)).toEqual([]);
    expect(Object.keys(OPEN_NO_SESSION_IDENTITY)).toEqual([]);
    expect(Object.keys(OPEN_UNOWNED_RESOURCE)).toEqual([]);
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

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · static guard — session-ownership law', () => {
  const sessionHandlers = handlers.filter((h) => addressesSessionId(h.rel, h.body));

  it('finds the session-addressed population (the law is not vacuously passing)', () => {
    // practice: insights/generate ×2, insights/list ×2, session/stop, session/worlds ×2, sessions ×2,
    // transcript ×2, worlds/detect, worlds/suggest = 13; supervision: session/[id] ×3, essence, stop,
    // insights/list, insights/stream, scribe, transcript/list ×2, transcript/stream ×2 = 12; + upload (exempt) = 26
    expect(sessionHandlers.length).toBeGreaterThanOrEqual(26);
    for (const k of [
      'app/api/practice/transcript/route.ts::GET',
      'app/api/supervision/session/[id]/route.ts::DELETE',
      'app/api/supervision/scribe/route.ts::GET',
      'app/api/supervision/transcript/list/route.ts::POST',
    ]) expect(sessionHandlers.map((h) => h.key)).toContain(k);
  });

  it('every session-addressed handler gates on ownership: present, refusal returned, owner = the session member, BEFORE any session data is touched', () => {
    const offenders = sessionHandlers
      .filter((h) => !(h.key in SESSION_ID_NOT_OWNER_GATED))
      .map((h) => ({ key: h.key, p: ownerGateProblems(h.body) }))
      .filter((x) => x.p.length > 0)
      .map((x) => `${x.key} — ${x.p.join('; ')}`);
    expect(offenders).toEqual([]);
  });

  it('the exemption list is a RATCHET: each exempt handler still mentions a sessionId, still does not gate, and is reasoned', () => {
    for (const [key, reason] of Object.entries(SESSION_ID_NOT_OWNER_GATED)) {
      const h = handlers.find((x) => x.key === key);
      expect(h).toBeDefined();
      expect(addressesSessionId(h!.rel, h!.body)).toBe(true);
      expect(ownerGateProblems(h!.body)).toEqual(['no owner gate (requireOwnedSession)']);
      expect(reason.length).toBeGreaterThan(20);
    }
  });

  it('every session this family creates is owned by the session member', () => {
    const creators = handlers.filter((h) => /\bcreateSession\s*\(/.test(stripComments(h.body)));
    expect(creators.map((h) => h.key).sort()).toEqual([
      'app/api/practice/session/start/route.ts::POST',
      'app/api/supervision/session/start/route.ts::POST',
      'app/api/supervision/upload/route.ts::POST',
    ]);
    expect(creators.flatMap((h) => createSessionProblems(h.body).map((p) => `${h.key} — ${p}`))).toEqual([]);
  });

  it('every session list is scoped to the session member', () => {
    const listers = handlers.filter((h) => /\blistSessions\s*\(/.test(stripComments(h.body)));
    expect(listers.map((h) => h.key).sort()).toEqual([
      'app/api/practice/sessions/route.ts::GET',
      'app/api/supervision/sessions/route.ts::GET',
    ]);
    expect(listers.flatMap((h) => listSessionsProblems(h.body).map((p) => `${h.key} — ${p}`))).toEqual([]);
  });

  it('DELETE of a supervision session carries the owner in its own statement', () => {
    const h = handlers.find((x) => x.key === 'app/api/supervision/session/[id]/route.ts::DELETE')!;
    expect(stripComments(h.body)).toMatch(/DELETE FROM supervision_sessions WHERE id = \$1 AND practitioner_id = \$2/);
  });

  it('nothing outside lib/auth/requireOwnedSession.ts queries the ownership columns of these tables to decide access', () => {
    // The one lookup is the single place the predicate lives; a second hand-rolled one is a second thing to get wrong.
    const offenders = files
      .filter((rel) => /(?:practice|supervision)_sessions[\s\S]{0,200}practitioner_id\s*=\s*\$\d/.test(stripComments(read(rel))))
      // the two owner-scoped writes the route issues itself, pinned by the supervision suite's SQL assertions
      .filter((rel) => rel !== 'app/api/supervision/session/[id]/route.ts');
    expect(offenders).toEqual([]);
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
    // somebody re-adds an entry for a handler that is already fixed: practice/session/stop::POST
    const key = 'app/api/practice/session/stop/route.ts::POST';
    const h = handlers.find((x) => x.key === key)!;
    expect(derivesSessionIdentity(h.body)).toBe(true);
    expect(staleNoSessionEntries({ [key]: 'a reason that is long enough' }, handlers)).toEqual([key]);
    // and a genuinely-open synthetic entry is not stale
    expect(staleNoSessionEntries({ 'app/api/practice/brand-new/route.ts::GET': 'a reason that is long enough' }, [
      { key: 'app/api/practice/brand-new/route.ts::GET', body: 'export async function GET(){ return 1 }' },
    ])).toEqual([]);
  });
});

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · static guard — ownership-law defeat candidates (each must be caught)', () => {
  const STOP = 'app/api/practice/session/stop/route.ts';
  const TRANSCRIPT = 'app/api/practice/transcript/route.ts';
  const SUP_DEL = 'app/api/supervision/session/[id]/route.ts';
  const SUP_START = 'app/api/supervision/session/start/route.ts';
  const SUP_LIST = 'app/api/supervision/sessions/route.ts';
  const SCRIBE = 'app/api/supervision/scribe/route.ts';

  const mut = (rel: string, from: string | RegExp, to: string): string => {
    const src = read(rel);
    const out = src.replace(from, to);
    if (out === src) throw new Error(`mutation did not apply to ${rel}: ${String(from)}`);
    return out;
  };
  const handlerOf = (src: string, method: string) => handlersOf(src).find((h) => h.method === method)!.body;

  it('control: the real, fixed handlers hold the law', () => {
    expect(ownerGateProblems(handlerOf(read(STOP), 'POST'))).toEqual([]);
    expect(ownerGateProblems(handlerOf(read(TRANSCRIPT), 'GET'))).toEqual([]);
    expect(ownerGateProblems(handlerOf(read(SUP_DEL), 'DELETE'))).toEqual([]);
    expect(ownerGateProblems(handlerOf(read(SCRIBE), 'GET'))).toEqual([]);
    expect(createSessionProblems(handlerOf(read(SUP_START), 'POST'))).toEqual([]);
    expect(listSessionsProblems(handlerOf(read(SUP_LIST), 'GET'))).toEqual([]);
  });

  it('DC-O1 the owner gate removed from a handler (session identity only — the shipped state)', () => {
    const src = mut(STOP, /const owned = await requireOwnedSession\([^)]*\);\s*if \('error' in owned\) return owned\.error;/, '');
    expect(ownerGateProblems(handlerOf(src, 'POST'))).toContain('no owner gate (requireOwnedSession)');
  });

  it('DC-O2 the gate placed AFTER session data is read (transcript GET reads, then checks)', () => {
    const gate = /const owned = await requireOwnedSession\(actor\.memberId, sessionId\);\s*if \('error' in owned\) return owned\.error;/;
    const src = read(TRANSCRIPT);
    const get = handlerOf(src, 'GET');
    const moved = get.replace(gate, '').replace('const segments = await getFullTranscript(sessionId);', 'const segments = await getFullTranscript(sessionId);\n      const owned = await requireOwnedSession(actor.memberId, sessionId);\n      if (\'error\' in owned) return owned.error;');
    expect(moved).not.toBe(get);
    expect(ownerGateProblems(moved).join()).toMatch(/touched \(getFullTranscript\(\) before the owner gate|touched .* before the owner gate/);
  });

  it('DC-O3 the gate is called but its refusal is IGNORED (the check cannot refuse anything)', () => {
    const src = mut(STOP, /if \('error' in owned\) return owned\.error;/, '');
    expect(ownerGateProblems(handlerOf(src, 'POST'))).toContain('an owner gate whose refusal is not returned');
  });

  it('DC-O4 the owner argument comes from the request: requireOwnedSession(body.practitionerId, …)', () => {
    const src = mut(STOP, 'requireOwnedSession(actor.memberId, sessionId)', 'requireOwnedSession(body.practitionerId, sessionId)');
    expect(ownerGateProblems(handlerOf(src, 'POST')).join()).toMatch(/not the session member/);
    // and the identity scanner independently flags the body read
    expect(findIdentityFromRequest(src).join()).toMatch(/practitionerId via property read/);
  });

  it('DC-O5 a session-addressed handler with only a session identity is not exempt, so the law would fail it', () => {
    const src = 'export async function GET(req) {\n  const actor = await requireSessionMember(req);\n  const sessionId = new URL(req.url).searchParams.get("sessionId");\n  return Response.json(await getTranscript(sessionId));\n}\n';
    const h = handlersOf(src)[0]!;
    expect(addressesSessionId('app/api/practice/brand-new/route.ts', h.body)).toBe(true);
    expect('app/api/practice/brand-new/route.ts::GET' in SESSION_ID_NOT_OWNER_GATED).toBe(false);
    expect(ownerGateProblems(h.body)).toEqual(['no owner gate (requireOwnedSession)']);
  });

  it('DC-O6 a `session/[id]` handler is session-addressed even with no sessionId in its body', () => {
    expect(addressesSessionId('app/api/supervision/session/[id]/thing/route.ts', 'export async function GET(){ return 1 }')).toBe(true);
  });

  it('DC-O7 createSession without an owner (the shipped scribe/studio shape) is caught', () => {
    const src = mut(SUP_START, /practitionerId: actor\.memberId,\s*/, '');
    expect(createSessionProblems(handlerOf(src, 'POST'))).toContain('createSession without a practitionerId (an unowned row)');
  });

  it('DC-O8 createSession owned by a request value (body.practitionerId) is caught', () => {
    const src = mut(SUP_START, 'practitionerId: actor.memberId', 'practitionerId: body.practitionerId');
    expect(createSessionProblems(handlerOf(src, 'POST')).join()).toMatch(/not the session member/);
    expect(findIdentityFromRequest(src).join()).toMatch(/practitionerId via property read/);
  });

  it('DC-O9 a list that is not scoped (listSessions({ caseId, limit }) — lists every practitioner\'s sessions) is caught', () => {
    const src = mut(SUP_LIST, /practitionerId,\s*\n\s*caseId,/, 'caseId,');
    expect(listSessionsProblems(handlerOf(src, 'GET')).join()).toMatch(/not scoped to a practitioner/);
  });

  it('DC-O10 a list scoped by `?practitionerId=` (the shipped shape) is caught, by the list rule and by the identity scanner', () => {
    const src = mut(SUP_LIST, 'const practitionerId = actor.memberId;', "const practitionerId = searchParams.get('practitionerId') || undefined;");
    expect(listSessionsProblems(handlerOf(src, 'GET')).join()).toMatch(/not the session member/);
    expect(findIdentityFromRequest(src).join()).toMatch(/practitionerId via \.get\(\)/);
  });

  it('DC-O11 DELETE reverted to an unscoped statement (`WHERE id = $1`) is caught', () => {
    const src = mut(SUP_DEL, 'DELETE FROM supervision_sessions WHERE id = $1 AND practitioner_id = $2 RETURNING id', 'DELETE FROM supervision_sessions WHERE id = $1');
    expect(/DELETE FROM supervision_sessions WHERE id = \$1 AND practitioner_id = \$2/.test(stripComments(handlerOf(src, 'DELETE')))).toBe(false);
  });

  it('DC-O12 a hand-rolled ownership query in a route (a second place the predicate lives) is caught', () => {
    const rogue = "const r = await query('SELECT id FROM practice_sessions WHERE id = $1 AND practitioner_id = $2', [id, me]);";
    expect(/(?:practice|supervision)_sessions[\s\S]{0,200}practitioner_id\s*=\s*\$\d/.test(rogue)).toBe(true);
  });
});
