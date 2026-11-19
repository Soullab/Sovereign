/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { whatNextInWrite, WHAT_NEXT_LABEL, WHAT_NEXT_ASK_LABEL, type WriteScreen } from '../whatNext';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const VIEW = 'app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx';

/** The live sources the named controls are rendered from. whatNext.ts itself is excluded, so a label cannot pass by living only here. */
const LIVE_UI = [
  VIEW,
  'lib/writersStudio/inspirationOpening.ts',
  'app/writers-studio/full-redesign/types.ts',
].map(read).join('\n');

const BASE: WriteScreen = {
  pageEmpty: false, firstPage: false, chosenPlace: null, proseSwitchShown: true, proseView: true, isBook: true,
  talkWholeLabel: 'Talk about the whole Work',
};
const text = (s: Partial<WriteScreen>) => whatNextInWrite({ ...BASE, ...s }).say.join(' ');

const SCREENS: Partial<WriteScreen>[] = [
  { pageEmpty: true },
  { firstPage: true, isBook: false, proseSwitchShown: false },
  { chosenPlace: 'Chapter 2' },
  { proseView: true },
  { proseView: false },
  { proseSwitchShown: false, isBook: false },
];

describe('What do I do next?', () => {
  test('in Prose view she names Edit first, because selecting words there opens nothing', () => {
    expect(text({ proseView: true })).toMatch(/first press “Edit” at the top of the page/);
  });

  test('in Edit she does not send the writer to Edit again', () => {
    const t = text({ proseView: false });
    expect(t).not.toMatch(/press “Edit”/);
    expect(t).toMatch(/select the words .* “Talk with MAIA”/);
  });

  test('an empty page is told to write, not to call MAIA', () => {
    const t = text({ pageEmpty: true });
    expect(t).toMatch(/start writing/);
    expect(t).not.toMatch(/Develop/);
  });

  test('a first page names the real offer, and says she has not read it', () => {
    const t = text({ firstPage: true });
    expect(t).toContain('“Show MAIA this page”');
    expect(t).toContain('I won’t read it until you do.');
  });

  test('a chosen place is named back in the writer’s own label', () => {
    expect(text({ chosenPlace: 'The First Tap' })).toContain('You’ve chosen “The First Tap”');
  });

  test('Develop is offered only once the Work is a book', () => {
    expect(text({ isBook: true })).toMatch(/“Develop” in the top bar/);
    expect(text({ isBook: false })).not.toMatch(/Develop/);
  });

  test('a program Work’s own button name is used, never the default one', () => {
    const t = text({ pageEmpty: true, talkWholeLabel: 'Talk about my essay' });
    expect(t).toContain('“Talk about my essay”');
    expect(t).not.toContain('Talk about the whole Work');
  });

  test('every control she names is text the live Studio shows', () => {
    for (const s of SCREENS) {
      const labels = [...text(s).matchAll(/“([^”]+)”/g)].map((m) => m[1]).filter((l) => l !== s.chosenPlace);
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) expect(LIVE_UI).toContain(label);
    }
  });

  test('member-facing wording says Work, not book (review F4, 2026-11-15)', () => {
    for (const s of SCREENS) expect(text(s)).not.toMatch(/\bbook\b/i);
  });

  test('the answer claims nothing she has not done', () => {
    for (const s of SCREENS) expect(text(s)).not.toMatch(/I(’ve| have) (read|sent|saved)|I’ll start/);
  });

  test('the module cannot send, store or read the manuscript', () => {
    const src = read('lib/writersStudio/whatNext.ts');
    expect(src).not.toMatch(/^import /m);
    expect(src).not.toMatch(/fetch\(|apiFetch|localStorage|sessionStorage|bodyOf/);
  });

  test('the column shows the button, and "Ask MAIA about this" only places the question', () => {
    const view = read(VIEW);
    expect(WHAT_NEXT_LABEL).toBe('What do I do next?');
    expect(view).toContain('{WHAT_NEXT_LABEL}');
    expect(view).toContain('{WHAT_NEXT_ASK_LABEL}');
    expect(view).toMatch(/setWhatNextOpen\(false\); openWorkConversation\(whatNext\.ask\)/);
    // The question goes into the composer as a starter; WorkConversation never sends a starter by itself.
    expect(read('app/writers-studio/canvas/WorkConversation.tsx')).toContain('Never auto-sent.');
    expect(WHAT_NEXT_ASK_LABEL).toBe('Ask MAIA about this');
  });
});
