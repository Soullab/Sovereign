/**
 * PRACTITIONER-SESSION-OWNERSHIP-01 — the ONE ownership lookup for practitioner sessions.
 *
 * Every route that addresses a practice_sessions / supervision_sessions row by id goes through
 * `requireOwnedSession(memberId, sessionId)`; it is a single SQL statement whose predicate carries
 * the owner (`id = $1 AND practitioner_id = $2`, in both tables), so:
 *   · a session that is not the member's           → no row → 404
 *   · a legacy session whose owner is NULL         → `NULL = $2` is never true → 404 (fail closed)
 *   · an absent id                                 → no row → the SAME 404, same body
 *   · an id that is not a UUID                     → 404 without reaching SQL (a type error would be a 500)
 *
 * Why this suite exists beside the route suites: those run the REAL helper over `FakeDb`, and a wrong
 * helper (owner dropped from the SQL, unowned allowed, one table only) would be invisible if the routes
 * were the only evidence. Here the helper is run against `FakeDb` directly and against wrong helpers
 * that must each be caught.
 *
 * ⛔ EVIDENCE CLASS: `FakeDb.query` evaluates the WHERE clause it is handed and refuses shapes it does
 * not model. It is a model of the statement, not PostgreSQL. The statement is run on a throwaway
 * PostgreSQL 16 separately and reported in the commit message (not committed).
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import path from 'path';
import {
  FakeDb,
  IDS,
  MEMBER_A,
  MEMBER_B,
  SID,
} from '@/tests/support/sessionOwnershipHarness';

const db = new FakeDb();
jest.mock('@/lib/db/postgres', () => ({
  __esModule: true,
  default: { query: (sql: string, params?: unknown[]) => db.query(sql, params ?? []) },
  query: (sql: string, params?: unknown[]) => db.query(sql, params ?? []),
}));

import { findOwnedSession, requireOwnedSession } from '@/lib/auth/requireOwnedSession';

beforeEach(() => db.reset());

type Impl = (sessionId: unknown, memberId: unknown) => Promise<unknown>;

/** Returns the violated properties; [] means the helper holds. */
async function checkHelper(impl: Impl): Promise<string[]> {
  const v: string[] = [];
  const attempt = async (label: string, f: () => Promise<unknown>): Promise<unknown> => {
    try { return await f(); } catch (e) { v.push(`${label}: THREW ${(e as Error).message.split(':')[0]}`); return undefined; }
  };
  const norm = (x: unknown) => JSON.stringify(x ?? null);

  // H1/H2 — the owner reaches their own session in EITHER table
  db.reset();
  for (const kind of ['practice', 'supervision'] as const) {
    const got = (await attempt(`H1[${kind}]`, () => impl(IDS[kind].mine, MEMBER_A))) as { id?: string } | null | undefined;
    if (!got || got.id !== IDS[kind].mine) v.push(`H1[${kind}]: the owner could not reach their own ${kind} session`);
  }

  // H3 — another practitioner's session reads as nothing, in either table
  const absent = norm(await attempt('H5', () => impl(SID.ABSENT, MEMBER_A)));
  for (const kind of ['practice', 'supervision'] as const) {
    db.reset();
    const got = await attempt(`H3[${kind}]`, () => impl(IDS[kind].theirs, MEMBER_A));
    if (norm(got) !== 'null') v.push(`H3[${kind}]: a session that is not the member's was found`);
    // H3b — no oracle: it must read EXACTLY like an absent id
    if (norm(got) !== absent) v.push(`H3b[${kind}]: a session that is not the member's is distinguishable from an absent id`);
  }

  // H4 — a legacy session with NO owner is reachable by nobody
  for (const kind of ['practice', 'supervision'] as const) {
    db.reset();
    const got = await attempt(`H4[${kind}]`, () => impl(IDS[kind].unowned, MEMBER_A));
    if (norm(got) !== 'null') v.push(`H4[${kind}]: an unowned legacy ${kind} session was found`);
    const nobody = await attempt(`H4b[${kind}]`, () => impl(IDS[kind].unowned, null));
    if (norm(nobody) !== 'null') v.push(`H4b[${kind}]: an unowned legacy ${kind} session was found for a missing member`);
  }

  // H6 — a missing member matches nothing (even an owned row)
  db.reset();
  for (const missing of [undefined, null, '']) {
    const got = await attempt('H6', () => impl(IDS.practice.mine, missing));
    if (norm(got) !== 'null') v.push(`H6: a missing member (${JSON.stringify(missing)}) found a session`);
  }

  // H7 — an id that is not a UUID never reaches SQL (it would be a type error, i.e. a 500 that tells a different story)
  for (const junk of ['not-a-uuid', "' OR 1=1 --", '', 42, undefined, null]) {
    db.reset();
    const got = await attempt('H7', () => impl(junk, MEMBER_A));
    if (norm(got) !== 'null') v.push(`H7: junk id ${JSON.stringify(junk)} found a session`);
    if (db.issued.length !== 0) v.push(`H7: junk id ${JSON.stringify(junk)} reached SQL`);
  }

  // H8 — one guarded lookup, parameters [id, member]
  db.reset();
  await attempt('H8', () => impl(IDS.practice.mine, MEMBER_A));
  if (db.issued.length !== 1) v.push(`H8: ${db.issued.length} statements issued, not exactly one`);
  const only = db.issued[0];
  if (only && !(only.params[0] === IDS.practice.mine && only.params[1] === MEMBER_A)) v.push('H8: the statement is not bound [id, member]');
  if (only && (only.sql.match(/practitioner_id = \$2/g) ?? []).length !== 2) v.push('H8: the owner is not in the predicate of BOTH tables');

  return v;
}

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · requireOwnedSession — the owner is in the SQL', () => {
  it('holds every property against the real function (H1-H8)', async () => {
    expect(await checkHelper((sid, mid) => findOwnedSession(sid, mid))).toEqual([]);
  });

  it('issues exactly one statement: both tables, `id = $1 AND practitioner_id = $2`, UNION ALL, LIMIT 1', async () => {
    await findOwnedSession(IDS.supervision.mine, MEMBER_A);
    expect(db.issued).toHaveLength(1);
    const { sql, params } = db.issued[0]!;
    expect(sql).toBe(
      "SELECT id, 'practice' AS source FROM practice_sessions WHERE id = $1 AND practitioner_id = $2 " +
      "UNION ALL SELECT id, 'supervision' AS source FROM supervision_sessions WHERE id = $1 AND practitioner_id = $2 LIMIT 1",
    );
    expect(params).toEqual([IDS.supervision.mine, MEMBER_A]);
  });

  it('returns the table the row was found in, so a caller never has to read it again to learn the kind', async () => {
    expect(await findOwnedSession(IDS.practice.mine, MEMBER_A)).toEqual({ id: IDS.practice.mine, source: 'practice' });
    expect(await findOwnedSession(IDS.supervision.mine, MEMBER_A)).toEqual({ id: IDS.supervision.mine, source: 'supervision' });
  });

  it('a database error is NOT an allow: it propagates (the route answers 500, never grants)', async () => {
    const spy = jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('connection lost') as never);
    await expect(findOwnedSession(IDS.practice.mine, MEMBER_A)).rejects.toThrow('connection lost');
    spy.mockRestore();
  });

  it('the source file carries no way to widen the predicate: no OR, no IS NULL, no `practitioner_id IS`', () => {
    const src = readFileSync(path.resolve(__dirname, '../requireOwnedSession.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    const sqlBlock = /`SELECT[\s\S]*?`|'SELECT[\s\S]*?'|"SELECT[\s\S]*?"/.exec(src)?.[0] ?? '';
    expect(sqlBlock).not.toBe('');
    expect(sqlBlock).not.toMatch(/\bOR\b/i);
    expect(sqlBlock).not.toMatch(/IS\s+(NOT\s+)?NULL/i);
    expect(sqlBlock).not.toMatch(/COALESCE/i);
  });
});

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · requireOwnedSession — one refusal, no oracle', () => {
  const refusal = async (sessionId: unknown, memberId = MEMBER_A) => {
    const r = await requireOwnedSession(memberId, sessionId);
    if (!('error' in r)) return null;
    return { status: r.error.status, body: await r.error.text(), cache: r.error.headers.get('cache-control') };
  };

  it('a session that is not the member\'s, an unowned legacy session, an absent id and a malformed id answer IDENTICALLY (404)', async () => {
    const answers = [
      await refusal(IDS.practice.theirs), await refusal(IDS.supervision.theirs),
      await refusal(IDS.practice.unowned), await refusal(IDS.supervision.unowned),
      await refusal(SID.ABSENT), await refusal('not-a-uuid'), await refusal(undefined),
    ];
    for (const a of answers) expect(a).toEqual(answers[0]);
    expect(answers[0]).toEqual({ status: 404, body: JSON.stringify({ success: false, error: 'Session not found' }), cache: 'private, no-store' });
  });

  it('the owner gets the session, not a refusal', async () => {
    const r = await requireOwnedSession(MEMBER_A, IDS.supervision.mine);
    expect('session' in r && r.session).toEqual({ id: IDS.supervision.mine, source: 'supervision' });
  });

  it('naming the other practitioner as the member is the other practitioner\'s act, never A\'s: B reaches B\'s, not A\'s', async () => {
    expect('session' in (await requireOwnedSession(MEMBER_B, IDS.practice.theirs))).toBe(true);
    expect('error' in (await requireOwnedSession(MEMBER_B, IDS.practice.mine))).toBe(true);
  });
});

/* ── LETHALITY: wrong helpers, each of which must be caught ─────────────────── */

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · requireOwnedSession — defeat candidates (each must be caught)', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ask = async (sql: string, params: unknown[]): Promise<{ id: string; source: string } | null> => {
    const r = await db.query(sql, params);
    return (r.rows[0] as { id: string; source: string } | undefined) ?? null;
  };
  const SEL_P = "SELECT id, 'practice' AS source FROM practice_sessions WHERE";
  const SEL_S = "SELECT id, 'supervision' AS source FROM supervision_sessions WHERE";
  const guarded = (sid: unknown, mid: unknown) => typeof sid === 'string' && UUID.test(sid) && typeof mid === 'string' && mid.length > 0;

  /** a helper built from the two WHERE clauses under test, with the UUID guard of the real one unless told otherwise */
  const build = (p: string, s: string, o: { params?: (sid: string, mid: string) => unknown[]; noGuard?: boolean; practiceOnly?: boolean } = {}): Impl =>
    async (sid, mid) => {
      if (!o.noGuard && !guarded(sid, mid)) return null;
      const params = o.params ? o.params(sid as string, mid as string) : [sid, mid];
      const sql = o.practiceOnly ? `${SEL_P} ${p}` : `${SEL_P} ${p} UNION ALL ${SEL_S} ${s} LIMIT 1`;
      return ask(sql, params);
    };

  const OWN = 'id = $1 AND practitioner_id = $2';

  it('control: the same construction with the correct predicate is clean under the same checker', async () => {
    expect(await checkHelper(build(OWN, OWN))).toEqual([]);
  });

  it('DC-Q1 the shipped defect: the owner is not in the SQL (`WHERE id = $1`)', async () => {
    const v = await checkHelper(build('id = $1', 'id = $1'));
    expect(v.some((m) => m.startsWith('H3['))).toBe(true);
    expect(v.some((m) => m.startsWith('H4['))).toBe(true);
  });

  it('DC-Q2 the owner is in the practice predicate only (a supervision session of anyone is reachable)', async () => {
    const v = await checkHelper(build(OWN, 'id = $1'));
    expect(v.some((m) => m.startsWith('H3[supervision]'))).toBe(true);
  });

  it('DC-Q3 an unowned legacy row is allowed (`practitioner_id = $2 OR practitioner_id IS NULL`)', async () => {
    const wide = 'id = $1 AND (practitioner_id = $2 OR practitioner_id IS NULL)';
    const v = await checkHelper(build(wide, wide));
    expect(v.some((m) => m.startsWith('H4['))).toBe(true);
    expect(v.some((m) => m.startsWith('H3[')))
      .toBe(false); // another practitioner's row is still refused — only the legacy hole is open
  });

  it('DC-Q4 the owner is bound to the wrong slot (params [member, id]): the owner is locked out', async () => {
    const v = await checkHelper(build(OWN, OWN, { params: (sid, mid) => [mid, sid] }));
    expect(v.some((m) => m.startsWith('H1['))).toBe(true);
  });

  it('DC-Q5 only practice_sessions is searched: an owner\'s supervision session is unreachable', async () => {
    const v = await checkHelper(build(OWN, OWN, { practiceOnly: true }));
    expect(v.some((m) => m.startsWith('H1[supervision]'))).toBe(true);
  });

  it('DC-Q6 "has an owner" instead of "is the owner" (`practitioner_id IS NOT NULL`)', async () => {
    const v = await checkHelper(build('id = $1 AND practitioner_id IS NOT NULL', 'id = $1 AND practitioner_id IS NOT NULL'));
    expect(v.some((m) => m.startsWith('H3['))).toBe(true);
  });

  it('DC-Q7 the member is not bound at all (the $2 slot is undefined): fails closed, so the owner is locked out', async () => {
    const v = await checkHelper(build(OWN, OWN, { params: (sid) => [sid, undefined] }));
    expect(v.some((m) => m.startsWith('H1['))).toBe(true);
  });

  it('DC-Q8 no UUID guard: a malformed id reaches SQL (in PostgreSQL a type error, i.e. a 500 that differs from the 404)', async () => {
    const v = await checkHelper(build(OWN, OWN, { noGuard: true }));
    expect(v.some((m) => m.startsWith('H7'))).toBe(true);
  });

  it('DC-Q9 an existence oracle: the helper answers `forbidden` when the row exists and is not yours', async () => {
    const oracle: Impl = async (sid, mid) => {
      if (!guarded(sid, mid)) return null;
      const mine = await ask(`${SEL_P} ${OWN} UNION ALL ${SEL_S} ${OWN} LIMIT 1`, [sid, mid]);
      if (mine) return mine;
      const exists = await ask(`${SEL_P} id = $1 UNION ALL ${SEL_S} id = $1 LIMIT 1`, [sid]);
      return exists ? { forbidden: true } : null;
    };
    const v = await checkHelper(oracle);
    expect(v.some((m) => m.startsWith('H3'))).toBe(true);
  });

  it('DC-Q10 two statements (existence first, owner second): not a single guarded lookup', async () => {
    const two: Impl = async (sid, mid) => {
      if (!guarded(sid, mid)) return null;
      await ask(`${SEL_P} id = $1 UNION ALL ${SEL_S} id = $1 LIMIT 1`, [sid]);
      return ask(`${SEL_P} ${OWN} UNION ALL ${SEL_S} ${OWN} LIMIT 1`, [sid, mid]);
    };
    const v = await checkHelper(two);
    expect(v.some((m) => m.startsWith('H8'))).toBe(true);
  });
});
