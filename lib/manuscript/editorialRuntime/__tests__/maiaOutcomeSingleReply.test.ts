/**
 * Pre-review of #2380 (finding 4): a resend reuses a held writer turn, so two requests can be
 * thinking about ONE turn. The first MAIA reply to land is kept; the second is refused and
 * writes nothing. The thread row is locked so the check cannot race.
 */
type Row = { turn_index: number; speaker: 'author' | 'maia'; body: string };

let turns: Row[] = [];
const sqls: string[] = [];

const fakeTx = {
  query: jest.fn(async (sql: string, params: unknown[]) => {
    sqls.push(sql);
    if (sql.includes('SELECT proposal_chain_id')) return { rows: [{ proposal_chain_id: 'chain-1' }] };
    if (sql.includes("speaker = 'maia'") && sql.includes('count(*)')) {
      const after = params[1] as number;
      return { rows: [{ n: turns.filter((t) => t.turn_index > after && t.speaker === 'maia').length }] };
    }
    if (sql.includes('INSERT INTO ask_turns')) {
      const next = turns.length;
      turns.push({ turn_index: next, speaker: params[1] as Row['speaker'], body: params[2] as string });
      return { rows: [{ turn_index: next }] };
    }
    throw new Error('unexpected SQL: ' + sql.slice(0, 60));
  }),
};

jest.mock('@/lib/db/postgres', () => ({
  transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx),
}));
jest.mock('../../editorialWorkspace/store', () => ({ createMaiaDirectionWithExecutor: jest.fn() }));
jest.mock('../../proposalChain/store', () => ({ appendAuthoredVersionWithExecutor: jest.fn() }));

import { persistMaiaEditorialOutcome } from '../maiaOutcome';
import { KeepWitness } from '@/lib/sanctuary/studioPosture';

const keep = KeepWitness.fromDeclaration(false);
const invocation = { threadId: 't1', chainId: 'chain-1' } as never;
const reply = (text: string, answers: number | null = 2) => persistMaiaEditorialOutcome({
  memberId: 'm1', keep, invocation,
  outcome: { kind: 'reply_only', reply: text } as never,
  ...(answers === null ? {} : { answersMemberTurnIndex: answers }),
});

beforeEach(() => {
  turns = [
    { turn_index: 0, speaker: 'author', body: 'What is this paragraph doing?' },
    { turn_index: 1, speaker: 'maia', body: 'It turns twice.' },
    { turn_index: 2, speaker: 'author', body: 'Show me a lighter transition.' },
  ];
  sqls.length = 0;
});

test('the first reply to a writer turn is kept; a second reply to the same turn is refused and writes nothing', async () => {
  expect(await reply('First answer.')).toMatchObject({ ok: true, turnIndex: 3 });
  expect(await reply('Second answer to the same question.')).toEqual({ ok: false, reason: 'already_answered' });
  expect(turns.map((t) => t.body)).toEqual([
    'What is this paragraph doing?', 'It turns twice.', 'Show me a lighter transition.', 'First answer.',
  ]);
});

test('the thread row is locked before the check, so two replies cannot both pass it', async () => {
  await reply('First answer.');
  const lock = sqls.findIndex((s) => s.includes('SELECT proposal_chain_id') && /FOR NO KEY UPDATE/.test(s));
  const check = sqls.findIndex((s) => s.includes('count(*)'));
  expect(lock).toBeGreaterThanOrEqual(0);
  expect(check).toBeGreaterThan(lock);
});

test('earlier MAIA turns do not block the answer to a new writer turn', async () => {
  expect(await reply('An answer.', 2)).toMatchObject({ ok: true });
});

test('a MAIA-first opening (no writer turn) is not checked', async () => {
  turns = [];
  expect(await reply('Opening observation.', null)).toMatchObject({ ok: true, turnIndex: 0 });
  expect(sqls.some((s) => s.includes('count(*)'))).toBe(false);
});
