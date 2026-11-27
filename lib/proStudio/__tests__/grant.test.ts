import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CURRENT_GRANT_SQL, PRO_STUDIO_GRANT_PATHS, readProStudioGrant } from '../grant';

jest.mock('@/lib/db/postgres', () => ({ query: jest.fn() }));

const member = '11111111-1111-4111-8111-111111111111';
const rowsOf = (rows: Array<Record<string, unknown>>) => jest.fn().mockResolvedValue({ rows });
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Pro Studio grant reader (HOUSE-ENTRANCE-01 §9) — fictional members only', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  test.each(PRO_STUDIO_GRANT_PATHS)('a current %s grant verifies the workspace and names its path', async (p) => {
    const run = rowsOf([{ id: 'grant-1', path: p }]);
    await expect(readProStudioGrant(member, run)).resolves.toEqual({
      entitlement: 'verified', state: 'current_grant', grantId: 'grant-1', path: p,
    });
    expect(run).toHaveBeenCalledWith(CURRENT_GRANT_SQL, [member]);
  });

  test('no current grant is absent, and says so as no_grant', async () => {
    await expect(readProStudioGrant(member, rowsOf([]))).resolves.toEqual({ entitlement: 'absent', state: 'no_grant' });
  });

  test('an unreadable table fails closed and is distinguishable from no grant', async () => {
    const run = jest.fn().mockRejectedValue(Object.assign(new Error('relation does not exist'), { code: '42P01' }));
    await expect(readProStudioGrant(member, run)).resolves.toEqual({ entitlement: 'absent', state: 'unreadable' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unreadable'), { table: 'pro_studio_grants', code: '42P01' });
  });

  test('a row with a path outside the four canon paths is refused, never trusted', async () => {
    for (const p of ['pro', 'free', 'personal', 'founder', '', null]) {
      await expect(readProStudioGrant(member, rowsOf([{ id: 'g', path: p }]))).resolves.toMatchObject({ entitlement: 'absent' });
    }
  });

  test('a non-uuid member id never reaches the database', async () => {
    const run = rowsOf([{ id: 'g', path: 'paid' }]);
    for (const id of ['', 'fiction-only-member', "x' OR 1=1 --", undefined as unknown as string]) {
      await expect(readProStudioGrant(id, run)).resolves.toEqual({ entitlement: 'absent', state: 'no_grant' });
    }
    expect(run).not.toHaveBeenCalled();
  });

  test('"current" is computed on the database clock: unrevoked, started, not expired', () => {
    const sql = CURRENT_GRANT_SQL.replace(/\s+/g, ' ');
    expect(sql).toContain('FROM pro_studio_grants');
    expect(sql).toContain('member_id = $1');
    expect(sql).toContain('revoked_at IS NULL');
    expect(sql).toContain('starts_at <= now()');
    expect(sql).toContain('(expires_at IS NULL OR expires_at > now())');
  });

  test('static boundary: never derived from tier, subscription, practitioner row or studioMode; never writes', () => {
    const src = stripComments(read('lib/proStudio/grant.ts'));
    expect(src).not.toMatch(/\btier\b|subscription|members\b|practitioner|studioMode|isFounderMemberId/i);
    expect(src).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
  });

  test('confers no client-data or Co-Lab permission: only the Pro Studio door imports the reader', () => {
    const importers = execFileSync('git', ['grep', '-l', '-E', 'proStudio/grant[\'"]', '--', 'app', 'lib', 'components', 'middleware.ts'], {
      encoding: 'utf8',
    }).trim().split('\n').filter((f) => f && !f.includes('__tests__'));
    expect(importers).toEqual(['app/pro-studio/page.tsx']);
  });

  test('the migration keeps the grant append-only, revocable, self-grant-free and tier-free', () => {
    const sql = read('database/migrations/20261127000001_pro_studio_grants.sql');
    expect(sql).toMatch(/CHECK \(path IN \('paid', 'scholarship', 'exchange', 'apprenticeship'\)\)/);
    expect(sql).toMatch(/granted_by_member_id\s+uuid NOT NULL/);
    expect(sql).toMatch(/CHECK \(granted_by_member_id <> member_id\)/);
    expect(sql).toMatch(/BEFORE DELETE ON pro_studio_grants/);
    expect(sql).toMatch(/BEFORE UPDATE ON pro_studio_grants/);
    const ddl = stripComments(sql.replace(/^\s*--.*$/gm, '')).replace(/COMMENT ON[\s\S]*?;/g, '');
    expect(ddl).not.toMatch(/\btier\b|subscription|practitioner|colab|co_lab/i);
  });
});
