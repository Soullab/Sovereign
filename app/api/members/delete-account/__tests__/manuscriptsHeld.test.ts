/**
 * Account closure — a member who holds a Work is REFUSED by design, not by accident.
 *
 * `member_manuscripts.member_id` names `members` ON DELETE RESTRICT (baseline SQL, asserted below). The route's
 * governed-content preflight did not list that table, so for a member whose only content is a Work the refuse
 * posture never fired: the transaction reached `DELETE FROM members`, the foreign key refused, the transaction rolled
 * back, and the member got a bare 500 "Failed to delete account" instead of the designed 409
 * (`accountChanged:false`, `nextStep:'contact_support'`, `retained:[…]`).
 *
 * The database is a fictional double that enforces the one foreign key under test. Fictional member, no real data.
 * Defeat candidate: the real route with that one registry line removed must produce the observed 500.
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

/** Rows per table for the fictional member; anything absent is zero. */
let held: Record<string, number>;
let txStatements: string[];
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  held = {};
  txStatements = [];
  mockResolve.mockResolvedValue(ME);
  mockQuery.mockImplementation((async (sql: string) => {
    if (/FROM members WHERE id/.test(sql)) return { rows: [{ username: 'my-name' }] };
    const count = /FROM (\w+) WHERE \w+ = \$1/.exec(sql);
    if (count && /count\(\*\)/.test(sql)) return { rows: [{ n: String(held[count[1]] ?? 0) }] };
    return { rows: [] };
  }) as never);
  // The one foreign key under test: members <- member_manuscripts ON DELETE RESTRICT.
  mockTx.mockImplementation((async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      query: async (sql: string) => {
        txStatements.push(sql);
        if (/DELETE FROM members/.test(sql) && (held.member_manuscripts ?? 0) > 0) {
          throw Object.assign(
            new Error('update or delete on table "members" violates foreign key constraint "member_manuscripts_member_id_fkey"'),
            { code: '23503' },
          );
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

describe('the foreign key the double enforces is the real one', () => {
  it('baseline SQL: member_manuscripts.member_id → members ON DELETE RESTRICT', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'database/baseline/0001_baseline_2026-09-01.sql'), 'utf8');
    expect(sql).toMatch(
      /ADD CONSTRAINT "member_manuscripts_member_id_fkey" FOREIGN KEY \("member_id"\) REFERENCES "public"\."members"\("id"\) ON DELETE RESTRICT/,
    );
  });
});

describe('a member who holds a Work gets the designed refusal, not a rolled-back 500', () => {
  it('409 with accountChanged:false and the label "your writing"; nothing is attempted', async () => {
    held.member_manuscripts = 1;
    const { status, body } = await closeAccount(loadFromSource(ROUTE));
    expect(status).toBe(409);
    expect(body).toMatchObject({
      error: 'deletion_incomplete_unavailable',
      accountChanged: false,
      nextStep: 'contact_support',
    });
    expect(body.retained).toEqual([{ label: 'your writing', rows: 1 }]);
    expect(mockTx).not.toHaveBeenCalled();
    expect(txStatements).toEqual([]);
  });

  it('a member with no Work and no governed content is still closed (unchanged behaviour)', async () => {
    const { status, body } = await closeAccount(loadFromSource(ROUTE));
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true });
  });
});

describe('lethality — a registry without the Work table fails the same check', () => {
  it('the real route minus the member_manuscripts line answers the rolled-back 500, not the refusal', async () => {
    held.member_manuscripts = 1;
    const candidate = loadFromSource(ROUTE, (s) =>
      s.replace("  { table: 'member_manuscripts', column: 'member_id', label: 'your writing' },\n", ''));
    const { status, body } = await closeAccount(candidate);
    expect(status).toBe(500); // what a member with a Work saw before: the FK refused inside the transaction
    expect(body.accountChanged).toBeUndefined();
    expect(mockTx).toHaveBeenCalled();
  });
});
