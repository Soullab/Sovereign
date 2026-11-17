/**
 * PRACTITIONER-SESSION-OWNERSHIP-01 — shared session-ownership boundary check.
 *
 * `sessionBoundaryHarness.ts` checks WHO IS ACTING (two accounts, the caller names the other
 * one). This file checks WHICH SESSION may be reached: every route that addresses a
 * practice_sessions / supervision_sessions row by its id.
 *
 * Policy under test (founder-delegated choice 2026-11-17, FAIL CLOSED, RECOVERABLE):
 *   P1  a session is reachable only by the practitioner who owns it; a non-owner and an absent
 *       id are INDISTINGUISHABLE (same status, same body) — no existence oracle
 *   P3  a legacy session whose owner is NULL is reachable by nobody
 *
 * The boundary is a FUNCTION so the same check runs against (a) every real route and (b)
 * deliberately wrong handlers. A check that has only ever seen conforming code is not evidence.
 *
 * EVIDENCE CLASS: the world behind these checks is a FAKE database. `FakeDb.query` evaluates the
 * WHERE clause of each statement it is handed (conjunction/disjunction of `col = $n`,
 * `col IS [NOT] NULL`) and REFUSES any statement shape it does not model, so a rewritten
 * predicate fails loudly instead of being quietly mis-modelled. It is a model of a few statements,
 * not PostgreSQL.
 */
import { authSessionRows, MEMBER_A, MEMBER_B, TOKEN_A } from './sessionBoundaryHarness';

export { MEMBER_A, MEMBER_B, TOKEN_A, authSessionRows };

/** text that must never reach a caller who does not own the session */
export const SECRET = 'SECRET-OF-ANOTHER-PRACTITIONER';
export const LEGACY_SECRET = 'SECRET-OF-AN-UNOWNED-LEGACY-SESSION';

export type Kind = 'practice' | 'supervision';

export const SID = {
  PRACTICE_A: 'a0000000-0000-4000-8000-00000000000a',
  PRACTICE_B: 'b0000000-0000-4000-8000-00000000000b',
  PRACTICE_NULL: 'c0000000-0000-4000-8000-00000000000c',
  SUP_A: 'a1111111-1111-4111-8111-11111111111a',
  SUP_B: 'b1111111-1111-4111-8111-11111111111b',
  SUP_NULL: 'c1111111-1111-4111-8111-11111111111c',
  ABSENT: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
} as const;

export type SessionRow = {
  id: string;
  kind: Kind;
  practitioner_id: string | null;
  title: string;
  ended_at: string | null;
  processing_status: string;
};

/** the ids a probe uses for one session kind */
export type Ids = { mine: string; theirs: string; unowned: string; absent: string };
export const IDS: Record<Kind, Ids> = {
  practice: { mine: SID.PRACTICE_A, theirs: SID.PRACTICE_B, unowned: SID.PRACTICE_NULL, absent: SID.ABSENT },
  supervision: { mine: SID.SUP_A, theirs: SID.SUP_B, unowned: SID.SUP_NULL, absent: SID.ABSENT },
};

export function seedSessions(): SessionRow[] {
  const mk = (id: string, kind: Kind, owner: string | null, title: string): SessionRow => ({
    id, kind, practitioner_id: owner, title, ended_at: null, processing_status: 'recording',
  });
  return [
    mk(SID.PRACTICE_A, 'practice', MEMBER_A, 'practice-session-of-A'),
    mk(SID.PRACTICE_B, 'practice', MEMBER_B, `practice-session-of-${SECRET}`),
    mk(SID.PRACTICE_NULL, 'practice', null, `practice-session-of-${LEGACY_SECRET}`),
    mk(SID.SUP_A, 'supervision', MEMBER_A, 'supervision-session-of-A'),
    mk(SID.SUP_B, 'supervision', MEMBER_B, `supervision-session-of-${SECRET}`),
    mk(SID.SUP_NULL, 'supervision', null, `supervision-session-of-${LEGACY_SECRET}`),
  ];
}

/* ── a tiny SQL model: only what the ownership statements use ──────────────── */

type Row = Record<string, unknown>;

/** evaluates `col = $n`, `col IS [NOT] NULL`, joined by AND / OR with parentheses; refuses the rest */
export function evalWhere(expr: string, row: Row, params: unknown[]): boolean {
  const tokens = [
    ...expr.replace(/\s+/g, ' ').trim().matchAll(/\s*(\(|\)|\bAND\b|\bOR\b|[^()\s][^()]*?(?=\s+(?:AND|OR)\b|\s*\)|\s*$))/gi),
  ].map((m) => m[1]!);
  let i = 0;
  const term = (t: string): boolean => {
    const t1 = /^(\w+) = \$(\d+)$/.exec(t.trim());
    if (t1) {
      const v = params[Number(t1[2]) - 1];
      // SQL comparison with NULL is never true: an unbound ($n -> undefined/null) parameter matches no row
      return v !== undefined && v !== null && row[t1[1]!] === v;
    }
    const t2 = /^(\w+) IS NULL$/i.exec(t.trim());
    if (t2) return row[t2[1]!] === null || row[t2[1]!] === undefined;
    const t3 = /^(\w+) IS NOT NULL$/i.exec(t.trim());
    if (t3) return !(row[t3[1]!] === null || row[t3[1]!] === undefined);
    throw new Error(`UNMODELLED_PREDICATE: ${t}`);
  };
  const primary = (): boolean => {
    const t = tokens[i++];
    if (t === undefined) throw new Error(`UNMODELLED_PREDICATE: ${expr}`);
    if (t === '(') {
      const v = or();
      if (tokens[i++] !== ')') throw new Error(`UNMODELLED_PREDICATE: ${expr}`);
      return v;
    }
    return term(t);
  };
  const and = (): boolean => {
    let v = primary();
    while (tokens[i] && /^AND$/i.test(tokens[i]!)) { i++; const r = primary(); v = v && r; }
    return v;
  };
  const or = (): boolean => {
    let v = and();
    while (tokens[i] && /^OR$/i.test(tokens[i]!)) { i++; const r = and(); v = v || r; }
    return v;
  };
  const out = or();
  if (i !== tokens.length) throw new Error(`UNMODELLED_PREDICATE: ${expr}`);
  return out;
}

const flat = (sql: string): string => sql.replace(/\s+/g, ' ').trim();
const TABLE: Record<string, Kind> = { practice_sessions: 'practice', supervision_sessions: 'supervision' };

export class FakeDb {
  sessions: SessionRow[] = seedSessions();
  /** every statement other than the session-credential lookup */
  issued: Array<{ sql: string; params: unknown[] }> = [];

  reset(): void {
    this.sessions = seedSessions();
    this.issued = [];
  }

  serialize(): string {
    return JSON.stringify(this.sessions);
  }

  /** the statement is one the world models; anything else throws (and is recorded) */
  query = async (sql: string, params: unknown[] = []): Promise<{ rows: Row[]; rowCount: number }> => {
    const auth = authSessionRows(sql, params);
    if (auth) return { rows: auth.rows as Row[], rowCount: auth.rows.length };
    this.issued.push({ sql: flat(sql), params });
    const q = flat(sql);

    // SELECT id, '<source>' AS source FROM <table> WHERE <expr> [UNION ALL …] [LIMIT n]
    if (/^SELECT id, '\w+' AS source FROM /i.test(q)) {
      const limit = /\bLIMIT (\d+)$/i.exec(q);
      const body = limit ? q.slice(0, limit.index).trim() : q;
      const out: Row[] = [];
      for (const part of body.split(/\s+UNION ALL\s+/i)) {
        const m = /^SELECT id, '(\w+)' AS source FROM (\w+) WHERE (.+)$/i.exec(part);
        if (!m) throw new Error(`UNMODELLED_STATEMENT: ${q}`);
        const kind = TABLE[m[2]!];
        if (!kind) throw new Error(`UNMODELLED_STATEMENT: ${q}`);
        for (const r of this.sessions.filter((s) => s.kind === kind && evalWhere(m[3]!, s as unknown as Row, params))) {
          out.push({ id: r.id, source: m[1] });
        }
      }
      const rows = limit ? out.slice(0, Number(limit[1])) : out;
      return { rows, rowCount: rows.length };
    }

    // DELETE FROM supervision_sessions WHERE <expr> RETURNING id
    const del = /^DELETE FROM supervision_sessions WHERE (.+?)(?: RETURNING id)?$/i.exec(q);
    if (del) {
      const hit = this.sessions.filter((s) => s.kind === 'supervision' && evalWhere(del[1]!, s as unknown as Row, params));
      this.sessions = this.sessions.filter((s) => !hit.includes(s));
      return { rows: hit.map((s) => ({ id: s.id })), rowCount: hit.length };
    }

    // UPDATE supervision_sessions SET title = $1 WHERE <expr> [RETURNING id]
    const upd = /^UPDATE supervision_sessions SET title = \$1 WHERE (.+?)(?: RETURNING id)?$/i.exec(q);
    if (upd) {
      const hit = this.sessions.filter((s) => s.kind === 'supervision' && evalWhere(upd[1]!, s as unknown as Row, params));
      for (const s of hit) s.title = String(params[0]);
      return { rows: hit.map((s) => ({ id: s.id })), rowCount: hit.length };
    }

    throw new Error(`UNMODELLED_STATEMENT: ${q}`);
  };
}

/* ── the boundary check ────────────────────────────────────────────────────── */

export interface OwnershipWorld {
  db: FakeDb;
  /** put the world back to its initial state */
  seed(): void;
  /** every byte a refused request must leave alone (sessions, segments, insights, worlds …), serialised */
  snapshot(): string;
  /** store / service / model calls since seed() — a refused request must make ZERO */
  storeCalls(): number;
  /** every session id any store/service was invoked with */
  touched(): Set<string>;
}

export interface OwnershipOp {
  name: string;
  /** the session kinds this handler can reach (practice handlers reach both; supervision handlers reach supervision) */
  kinds: Kind[];
  /** status of a legitimate call by the owner */
  okStatus: number;
  /**
   * 'touched' (default): the owner's call must visibly reach a store with the owner's session id.
   * 'status': the owner's call is a long-lived stream whose first store read happens after the check
   * has already answered, so the 200 itself is the proof the owner is not over-restricted.
   */
  okProof?: 'touched' | 'status';
  /** set (with the reason) when the route's own gate ignores an x-member-id claim instead of rejecting it */
  skipO5?: string;
  /** set (with the reason) when an EMPTY id is not 'missing' but selects another branch of the route (a list) */
  emptyIdSelectsAnotherBranch?: string;
  invoke(a: {
    sessionId: string;
    token?: string;
    headers?: Record<string, string>;
    /** identity values a caller might plant in the body/query (they must be ignored) */
    claim?: { memberId?: string; practitionerId?: string };
  }): Promise<Response>;
}

const text = async (r: Response): Promise<string> => {
  try { return await r.text(); } catch { return ''; }
};

export async function exerciseOwnership(label: string, op: OwnershipOp, w: OwnershipWorld): Promise<string[]> {
  const v: string[] = [];
  const stray = { memberId: MEMBER_B, practitionerId: MEMBER_B };

  // O0 — nobody is signed in
  for (const kind of op.kinds) {
    w.seed();
    const before = w.snapshot();
    const res = await op.invoke({ sessionId: IDS[kind].theirs, claim: stray });
    if (res.status !== 401) v.push(`${label} O0[${kind}]: unauthenticated request answered ${res.status}, not 401`);
    if (w.storeCalls() !== 0) v.push(`${label} O0[${kind}]: unauthenticated request reached a store (${w.storeCalls()} calls)`);
    if (w.snapshot() !== before) v.push(`${label} O0[${kind}]: unauthenticated request changed data`);
  }

  // O2 — an ABSENT id: this is the reference answer every refusal must equal
  w.seed();
  const absent = await op.invoke({ sessionId: SID.ABSENT, token: TOKEN_A });
  const absentBody = await text(absent);
  if (absent.status !== 404) v.push(`${label} O2: an absent id answered ${absent.status}, not 404`);
  if (w.storeCalls() !== 0) v.push(`${label} O2: an absent id reached a store (${w.storeCalls()} calls)`);

  for (const kind of op.kinds) {
    const ids = IDS[kind];

    // O1 — A is signed in and names B's session
    {
      w.seed();
      const before = w.snapshot();
      const res = await op.invoke({ sessionId: ids.theirs, token: TOKEN_A, claim: stray });
      const body = await text(res);
      if (body.includes(SECRET)) v.push(`${label} O1[${kind}]: another practitioner's data was returned`);
      if (res.status !== 404) v.push(`${label} O1[${kind}]: a session that is not A's answered ${res.status}, not 404`);
      if (res.status !== absent.status || body !== absentBody) {
        v.push(`${label} O1[${kind}]: a session that is not A's is distinguishable from an absent id (${res.status} vs ${absent.status})`);
      }
      if (w.storeCalls() !== 0) v.push(`${label} O1[${kind}]: a refused request reached a store (${w.storeCalls()} calls)`);
      if (w.touched().has(ids.theirs)) v.push(`${label} O1[${kind}]: B's session id reached a store`);
      if (w.snapshot() !== before) v.push(`${label} O1[${kind}]: a refused request changed data`);
    }

    // O3 — a legacy session with NO owner is reachable by nobody (fail closed)
    {
      w.seed();
      const before = w.snapshot();
      const res = await op.invoke({ sessionId: ids.unowned, token: TOKEN_A });
      const body = await text(res);
      if (body.includes(LEGACY_SECRET)) v.push(`${label} O3[${kind}]: an unowned legacy session's data was returned`);
      if (res.status !== absent.status || body !== absentBody) {
        v.push(`${label} O3[${kind}]: an unowned legacy session is distinguishable from an absent id (${res.status} vs ${absent.status})`);
      }
      if (w.storeCalls() !== 0) v.push(`${label} O3[${kind}]: an unowned legacy session reached a store (${w.storeCalls()} calls)`);
      if (w.snapshot() !== before) v.push(`${label} O3[${kind}]: an unowned legacy session was changed`);
    }

    // O4 — A's own session still works, a stray identity claim is ignored (the fix must not over-restrict)
    {
      w.seed();
      const res = await op.invoke({ sessionId: ids.mine, token: TOKEN_A, claim: stray });
      if (res.status !== op.okStatus) v.push(`${label} O4[${kind}]: the owner's own session answered ${res.status}, not ${op.okStatus}`);
      if ((op.okProof ?? 'touched') === 'touched' && !w.touched().has(ids.mine)) {
        v.push(`${label} O4[${kind}]: the owner's session never reached the store`);
      }
      for (const other of [ids.theirs, ids.unowned]) {
        if (w.touched().has(other)) v.push(`${label} O4[${kind}]: acting on A's session also reached ${other}`);
      }
    }

    // O4b — a legacy client that still sends its own id as a claim
    {
      w.seed();
      const res = await op.invoke({ sessionId: ids.mine, token: TOKEN_A, claim: { memberId: MEMBER_A, practitionerId: MEMBER_A } });
      if (res.status !== op.okStatus) v.push(`${label} O4b[${kind}]: a legacy client sending its own id answered ${res.status}`);
    }

    // O5 — A's token with B in x-member-id: the mismatched claim fails closed
    if (!op.skipO5) {
      w.seed();
      const res = await op.invoke({ sessionId: ids.mine, token: TOKEN_A, headers: { 'x-member-id': MEMBER_B } });
      if (res.status !== 401) v.push(`${label} O5[${kind}]: a mismatched x-member-id answered ${res.status}, not 401`);
      if (w.storeCalls() !== 0) v.push(`${label} O5[${kind}]: a mismatched x-member-id reached a store`);
    }
  }

  // O6 — an id that is not a UUID at all reads as an absent id too (and never reaches SQL as a type error)
  for (const junk of ['not-a-uuid', "' OR 1=1 --", ...(op.emptyIdSelectsAnotherBranch ? [] : [''])]) {
    w.seed();
    const res = await op.invoke({ sessionId: junk, token: TOKEN_A });
    const body = await text(res);
    // an EMPTY id is "missing" (400) on routes that validate presence first; everything else reads as absent
    if (junk !== '' && (res.status !== absent.status || body !== absentBody)) {
      v.push(`${label} O6: junk id ${JSON.stringify(junk)} answered ${res.status}, not the absent-id answer`);
    }
    if (w.storeCalls() !== 0) v.push(`${label} O6: junk id ${JSON.stringify(junk)} reached a store`);
  }

  return v;
}

/** a LIST route: only the session practitioner's own sessions, whatever the caller names, never an unowned one */
export interface ListOp {
  name: string;
  invoke(a: { token?: string; headers?: Record<string, string>; claim?: { memberId?: string; practitionerId?: string } }): Promise<Response>;
  /** the ids a successful body lists */
  idsIn(body: unknown): string[];
}

export async function exerciseList(label: string, op: ListOp, w: OwnershipWorld, kind: Kind): Promise<string[]> {
  const v: string[] = [];
  const mine = IDS[kind].mine;

  w.seed();
  const anon = await op.invoke({ claim: { memberId: MEMBER_B, practitionerId: MEMBER_B } });
  if (anon.status !== 401) v.push(`${label} L0: unauthenticated list answered ${anon.status}, not 401`);
  if (w.storeCalls() !== 0) v.push(`${label} L0: unauthenticated list reached a store`);

  for (const [tag, claim] of [
    ['no claim', undefined],
    ['claim names B', { memberId: MEMBER_B, practitionerId: MEMBER_B }],
    ['claim names A', { memberId: MEMBER_A, practitionerId: MEMBER_A }],
  ] as const) {
    w.seed();
    const res = await op.invoke({ token: TOKEN_A, claim });
    const raw = await text(res);
    if (res.status !== 200) { v.push(`${label} L1(${tag}): the owner's list answered ${res.status}`); continue; }
    if (raw.includes(SECRET)) v.push(`${label} L1(${tag}): another practitioner's session was listed`);
    if (raw.includes(LEGACY_SECRET)) v.push(`${label} L1(${tag}): an unowned legacy session was listed`);
    const listed = op.idsIn(JSON.parse(raw));
    if (!listed.includes(mine)) v.push(`${label} L1(${tag}): the owner's own session is missing from the list`);
    for (const id of listed) if (id !== mine) v.push(`${label} L1(${tag}): listed a session that is not the owner's (${id})`);
  }

  w.seed();
  const mismatched = await op.invoke({ token: TOKEN_A, headers: { 'x-member-id': MEMBER_B } });
  if (mismatched.status !== 401) v.push(`${label} L2: a mismatched x-member-id answered ${mismatched.status}, not 401`);
  return v;
}

/** a CREATE route: the new row's owner is the SESSION member, never a request value, never NULL */
export interface CreateOp {
  name: string;
  invoke(a: { token?: string; headers?: Record<string, string>; claim?: { memberId?: string; practitionerId?: string } }): Promise<Response>;
  /** the owner recorded on the row a successful call created (undefined when nothing was created) */
  createdOwner(): string | null | undefined;
  createdCount(): number;
}

export async function exerciseCreate(label: string, op: CreateOp, w: OwnershipWorld): Promise<string[]> {
  const v: string[] = [];

  w.seed();
  const anon = await op.invoke({ claim: { memberId: MEMBER_B, practitionerId: MEMBER_B } });
  if (anon.status !== 401) v.push(`${label} C0: unauthenticated create answered ${anon.status}, not 401 (an unowned row would be made)`);
  if (op.createdCount() !== 0) v.push(`${label} C0: unauthenticated create still made a row`);

  for (const [tag, claim] of [
    ['no claim', undefined],
    ['claim names B', { memberId: MEMBER_B, practitionerId: MEMBER_B }],
  ] as const) {
    w.seed();
    const res = await op.invoke({ token: TOKEN_A, claim });
    if (res.status !== 200) { v.push(`${label} C1(${tag}): the owner's create answered ${res.status}`); continue; }
    const owner = op.createdOwner();
    if (owner === null || owner === undefined) v.push(`${label} C1(${tag}): the new session has NO owner`);
    else if (owner !== MEMBER_A) v.push(`${label} C1(${tag}): the new session was owned by ${owner}, not the session member`);
  }

  w.seed();
  const mismatched = await op.invoke({ token: TOKEN_A, headers: { 'x-member-id': MEMBER_B } });
  if (mismatched.status !== 401) v.push(`${label} C2: a mismatched x-member-id answered ${mismatched.status}, not 401`);
  if (op.createdCount() !== 0) v.push(`${label} C2: a mismatched x-member-id still made a row`);
  return v;
}
