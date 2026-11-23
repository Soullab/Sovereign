/** Pre-review of #2380: "reads this now" is said only when the passage is found exactly once. */
jest.mock('@/lib/db/postgres', () => ({ query: jest.fn(), transaction: jest.fn() }));
import { passageReadsNow } from '../assembly';

test('found once: yes', () => {
  expect(passageReadsNow('Before. The lights went out. After.', 'The lights went out.')).toBe(true);
});
test('not found: no', () => {
  expect(passageReadsNow('Before. The lights dimmed. After.', 'The lights went out.')).toBe(false);
});
test('empty passage: unknown, never yes', () => {
  expect(passageReadsNow('Anything at all.', '')).toBeUndefined();
});
test('a second copy elsewhere: unknown, so a duplicate cannot stand in for an edited passage', () => {
  expect(passageReadsNow('The lights went out. Later: The lights went out.', 'The lights went out.')).toBeUndefined();
});
