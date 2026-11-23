/**
 * ASTRO-PRO-KEEP Phase 2 store rules: what may be carried into MAIA's memory
 * (own chart alone, a MAIA answer with its question) and what is recalled per
 * chart (the caller's single-chart threads about that chart only).
 */
import { query } from '@/lib/db/postgres';
import { parseSubjectKey, recallSubjectExchanges, resolveCarrySource } from '../proConversationStore';

jest.mock('@/lib/db/postgres', () => ({ query: jest.fn(), transaction: jest.fn() }));

const THREAD = '33333333-3333-3333-3333-333333333333';
const CLIENT = '44444444-4444-4444-4444-444444444444';
const OTHER = '55555555-5555-5555-5555-555555555555';
const at = new Date('2026-11-20T10:00:00Z');

beforeEach(() => jest.mocked(query).mockReset());

describe('parseSubjectKey', () => {
  it('reads section, subject and other', () => {
    expect(parseSubjectKey('ask.natal.own.')).toEqual({ section: 'natal', subject: 'own', other: '' });
    expect(parseSubjectKey(`ask.biwheel.own.${CLIENT}`)).toEqual({ section: 'biwheel', subject: 'own', other: CLIENT });
  });
  it('rejects anything else', () => {
    for (const k of ['', 'ask.natal', 'help.natal.own.', 'ask..own.', 'ask.natal.own.x.y']) expect(parseSubjectKey(k)).toBeNull();
  });
});

describe('resolveCarrySource', () => {
  it('re-derives the subject from the stored thread, scoped to the caller and Keep', async () => {
    jest.mocked(query)
      .mockResolvedValueOnce({ rows: [{ subject_key: 'ask.transits.own.' }] } as never)
      .mockResolvedValueOnce({ rows: [
        { id: 'q-id', turn_index: 2, speaker: 'member', body: 'Q', created_at: at },
        { id: 'a-id', turn_index: 3, speaker: 'maia', body: 'A', created_at: at },
      ] } as never);
    const r = await resolveCarrySource('member-A', THREAD, 3);
    expect(r).toEqual({ ok: true, source: { memberTurn: 'Q', maiaTurn: 'A', maiaTurnId: 'a-id', section: 'transits', askedAt: at.toISOString() } });
    const [sql, params] = jest.mocked(query).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('member_id = $2');
    expect(sql).toContain('keep = true');
    expect(params).toEqual([THREAD, 'member-A']);
  });

  it('refuses a client chart', async () => {
    jest.mocked(query).mockResolvedValueOnce({ rows: [{ subject_key: `ask.natal.${CLIENT}.` }] } as never);
    expect(await resolveCarrySource('member-A', THREAD, 1)).toEqual({ ok: false, reason: 'not_own_chart' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('refuses a two-chart thread, even own chart with a client', async () => {
    jest.mocked(query).mockResolvedValueOnce({ rows: [{ subject_key: `ask.composite.own.${CLIENT}` }] } as never);
    expect(await resolveCarrySource('member-A', THREAD, 1)).toEqual({ ok: false, reason: 'not_own_chart' });
  });

  it('refuses another member\'s or an unkept thread', async () => {
    jest.mocked(query).mockResolvedValueOnce({ rows: [] } as never);
    expect(await resolveCarrySource('member-A', THREAD, 1)).toEqual({ ok: false, reason: 'thread_not_found' });
  });

  it('refuses a member turn, or an answer without its question', async () => {
    jest.mocked(query)
      .mockResolvedValueOnce({ rows: [{ subject_key: 'ask.natal.own.' }] } as never)
      .mockResolvedValueOnce({ rows: [
        { id: 'a', turn_index: 1, speaker: 'maia', body: 'A', created_at: at },
        { id: 'b', turn_index: 2, speaker: 'member', body: 'Q', created_at: at },
      ] } as never);
    expect(await resolveCarrySource('member-A', THREAD, 2)).toEqual({ ok: false, reason: 'turn_not_found' });
    jest.mocked(query).mockResolvedValueOnce({ rows: [{ subject_key: 'ask.natal.own.' }] } as never);
    expect(await resolveCarrySource('member-A', THREAD, 0)).toEqual({ ok: false, reason: 'turn_not_found' });
  });
});

describe('recallSubjectExchanges', () => {
  const row = (subject_key: string, thread_id: string, turn_index: number, speaker: string, body: string) =>
    ({ subject_key, thread_id, turn_index, speaker, body, created_at: at });

  it('scopes to the caller, the one chart, single-chart threads, kept threads, and not the current thread', async () => {
    jest.mocked(query).mockResolvedValueOnce({ rows: [] } as never);
    await recallSubjectExchanges('member-A', CLIENT, `ask.natal.${CLIENT}.`);
    const [sql, params] = jest.mocked(query).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('th.member_id = $1');
    expect(sql).toContain('th.keep = true');
    expect(sql).toContain("split_part(th.subject_key, '.', 3) = $2");
    expect(sql).toContain("split_part(th.subject_key, '.', 4) = ''");
    expect(sql).toContain('th.subject_key <> $3');
    expect(params.slice(0, 3)).toEqual(['member-A', CLIENT, `ask.natal.${CLIENT}.`]);
  });

  it('pairs each answer with its own question, newest first', async () => {
    jest.mocked(query).mockResolvedValueOnce({ rows: [
      row(`ask.transits.${CLIENT}.`, 't2', 1, 'maia', 'A2'),
      row(`ask.transits.${CLIENT}.`, 't2', 0, 'member', 'Q2'),
      row(`ask.vedic.${CLIENT}.`, 't1', 3, 'maia', 'A1'),
      row(`ask.vedic.${CLIENT}.`, 't1', 2, 'member', 'Q1'),
    ] } as never);
    expect(await recallSubjectExchanges('member-A', CLIENT, `ask.natal.${CLIENT}.`)).toEqual([
      { section: 'transits', q: 'Q2', a: 'A2', at: '2026-11-20' },
      { section: 'vedic', q: 'Q1', a: 'A1', at: '2026-11-20' },
    ]);
  });

  it('never pairs turns across threads', async () => {
    jest.mocked(query).mockResolvedValueOnce({ rows: [
      row(`ask.transits.${CLIENT}.`, 't2', 1, 'maia', 'A2'),
      row(`ask.vedic.${CLIENT}.`, 't1', 0, 'member', 'Q1'),
    ] } as never);
    expect(await recallSubjectExchanges('member-A', CLIENT, `ask.natal.${CLIENT}.`)).toEqual([]);
  });

  it('stops at the character budget', async () => {
    const big = 'x'.repeat(3500);
    jest.mocked(query).mockResolvedValueOnce({ rows: [
      row(`ask.transits.${CLIENT}.`, 't2', 1, 'maia', big), row(`ask.transits.${CLIENT}.`, 't2', 0, 'member', 'Q2'),
      row(`ask.vedic.${CLIENT}.`, 't1', 1, 'maia', big), row(`ask.vedic.${CLIENT}.`, 't1', 0, 'member', 'Q1'),
    ] } as never);
    expect(await recallSubjectExchanges('member-A', CLIENT, `ask.natal.${CLIENT}.`)).toHaveLength(1);
  });

  it('reads nothing for a malformed subject', async () => {
    expect(await recallSubjectExchanges('member-A', `${CLIENT}.${OTHER}`, 'ask.natal.x.')).toEqual([]);
    expect(await recallSubjectExchanges('member-A', '', 'ask.natal.x.')).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
