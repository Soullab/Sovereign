import {
  writerCorrectionContext,
  WRITER_CORRECTION_KINDS,
} from '../writerCorrections';

describe('writer correction succession', () => {
  it('keeps the prior MAIA claim visible while naming the writer correction as current', () => {
    const text = writerCorrectionContext([{
      id: 'c1', workId: 'w1', threadId: 't1', maiaTurnIndex: 3,
      kind: 'intent',
      priorClaim: 'This passage is mainly about grief.',
      correction: 'It is about relief; the grief language is deliberate misdirection.',
      createdAt: '2026-09-29T18:00:00.000Z',
    }]);
    expect(text).toContain('MAIA previously said: This passage is mainly about grief.');
    expect(text).toContain('Writer correction / current working understanding: It is about relief');
    expect(text).toContain('without rewriting the historical turn');
    expect(text).toContain('not as automatic manuscript facts or editing permission');
  });

  it('distinguishes the six beta correction kinds rather than collapsing them into feedback', () => {
    expect(WRITER_CORRECTION_KINDS).toEqual([
      'fact', 'intent', 'interpretation_rejection', 'intentional_ambiguity',
      'developmental_revision', 'preference',
    ]);
  });
});

describe('passage-conversation corrections (review of #2380)', () => {
  const PASSAGE_WORDING = 'The harbour lights went out one by one, and she counted them.';
  it('carries the writer\'s correction but never the wording of MAIA\'s passage reply', () => {
    const text = writerCorrectionContext([{
      id: 'c2', workId: 'w1', threadId: 't2', maiaTurnIndex: 1, kind: 'interpretation_rejection',
      priorClaim: null, correction: 'She counts because she is waiting, not grieving.',
      createdAt: '2026-11-23T10:00:00.000Z',
    }]);
    expect(text).toContain('a reading in a passage conversation (its wording is not carried here)');
    expect(text).toContain('Writer correction / current working understanding: She counts because she is waiting');
    expect(text).not.toContain(PASSAGE_WORDING);
    expect(text).not.toContain('MAIA previously said: null');
  });

  it('the reader withholds a passage thread\'s reply in SQL; only a whole-Work reply is selected', async () => {
    jest.resetModules();
    const query = jest.fn(async () => ({ rows: [] }));
    jest.doMock('@/lib/db/postgres', () => ({ query }));
    const { currentWriterCorrectionsForWork } = await import('../writerCorrectionsServer');
    await currentWriterCorrectionsForWork('member-1', 'work-1');
    const [sql, params] = (query.mock.calls[0] as unknown) as [string, unknown[]];
    expect(params).toEqual(['member-1', 'work-1']);
    expect(sql).toMatch(/CASE WHEN th\.proposal_chain_id IS NULL THEN t\.body ELSE NULL END AS prior_claim/);
    expect(sql).not.toMatch(/,\s*t\.body AS prior_claim/);
    jest.dontMock('@/lib/db/postgres');
  });
});
