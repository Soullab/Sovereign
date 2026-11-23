/** @jest-environment node */
/**
 * Founder ruling 2026-11-23, aligning with the 2026-11-08 single-Work review: a correction made
 * in a PASSAGE conversation is kept on the Work the passage room reads (the earliest
 * declaration), not on whichever Work the writer has open. Whole-Work corrections are unchanged.
 */
const query = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...a: unknown[]) => query(...a) }));
jest.mock('@/lib/auth/getMemberFromRequest', () => ({ getMemberIdFromRequest: async () => 'm1' }));
jest.mock('@/lib/sanctuary/keepGate', () => ({ keepGate: async () => null }));
const resolve = jest.fn();
jest.mock('@/lib/manuscript/ask/workOfManuscript', () => ({
  livingWorkIdForManuscript: (...a: unknown[]) => resolve(...a),
}));

import { POST } from '../route';

let inserted: unknown[] | null = null;
function db(thread: { proposal_chain_id: string | null }) {
  query.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.startsWith('SELECT 1 FROM living_works')) return { rows: [{}] };
    if (sql.includes('FROM ask_threads th')) {
      return { rows: [{ living_work_id: null, manuscript_id: 'ms1', proposal_chain_id: thread.proposal_chain_id, speaker: 'maia', body: 'MAIA said.' }] };
    }
    if (sql.includes('FROM living_work_expressions')) return { rows: [{}] };
    if (sql.startsWith('SELECT title FROM living_works')) return { rows: [{ title: params[0] === 'work-first' ? 'The Island' : 'Essays' }] };
    if (sql.includes('INSERT INTO writer_studio_corrections')) {
      inserted = params;
      return { rows: [{ id: 'c1', created_at: '2026-11-23T12:00:00Z' }] };
    }
    throw new Error('unexpected SQL ' + sql.slice(0, 50));
  });
}
const post = (workId: string) => POST(
  new Request('http://x', { method: 'POST', body: JSON.stringify({ threadId: 't1', maiaTurnIndex: 1, kind: 'intent', correction: 'I meant relief.' }) }) as never,
  { params: Promise.resolve({ id: workId }) },
);

beforeEach(() => { query.mockReset(); resolve.mockReset(); inserted = null; });

test('a passage correction made in a second Work is kept on the Work the passage room reads, and the response says which', async () => {
  db({ proposal_chain_id: 'chain-1' });
  resolve.mockResolvedValue('work-first');
  const res = await post('work-second');
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(resolve).toHaveBeenCalledWith('ms1', 'm1');
  expect(inserted?.[1]).toBe('work-first');
  expect(body.keptOn).toEqual({ workId: 'work-first', title: 'The Island' });
  expect(body.correction.workId).toBe('work-first');
});

test('a whole-Work conversation\'s correction stays on the Work it was made in', async () => {
  db({ proposal_chain_id: null });
  const res = await post('work-second');
  expect(resolve).not.toHaveBeenCalled();
  expect(inserted?.[1]).toBe('work-second');
  expect((await res.json()).keptOn.workId).toBe('work-second');
});
