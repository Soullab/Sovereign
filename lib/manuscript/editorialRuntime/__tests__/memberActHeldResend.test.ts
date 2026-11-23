/**
 * P0-A (#1800): after a dropped connection, re-sending the same words on a passage
 * conversation reuses the writer's unanswered turn instead of recording it twice.
 */
type Row = { turn_index: number; speaker: 'author' | 'maia'; body: string };

let turns: Row[] = [];
const inserts: string[] = [];

const fakeTx = {
  query: jest.fn(async (sql: string, params: unknown[]) => {
    if (sql.includes('SELECT proposal_chain_id')) return { rows: [{ proposal_chain_id: 'chain-1' }] };
    if (sql.includes('SELECT turn_index, speaker, body')) {
      return { rows: turns.length ? [turns[turns.length - 1]] : [] };
    }
    if (sql.includes('INSERT INTO ask_turns')) {
      const next = turns.length;
      turns.push({ turn_index: next, speaker: params[1] as Row['speaker'], body: params[2] as string });
      inserts.push(params[2] as string);
      return { rows: [{ turn_index: next }] };
    }
    if (sql.includes('INSERT INTO editorial_turn_bindings')) return { rows: [] };
    throw new Error('unexpected SQL: ' + sql.slice(0, 60));
  }),
};

jest.mock('@/lib/db/postgres', () => ({
  transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx),
}));
jest.mock('../../editorialWorkspace/store', () => ({
  createMemberDirectionWithExecutor: jest.fn(async () => ({ ok: true, direction: { id: 'dir-1' } })),
}));

import { persistMemberEditorialAct } from '../memberAct';
import { KeepWitness } from '@/lib/sanctuary/studioPosture';

const keep = KeepWitness.fromDeclaration(false);
const discourse = (text: string) => ({ act: 'discourse' as const, text, refersTo: null });
const send = (text: string, k: KeepWitness | null = keep) =>
  persistMemberEditorialAct({ memberId: 'm1', threadId: 't1', act: discourse(text), keep: k });

beforeEach(() => {
  turns = [
    { turn_index: 0, speaker: 'author', body: 'What is this paragraph doing?' },
    { turn_index: 1, speaker: 'maia', body: 'It turns twice.' },
  ];
  inserts.length = 0;
});

test('a resend of the unanswered question reuses its turn and records nothing new', async () => {
  const first = await send('Show me a lighter transition.');
  expect(first).toMatchObject({ ok: true, turnIndex: 2 });
  // The connection drops before MAIA answers; the writer sends the same words again.
  const resend = await send('Show me a lighter transition.');
  expect(resend).toMatchObject({ ok: true, turnIndex: 2 });
  expect(inserts).toEqual(['Show me a lighter transition.']);
  expect(turns).toHaveLength(3);
});

test('reworded text is a new turn', async () => {
  await send('Show me a lighter transition.');
  const reworded = await send('Show me a lighter transition, please.');
  expect(reworded).toMatchObject({ ok: true, turnIndex: 3 });
  expect(inserts).toHaveLength(2);
});

test('asking the same thing again after MAIA answered is a new turn', async () => {
  const again = await send('What is this paragraph doing?');
  expect(again).toMatchObject({ ok: true, turnIndex: 2 });
  expect(inserts).toEqual(['What is this paragraph doing?']);
});

test('a resend without a keep witness is refused, never a way around Sanctuary', async () => {
  await send('Show me a lighter transition.');
  await expect(send('Show me a lighter transition.', null)).rejects.toThrow();
  expect(inserts).toHaveLength(1);
});

test('a declared Direction is never folded into an earlier turn', async () => {
  await send('Keep the ending open.');
  const dir = await persistMemberEditorialAct({
    memberId: 'm1', threadId: 't1', keep,
    act: { act: 'direction' as const, text: 'Keep the ending open.', refersTo: null },
  });
  expect(dir).toMatchObject({ ok: true, turnIndex: 3 });
  expect(inserts).toHaveLength(2);
});
