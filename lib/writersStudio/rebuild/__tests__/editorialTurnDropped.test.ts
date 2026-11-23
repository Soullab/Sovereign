/**
 * P0-A (#1800): on the passage path, a dropped connection is labelled as such, so the
 * Studio re-reads the conversation before telling the writer anything (WS-F1).
 */
const apiFetch = jest.fn();
jest.mock('@/lib/http/apiBase', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { sendBoundEditorialTurn, TRANSPORT_DROPPED } from '../editorialCollaboration';
import { deliveryAfterDrop } from '@/lib/writersStudio/deliveryAfterDrop';

const posture = { resolved: true, sanctuary: false } as any;
const send = () => sendBoundEditorialTurn('t1', 's1', 'Show me a lighter transition.', posture, undefined, { relationshipId: 'r1' });

beforeEach(() => apiFetch.mockReset());

test('a thrown request is reported as a dropped connection, not as a verdict', async () => {
  apiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(send()).resolves.toEqual({ ok: false, reason: 'unavailable', detail: TRANSPORT_DROPPED });
});

test('a server 404 is a real answer and is never labelled as a dropped connection', async () => {
  apiFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'thread_not_found' }) });
  const r = await send();
  expect(r.ok).toBe(false);
  expect((r as { detail?: string }).detail).not.toBe(TRANSPORT_DROPPED);
});

describe('judging a passage conversation after a drop', () => {
  const before = [
    { speaker: 'author' as const, body: 'What is this paragraph doing?' },
    { speaker: 'maia' as const, body: 'It turns twice.' },
  ];
  const asked = 'Show me a lighter transition.';

  test('answered: her reply is already there', () => {
    expect(deliveryAfterDrop(2, { turns: [...before, { speaker: 'author', body: asked }, { speaker: 'maia', body: 'Here is one.' }] }, asked))
      .toBe('answered');
  });
  test('held: the words arrived and no reply exists yet', () => {
    expect(deliveryAfterDrop(2, { turns: [...before, { speaker: 'author', body: asked }] }, asked)).toBe('held');
  });
  test('nothing visible yet is never proof it did not arrive', () => {
    expect(deliveryAfterDrop(2, { turns: before }, asked)).toBe('not_arrived');
  });
  test('no re-read at all is unknown', () => {
    expect(deliveryAfterDrop(2, null, asked)).toBe('unknown');
  });
});
