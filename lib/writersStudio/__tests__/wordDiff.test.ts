/** The Revision Mirror's comparison: exact differences between the writer's own versions; never a suggestion. */
import { wordDiff, MAX_DIFF_CELLS } from '../wordDiff';

test('unchanged text is all "same"', () => {
  expect(wordDiff('I was the older one.', 'I was the older one.')).toEqual([{ kind: 'same', text: 'I was the older one.' }]);
});
test('a word changed is shown as only-earlier and only-current, in place', () => {
  expect(wordDiff('I was supposed to be brave.', 'I was supposed to be the brave one.')).toEqual([
    { kind: 'same', text: 'I was supposed to be' },
    { kind: 'earlier', text: 'brave.' },
    { kind: 'current', text: 'the brave one.' },
  ]);
});
test('added and removed sentences', () => {
  expect(wordDiff('A. B.', 'A. B. That night, he was.')).toEqual([{ kind: 'same', text: 'A. B.' }, { kind: 'current', text: 'That night, he was.' }]);
  expect(wordDiff('A. Extra words. B.', 'A. B.')).toEqual([{ kind: 'same', text: 'A.' }, { kind: 'earlier', text: 'Extra words.' }, { kind: 'same', text: 'B.' }]);
});
test('it only ever contains the writer’s own words: every part comes from one of the two versions', () => {
  const a = 'The fridge stopped humming and the house got quiet.';
  const b = 'The fridge went silent and the whole house got quiet.';
  for (const p of wordDiff(a, b)!) {
    for (const w of p.text.split(' ')) expect(p.kind === 'current' ? b.split(' ') : p.kind === 'earlier' ? a.split(' ') : a.split(' ')).toContain(w);
  }
});
test('too long to compare: says so (null) rather than freezing a phone', () => {
  const big = 'w '.repeat(Math.ceil(Math.sqrt(MAX_DIFF_CELLS)) + 10);
  expect(wordDiff(big, big)).toBeNull();
});
