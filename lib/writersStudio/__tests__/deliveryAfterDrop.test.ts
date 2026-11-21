import { deliveryAfterDrop } from '../deliveryAfterDrop';
import type { AskThreadView } from '../askClient';

const turn = (index: number, speaker: 'author' | 'maia', body: string) => ({ index, speaker, body, staleness: 'current' }) as AskThreadView['turns'][number];
const thread = (turns: AskThreadView['turns']) => ({ id: 't', anchor: { on: 'work' }, openedAt: '2026-11-21', turns }) as unknown as AskThreadView;
const before = [turn(0, 'author', 'Earlier question'), turn(1, 'maia', 'Earlier answer')];

describe('WS-F1 · what a dropped connection may say', () => {
  it('arrived: the server kept a new writer turn with exactly this question (and her answer)', () => {
    const after = thread([...before, turn(2, 'author', 'Across the whole book?'), turn(3, 'maia', 'An answer')]);
    expect(deliveryAfterDrop(2, after, '  Across the whole book?  ')).toBe('arrived');
  });
  it('not_arrived: only when the server was re-read and nothing was added', () => {
    expect(deliveryAfterDrop(2, thread(before), 'Across the whole book?')).toBe('not_arrived');
  });
  it('⭐ MUST FAIL IF a failed re-read is ever reported as "did not reach her"', () => {
    expect(deliveryAfterDrop(2, null, 'Across the whole book?')).toBe('unknown');
  });
  it('⭐ MUST FAIL IF a longer thread alone is taken as delivery (another tab, another question)', () => {
    const after = thread([...before, turn(2, 'author', 'A different question'), turn(3, 'maia', 'x')]);
    expect(deliveryAfterDrop(2, after, 'Across the whole book?')).toBe('unknown');
  });
  it('an earlier identical question does not count as this one arriving', () => {
    const same = [turn(0, 'author', 'Again?'), turn(1, 'maia', 'a')];
    expect(deliveryAfterDrop(2, thread([...same, turn(2, 'maia', 'stray')]), 'Again?')).toBe('unknown');
  });
});
