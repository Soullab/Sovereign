/** @jest-environment node */
/**
 * Founder ruling 2026-11-16 (#1900) — the attestation route: member-scoped, and it can never record an under-13 answer
 * or a minor without the supervision tick. Hermetic: stubbed database and auth.
 */
const query = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...a: unknown[]) => query(...a) }));
const member = jest.fn();
jest.mock('@/lib/auth/getMemberFromRequest', () => ({ getMemberIdFromRequest: (...a: unknown[]) => member(...a) }));
import { NextRequest } from 'next/server';
import { POST } from '../route';

const ME = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { jest.clearAllMocks(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());
const route = () => ({ POST });
describe('the attestation route', () => {
  const post = (body: unknown) => new NextRequest('https://soullab.life/api/sovereign/writers-studio/age-attestation', { method: 'POST', body: JSON.stringify(body) } as never);
  const inserts = () => query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO member_age_attestations'));

  test('unauthenticated: 401, nothing written', async () => {
    member.mockResolvedValueOnce(null);
    expect((await route().POST(post({ band: 'adult' }))).status).toBe(401);
    expect(inserts()).toHaveLength(0);
  });

  test('an under-13 answer, or a minor without the tick, is refused and NOTHING is written', async () => {
    member.mockResolvedValue(ME);
    for (const bad of [{ band: 'under_13' }, { band: 'minor' }, { band: 'minor', supervised: false }]) {
      expect((await route().POST(post(bad))).status).toBe(400);
    }
    expect(inserts()).toHaveLength(0);
  });

  test('a supervised minor is recorded for THIS member only, with the program door', async () => {
    member.mockResolvedValue(ME);
    query.mockResolvedValue({ rows: [] });
    expect((await route().POST(post({ band: 'minor', supervised: true, path: 'college-essay', memberId: 'someone-else' }))).status).toBe(204);
    expect(inserts()).toHaveLength(1);
    expect(inserts()[0]![1]).toEqual([ME, 'minor', true, 'college-essay']);
  });

  test('an unregistered path is not recorded as the door', async () => {
    member.mockResolvedValue(ME);
    query.mockResolvedValue({ rows: [] });
    await route().POST(post({ band: 'adult', path: 'grant-proposal' }));
    expect(inserts()[0]![1]).toEqual([ME, 'adult', false, null]);
  });
});


describe('GET ?work=: whether THIS member’s Work needs the answer (walk 2026-11-16)', () => {
  const { GET } = require('../route') as typeof import('../route');
  const get = (q = '') => new NextRequest(`https://soullab.life/api/sovereign/writers-studio/age-attestation${q}`, { method: 'GET' } as never);
  const answer = (sql: string, studioPath: string | null, attestation: unknown) =>
    query.mockImplementation(async (s: string) => (String(s).includes('FROM living_works') ? { rows: studioPath === undefined ? [] : [{ studio_path: studioPath }] }
      : String(s).includes('FROM member_age_attestations') ? { rows: attestation ? [attestation] : [] } : { rows: [] }));

  test('a College Essay Work with no attestation: required, not attested; the program is read for THIS member', async () => {
    member.mockResolvedValue(ME);
    answer('', 'college-essay', null);
    const res = await GET(get('?work=w1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ attested: null, required: true });
    const workRead = query.mock.calls.find(([s]) => String(s).includes('FROM living_works'))!;
    expect(workRead[1]).toEqual(['w1', ME]);
  });
  test('an ordinary Work: not required; an attested adult: attested', async () => {
    member.mockResolvedValue(ME);
    answer('', null, { age_band: 'adult', supervision_attested: false });
    expect(await (await GET(get('?work=w2'))).json()).toEqual({ attested: 'adult', required: false });
  });
  test('without ?work the answer is unchanged (the door’s own check)', async () => {
    member.mockResolvedValue(ME);
    answer('', 'college-essay', null);
    expect(await (await GET(get())).json()).toEqual({ attested: null });
  });
  test('an unreadable program is 503, never "not required"', async () => {
    member.mockResolvedValue(ME);
    query.mockImplementation(async (s: string) => { if (String(s).includes('FROM living_works')) throw new Error('down'); return { rows: [] }; });
    expect((await GET(get('?work=w3'))).status).toBe(503);
  });
});
