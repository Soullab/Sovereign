/**
 * PRACTITIONER-API-IDENTITY-01 — the one SQL boundary the identity fix changed.
 *
 * `acknowledgeGrowth(growthId, notes, practitionerId)` marks a growth observation
 * acknowledged. `PATCH /api/practice/growth` used to carry no identity at all and
 * acknowledged ANY row by id; the fix makes the session practitioner part of the SQL
 * predicate (`WHERE id = $1 AND practitioner_id = $3`), so a row that is not theirs matches
 * nothing and reads exactly like an unknown id.
 *
 * Why this suite exists: the route-level suite (`app/api/practice/__tests__/
 * identityFromSession.test.ts`) mocks `@/lib/practice/PracticeStore` WHOLESALE, and that mock
 * enforces ownership itself. A mutant of the REAL store that drops the predicate therefore
 * passed every route, matrix and static-guard suite (reproduced: 8 suites / 133 tests green
 * with the predicate removed). The boundary lives in the SQL string, so this suite runs the
 * REAL `acknowledgeGrowth` against a fake `query` that actually EVALUATES the WHERE clause
 * it is handed, plus a structural pin of the statement and its parameters.
 *
 * What is NOT claimed: this is a model of one statement, not a database. PostgreSQL itself is
 * not run here (no database in this suite). The evaluator understands only
 * `col = $n [AND col = $n …]` predicates and REFUSES anything else, so a rewritten predicate
 * (OR, <>, a function) fails loudly instead of being quietly mis-modelled.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>>();
jest.mock('@/lib/db/postgres', () => ({
  __esModule: true,
  default: { query: (sql: string, params?: unknown[]) => mockQuery(sql, params) },
  query: (sql: string, params?: unknown[]) => mockQuery(sql, params),
}));

import { acknowledgeGrowth } from '@/lib/practice/PracticeStore';

/* ── a world with two practitioners' growth rows ─────────────────────────────── */

const MEMBER_A = '11111111-1111-4111-8111-111111111111';
const MEMBER_B = '22222222-2222-4222-8222-222222222222';
const G_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const G_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const B_NOTE = 'b-private-reflection';

type GrowthRow = {
  id: string;
  practitioner_id: string;
  observation: string;
  acknowledged: boolean;
  practitioner_notes: string | null;
};

let rows: GrowthRow[] = [];
let issued: Array<{ sql: string; params: unknown[] }> = [];

function seed(): void {
  rows = [
    { id: G_A, practitioner_id: MEMBER_A, observation: 'growth-of-A', acknowledged: false, practitioner_notes: null },
    { id: G_B, practitioner_id: MEMBER_B, observation: 'growth-of-B', acknowledged: false, practitioner_notes: B_NOTE },
  ];
  issued = [];
}

const stateOfB = (): string => JSON.stringify(rows.filter((r) => r.practitioner_id === MEMBER_B));

/**
 * Evaluates `UPDATE practitioner_growth SET acknowledged = TRUE, practitioner_notes =
 * COALESCE($2, practitioner_notes) WHERE <conjunction of col = $n> RETURNING *`.
 * SQL comparison with NULL is never true, so an unbound ($n -> undefined/null) parameter
 * matches no row — which is also how a real `practitioner_id = NULL` behaves.
 */
function fakeUpdate(sql: string, params: unknown[] = []): { rows: unknown[] } {
  issued.push({ sql, params });
  const flat = sql.replace(/\s+/g, ' ').trim();
  const m = /^UPDATE practitioner_growth SET acknowledged = TRUE, practitioner_notes = COALESCE\(\$2, practitioner_notes\) WHERE (.+) RETURNING \*$/i.exec(flat);
  if (!m) throw new Error(`UNMODELLED_STATEMENT: ${flat}`);
  const conjuncts = (m[1] ?? '').split(/\s+AND\s+/i);
  const tests = conjuncts.map((c) => {
    const p = /^(\w+) = \$(\d+)$/.exec(c.trim());
    if (!p) throw new Error(`UNMODELLED_PREDICATE: ${c}`);
    return { col: p[1] as keyof GrowthRow, value: params[Number(p[2]) - 1] };
  });
  const hit = rows.filter((r) => tests.every((t) => t.value !== undefined && t.value !== null && r[t.col] === t.value));
  for (const r of hit) {
    r.acknowledged = true;
    r.practitioner_notes = (params[1] as string | null | undefined) ?? r.practitioner_notes;
  }
  return { rows: hit.map((r) => ({ ...r })) };
}

beforeEach(() => {
  seed();
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql, params) => fakeUpdate(sql, params));
});

/* ── the boundary check, run against any implementation ─────────────────────── */

type Impl = (growthId: string, notes: string | undefined, practitionerId: string) => Promise<unknown>;

/** Returns the violated properties; [] means the boundary holds. Re-seeds before each probe. */
async function checkOwnerBoundary(impl: Impl): Promise<string[]> {
  const violations: string[] = [];
  const attempt = async (label: string, f: () => Promise<unknown>): Promise<unknown> => {
    try {
      return await f();
    } catch (e) {
      violations.push(`${label}: THREW ${(e as Error).message.split(':')[0]}`);
      return undefined;
    }
  };

  // O1 — a practitioner naming ANOTHER practitioner's row changes nothing and reads as not found
  seed();
  const beforeB = stateOfB();
  const crossed = await attempt('O1', () => impl(G_B, 'overwrite', MEMBER_A));
  if (stateOfB() !== beforeB) violations.push("O1: another practitioner's row was changed");
  if (crossed !== null) violations.push('O1: a row that is not the session practitioner\'s did not read as not found');

  // O2 — an unknown id reads the same as O1 (no ownership oracle)
  seed();
  const unknown = await attempt('O2', () => impl('00000000-0000-4000-8000-000000000000', undefined, MEMBER_A));
  if (unknown !== null) violations.push('O2: an unknown id did not read as not found');

  // O3 — the owner still reaches their own row (the fix must not over-restrict)
  seed();
  const own = (await attempt('O3', () => impl(G_A, 'mine', MEMBER_A))) as GrowthRow | null | undefined;
  if (!own || own.id !== G_A) violations.push("O3: the owner could not acknowledge their own row");
  if (rows.find((r) => r.id === G_A)?.acknowledged !== true) violations.push('O3: the owner\'s row was not acknowledged');
  if (rows.find((r) => r.id === G_A)?.practitioner_notes !== 'mine') violations.push("O3: the owner's notes were not written");
  if (rows.find((r) => r.id === G_B)?.acknowledged !== false) violations.push("O3: acknowledging A's row touched B's");

  // O4 — a missing owner fails CLOSED (practitioner_id is NOT NULL, so NULL matches nothing)
  seed();
  const beforeAll = JSON.stringify(rows);
  const none = await attempt('O4', () => impl(G_A, undefined, undefined as unknown as string));
  if (JSON.stringify(rows) !== beforeAll) violations.push('O4: a missing owner changed a row');
  if (none !== null) violations.push('O4: a missing owner did not read as not found');

  return violations;
}

/** The fixed behaviour: the production function, unchanged, over the fake `query`. */
const production: Impl = (growthId, notes, practitionerId) => acknowledgeGrowth(growthId, notes, practitionerId);

/* ── 1. the production function ──────────────────────────────────────────────── */

describe('PRACTITIONER-API-IDENTITY-01 · acknowledgeGrowth — the owner is in the SQL', () => {
  it('holds every ownership property against the real function (O1-O4)', async () => {
    expect(await checkOwnerBoundary(production)).toEqual([]);
  });

  it('issues exactly one statement whose predicate is `id = $1 AND practitioner_id = $3` with params [id, notes, owner]', async () => {
    seed();
    await acknowledgeGrowth(G_A, 'a note', MEMBER_A);
    expect(issued).toHaveLength(1);
    const { sql, params } = issued[0]!;
    expect(sql.replace(/\s+/g, ' ')).toMatch(/WHERE id = \$1 AND practitioner_id = \$3 RETURNING \*/);
    expect(params).toEqual([G_A, 'a note', MEMBER_A]);
  });

  it('binds the owner at $3 even when there are no notes (notes -> null, owner unchanged)', async () => {
    seed();
    await acknowledgeGrowth(G_A, undefined, MEMBER_A);
    expect(issued[0]!.params).toEqual([G_A, null, MEMBER_A]);
  });
});

/* ── 2. LETHALITY — wrong stores that must each be caught ───────────────────── */

const callQuery = async (sql: string, params: unknown[]): Promise<{ rows: unknown[] }> => mockQuery(sql, params);
const UPDATE_HEAD = `
    UPDATE practitioner_growth
    SET acknowledged = TRUE, practitioner_notes = COALESCE($2, practitioner_notes)`;

describe('PRACTITIONER-API-IDENTITY-01 · acknowledgeGrowth — defeat candidates (each must be caught)', () => {
  it('control: the production function is clean under the same checker', async () => {
    expect(await checkOwnerBoundary(production)).toEqual([]);
  });

  it('DC-S1 the shipped defect: `WHERE id = $1`, the owner is never in the statement', async () => {
    const dc: Impl = async (growthId, notes) => {
      const r = await callQuery(`${UPDATE_HEAD}
    WHERE id = $1
    RETURNING *`, [growthId, notes || null]);
      return r.rows[0] || null;
    };
    const v = await checkOwnerBoundary(dc);
    expect(v.some((m) => m.startsWith('O1'))).toBe(true);
  });

  it('DC-S2 the call site passes the owner but the SQL ignores it (`WHERE id = $1`, three params)', async () => {
    const dc: Impl = async (growthId, notes, practitionerId) => {
      const r = await callQuery(`${UPDATE_HEAD}
    WHERE id = $1
    RETURNING *`, [growthId, notes || null, practitionerId]);
      return r.rows[0] || null;
    };
    const v = await checkOwnerBoundary(dc);
    expect(v.some((m) => m.startsWith('O1'))).toBe(true);
  });

  it('DC-S3 the predicate is there but its parameter is never bound (over-restriction: the owner is locked out)', async () => {
    const dc: Impl = async (growthId, notes) => {
      const r = await callQuery(`${UPDATE_HEAD}
    WHERE id = $1 AND practitioner_id = $3
    RETURNING *`, [growthId, notes || null]);
      return r.rows[0] || null;
    };
    const v = await checkOwnerBoundary(dc);
    expect(v.some((m) => m.startsWith('O3'))).toBe(true);
  });

  it('DC-S4 owner joined by OR (`id = $1 OR practitioner_id = $3`): the evaluator refuses to model it, so it is caught, not waved through', async () => {
    const dc: Impl = async (growthId, notes, practitionerId) => {
      const r = await callQuery(`${UPDATE_HEAD}
    WHERE id = $1 OR practitioner_id = $3
    RETURNING *`, [growthId, notes || null, practitionerId]);
      return r.rows[0] || null;
    };
    const v = await checkOwnerBoundary(dc);
    expect(v.some((m) => m.includes('UNMODELLED_PREDICATE'))).toBe(true);
  });

  it('DC-S5 ownership checked AFTER the write: the row is already changed when it is refused', async () => {
    const dc: Impl = async (growthId, notes, practitionerId) => {
      const r = await callQuery(`${UPDATE_HEAD}
    WHERE id = $1
    RETURNING *`, [growthId, notes || null]);
      const row = r.rows[0] as GrowthRow | undefined;
      return row && row.practitioner_id === practitionerId ? row : null;
    };
    const v = await checkOwnerBoundary(dc);
    expect(v.some((m) => m.includes("another practitioner's row was changed"))).toBe(true);
  });

  it('DC-S6 the owner param is bound to the wrong slot (params [id, owner, notes]): the notes become the owner', async () => {
    const dc: Impl = async (growthId, notes, practitionerId) => {
      const r = await callQuery(`${UPDATE_HEAD}
    WHERE id = $1 AND practitioner_id = $3
    RETURNING *`, [growthId, practitionerId, notes || null]);
      return r.rows[0] || null;
    };
    const v = await checkOwnerBoundary(dc);
    expect(v.length).toBeGreaterThan(0);
  });
});
