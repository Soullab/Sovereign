/**
 * Keep my words claims placement only when the page holds the words (pre-review of #2383).
 */
import { placeWordsOnSection, type KeepWordsWriting } from '../keepWords';

const WORDS = 'Quiet rather than sad.\nNobody asked why.';

function page(opts: { body?: string; editable?: boolean; status?: string; unsaved?: boolean } = {}) {
  const bodies = new Map<string, string>([['s1', opts.body ?? '']]);
  const writing: KeepWordsWriting & { edits: number } = {
    edits: 0,
    hasUnsavedWork: () => opts.unsaved === true,
    statusOf: () => opts.status ?? 'saved',
    bodyOf: (id) => bodies.get(id) ?? '',
    editSection: (id, body) => { writing.edits += 1; if (opts.editable !== false) bodies.set(id, body); },
  };
  return writing;
}

test('placed after the existing text, after a blank line, exactly as written', () => {
  const w = page({ body: 'First paragraph.\n' });
  expect(placeWordsOnSection(w, 's1', WORDS)).toBe(true);
  expect(w.bodyOf('s1')).toBe(`First paragraph.\n\n${WORDS}`);
});

test('an empty page takes the words alone', () => {
  const w = page();
  expect(placeWordsOnSection(w, 's1', WORDS)).toBe(true);
  expect(w.bodyOf('s1')).toBe(WORDS);
});

test('a read-only section: the write does nothing, so nothing is claimed', () => {
  const w = page({ body: 'Locked.', editable: false });
  expect(placeWordsOnSection(w, 's1', WORDS)).toBe(false);
  expect(w.bodyOf('s1')).toBe('Locked.');
});

test.each(['dirty', 'saving', 'conflict', 'error'])('refused as "saving" while the section is %s, and nothing is written', (status) => {
  const w = page({ body: 'x', status });
  expect(placeWordsOnSection(w, 's1', WORDS)).toBe('saving');
  expect(w.edits).toBe(0);
});

test('refused as "saving" while other typing is unsaved', () => {
  const w = page({ unsaved: true });
  expect(placeWordsOnSection(w, 's1', WORDS)).toBe('saving');
  expect(w.edits).toBe(0);
});

test('no section, no page, or no words: not placed', () => {
  expect(placeWordsOnSection(page(), null, WORDS)).toBe(false);
  expect(placeWordsOnSection(null, 's1', WORDS)).toBe(false);
  expect(placeWordsOnSection(page(), 's1', '   ')).toBe(false);
});
