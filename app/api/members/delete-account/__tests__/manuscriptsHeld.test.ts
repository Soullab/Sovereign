/**
 * Account closure — a member who holds a Work is REFUSED by design, not by accident, and a foreign key the registry
 * has never heard of is still a refusal, never "try again".
 *
 * `member_manuscripts.member_id` and `living_works.member_id` both name `members` ON DELETE RESTRICT (baseline SQL,
 * asserted below). The route's governed-content preflight listed neither, so for a member whose only content is a Work
 * the refuse posture never fired: the transaction reached `DELETE FROM members`, the foreign key refused, the
 * transaction rolled back, and the member got a bare 500 "Failed to delete account" (which the Account page answers
 * with "Please try again") instead of the designed 409 (`accountChanged:false`, `nextStep:'contact_support'`,
 * `retained:[…]`). The first fix listed `member_manuscripts` only; a Work with no manuscript yet (a designed state: the
 * home "Door" creates one) still reached the 500. Two laws, tested separately:
 *
 *   L1  the registry names what is held, in the member's words (so the member is told WHAT).
 *   L2  whatever the registry does not name, a foreign-key refusal that rolled the transaction back reads as the same
 *       designed refusal (so no table the registry misses can make a deterministic refusal look like a transient fault).
 *       It stays narrow: any other failure is still a 500.
 *
 * The database is a fictional double that enforces the foreign keys named below, including one that belongs to no table
 * the registry lists. Fictional member, no real data. The drift guard is blockingForeignKeys.test.ts.
 *
 * Defeat candidates: the real route with exactly one wrong change, loaded in-test, must fail the same checks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadFromSource } from '@/app/writers-studio/__tests__/support/loadFromSource';

jest.mock('@/lib/db/postgres', () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock('@/lib/auth/getMemberFromRequest', () => ({ getMemberIdFromRequest: jest.fn() }));
jest.mock('@/lib/auth/serverSessions', () => ({ clearSessionCookie: jest.fn().mockResolvedValue(undefined) }));

import { query, transaction } from '@/lib/db/postgres';
import { getMemberIdFromRequest } from '@/lib/auth/getMemberFromRequest';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockTx = transaction as jest.MockedFunction<typeof transaction>;
const mockResolve = getMemberIdFromRequest as jest.MockedFunction<typeof getMemberIdFromRequest>;

const ROUTE = path.join(process.cwd(), 'app/api/members/delete-account/route.ts');
const ME = 'fictional-member-with-one-work';
const req = (body: unknown) => ({ json: async () => body }) as never;
const post = (mod: Record<string, any>) => mod.POST as (r: never) => Promise<Response>;

/** Foreign keys the double enforces: members <- table ON DELETE RESTRICT. The last belongs to no table the registry lists. */
const FOREIGN_KEYS: Record<string, string> = {
  member_manuscripts: 'member_manuscripts_member_id_fkey',
  living_works: 'living_works_member_id_fkey',
  a_table_the_registry_has_never_heard_of: 'a_table_the_registry_has_never_heard_of_member_id_fkey',
};
const UNREGISTERED = 'a_table_the_registry_has_never_heard_of';

/** Rows per table for the fictional member; anything absent is zero. */
let held: Record<string, number>;
let txStatements: string[];
let failTxWith: unknown;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  held = {};
  txStatements = [];
  failTxWith = undefined;
  mockResolve.mockResolvedValue(ME);
  mockQuery.mockImplementation((async (sql: string) => {
    if (/FROM members WHERE id/.test(sql)) return { rows: [{ username: 'my-name' }] };
    const count = /FROM (\w+) WHERE \w+ = \$1/.exec(sql);
    if (count && /count\(\*\)/.test(sql)) return { rows: [{ n: String(held[count[1]] ?? 0) }] };
    return { rows: [] };
  }) as never);
  mockTx.mockImplementation((async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      query: async (sql: string) => {
        txStatements.push(sql);
        if (failTxWith !== undefined && /DELETE FROM members/.test(sql)) throw failTxWith;
        if (/DELETE FROM members/.test(sql)) {
          for (const [table, constraint] of Object.entries(FOREIGN_KEYS)) {
            if ((held[table] ?? 0) > 0) {
              throw Object.assign(
                new Error(`update or delete on table "members" violates foreign key constraint "${constraint}" on table "${table}"`),
                { code: '23503', constraint, table },
              );
            }
          }
        }
        return { rows: [] };
      },
    };
    return cb(tx); // a throw here is the rolled-back transaction
  }) as never);
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

async function closeAccount(mod: Record<string, any>) {
  const res = await post(mod)(req({ confirmUsername: 'my-name' }));
  return { status: res.status, body: await res.json() as Record<string, any> };
}

/** Named violations of "the member is refused, told, and nothing changed"; empty is conforming. */
function refusalViolations(
  r: { status: number; body: Record<string, any> },
  expectRetained: Array<{ label: string; rows: number }>,
): string[] {
  const found: string[] = [];
  if (r.status !== 409) found.push(`not-the-designed-409(${r.status})`);
  if (r.body.accountChanged !== false) found.push('accountChanged-not-false');
  if (r.body.nextStep !== 'contact_support') found.push('no-contact-support-next-step');
  if (JSON.stringify(r.body.retained) !== JSON.stringify(expectRetained)) found.push('does-not-say-what-is-held');
  return found;
}

/** Named violations of "an unclassified failure is not dressed as the designed refusal"; empty is conforming. */
function narrownessViolations(r: { status: number; body: Record<string, any> }): string[] {
  const found: string[] = [];
  if (r.status !== 500) found.push(`unclassified-failure-answered-${r.status}`);
  if (r.body.accountChanged !== undefined) found.push('claims-accountChanged-for-an-unclassified-failure');
  return found;
}

describe('the foreign keys the double enforces are the real ones', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database/baseline/0001_baseline_2026-09-01.sql'), 'utf8');
  for (const [table, constraint] of Object.entries(FOREIGN_KEYS).filter(([t]) => t !== UNREGISTERED)) {
    it(`baseline SQL: ${table}.member_id → members ON DELETE RESTRICT`, () => {
      expect(sql).toContain(
        `ADD CONSTRAINT "${constraint}" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE RESTRICT;`,
      );
    });
  }
});

describe('L1 — a member who holds a Work is told what is held, whichever table holds it', () => {
  for (const table of ['member_manuscripts', 'living_works']) {
    it(`${table} only: 409, accountChanged:false, "your writing"; nothing is attempted`, async () => {
      held[table] = 1;
      const r = await closeAccount(loadFromSource(ROUTE));
      expect(refusalViolations(r, [{ label: 'your writing', rows: 1 }])).toEqual([]);
      expect(r.body.error).toBe('deletion_incomplete_unavailable');
      expect(mockTx).not.toHaveBeenCalled();
      expect(txStatements).toEqual([]);
    });
  }

  it('a Work with a manuscript is one category, counted across both tables', async () => {
    held.living_works = 1;
    held.member_manuscripts = 1;
    const r = await closeAccount(loadFromSource(ROUTE));
    expect(refusalViolations(r, [{ label: 'your writing', rows: 2 }])).toEqual([]);
  });

  it('a member with no Work and no governed content is still closed (unchanged behaviour)', async () => {
    const { status, body } = await closeAccount(loadFromSource(ROUTE));
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true });
  });
});

describe('L2 — a foreign key the registry does not name is still the designed refusal', () => {
  it('rolled back by a foreign key on a table nobody listed: 409, accountChanged:false, contact support', async () => {
    held[UNREGISTERED] = 1;
    const r = await closeAccount(loadFromSource(ROUTE));
    expect(refusalViolations(r, [])).toEqual([]);
    expect(r.body.error).toBe('deletion_incomplete_unavailable');
    expect(r.body.success).toBeUndefined();
    expect(mockTx).toHaveBeenCalled(); // it really was attempted, and the transaction really rolled back
  });

  it('stays narrow: a failure that is not a foreign-key refusal is still a 500, never dressed as the refusal', async () => {
    failTxWith = Object.assign(new Error('connection terminated'), { code: '57P01' });
    const r = await closeAccount(loadFromSource(ROUTE));
    expect(narrownessViolations(r)).toEqual([]);
    expect(r.body.error).toBe('Failed to delete account');
  });

  it('a thrown value with no code at all is a 500', async () => {
    failTxWith = new Error('db exploded');
    const r = await closeAccount(loadFromSource(ROUTE));
    expect(narrownessViolations(r)).toEqual([]);
  });
});

describe('lethality — each defeat candidate fails the same checks', () => {
  const LIVING_WORKS_LINE = "  { table: 'living_works', column: 'member_id', label: 'your writing' },\n";
  const MANUSCRIPTS_LINE = "  { table: 'member_manuscripts', column: 'member_id', label: 'your writing' },\n";
  const NET = /if \(\(error as \{ code\?: string \} \| null\)\?\.code === '23503'\) \{/;

  it('the registry without living_works: the refusal names nothing for a Work with no manuscript (L1)', async () => {
    held.living_works = 1;
    const candidate = loadFromSource(ROUTE, (s) => s.replace(LIVING_WORKS_LINE, ''));
    const r = await closeAccount(candidate);
    expect(refusalViolations(r, [{ label: 'your writing', rows: 1 }])).toContain('does-not-say-what-is-held');
  });

  it('the registry without member_manuscripts: the refusal names nothing for a written Work (L1)', async () => {
    held.member_manuscripts = 1;
    const candidate = loadFromSource(ROUTE, (s) => s.replace(MANUSCRIPTS_LINE, ''));
    const r = await closeAccount(candidate);
    expect(refusalViolations(r, [{ label: 'your writing', rows: 1 }])).toContain('does-not-say-what-is-held');
  });

  it('no foreign-key net: a table the registry misses is the rolled-back 500 a member was told to retry (L2)', async () => {
    held[UNREGISTERED] = 1;
    const candidate = loadFromSource(ROUTE, (s) => s.replace(NET, 'if (false) {'));
    const r = await closeAccount(candidate);
    expect(refusalViolations(r, [])).toContain('not-the-designed-409(500)');
  });

  it('the route as it was before this fix (neither law) answers the 500 for a Work with no manuscript', async () => {
    held.living_works = 1;
    const candidate = loadFromSource(ROUTE, (s) => s.replace(LIVING_WORKS_LINE, '').replace(NET, 'if (false) {'));
    const r = await closeAccount(candidate);
    expect(r.status).toBe(500);
    expect(refusalViolations(r, [{ label: 'your writing', rows: 1 }])).toContain('not-the-designed-409(500)');
  });

  it('a net that dresses EVERY failure as the refusal claims "not changed" for a fault nobody has classified (narrowness)', async () => {
    failTxWith = new Error('db exploded');
    const candidate = loadFromSource(ROUTE, (s) => s.replace(NET, 'if (true) {'));
    const r = await closeAccount(candidate);
    expect(narrownessViolations(r)).toContain('unclassified-failure-answered-409');
    expect(narrownessViolations(r)).toContain('claims-accountChanged-for-an-unclassified-failure');
  });
});
