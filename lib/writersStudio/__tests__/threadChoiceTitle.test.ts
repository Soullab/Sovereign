/**
 * Founder 2026-11-24, looking at seven conversations listed only as "11/24/2026 · 2 TURNS": "This information is relatively
 * useless … Better to give the conversations titles and context." The title is the writer's OWN first words in the conversation
 * (never a summary MAIA or the Studio wrote about them); the context is when it was last used and how long it is.
 * Walked on the local harness (fictional Rosa): seven conversations now read by their opening question.
 */
import fs from 'node:fs';
import path from 'node:path';
import { threadChoiceTitle, threadChoiceContext, threadChoiceLabel, THREAD_TITLE_MAX } from '../observationDialogueResume';

const when = (iso: string) => iso.slice(0, 10);

describe('a conversation offered by its title and context', () => {
  test('the title is the writer\'s own first words, on one line', () => {
    expect(threadChoiceTitle({ opening: 'Can you make this\n  sound more like a book?' })).toBe('Can you make this sound more like a book?');
  });

  test('a long opening is clipped, never rewritten', () => {
    const said = 'When I was nine my grandmother sent me out before sunrise to sit with the creek and listen for a while.';
    const t = threadChoiceTitle({ opening: said })!;
    expect(t.length).toBeLessThanOrEqual(THREAD_TITLE_MAX);
    expect(t.endsWith('…')).toBe(true);
    expect(said.startsWith(t.slice(0, -1))).toBe(true);
  });

  test('negative: with nothing of the writer\'s to show there is no title, and nothing is made up', () => {
    expect(threadChoiceTitle({ opening: null })).toBeNull();
    expect(threadChoiceTitle({ opening: '   ' })).toBeNull();
    expect(threadChoiceTitle({})).toBeNull();
  });

  test('the context says when it was last used; without that it falls back to the old label', () => {
    const base = { id: 'x', openedAt: '2026-11-23T10:00:00Z', turnCount: 4 };
    expect(threadChoiceContext({ ...base, lastAt: '2026-11-24T09:00:00Z' }, when)).toBe('Last used 2026-11-24 · 4 turns');
    expect(threadChoiceContext({ ...base, turnCount: 1, lastAt: '2026-11-24T09:00:00Z' }, when)).toBe('Last used 2026-11-24 · 1 turn');
    expect(threadChoiceContext(base, when)).toBe(threadChoiceLabel(base, when));
  });
});

describe('where the title comes from', () => {
  const store = fs.readFileSync(path.join(process.cwd(), 'lib/manuscript/ask/threadStore.ts'), 'utf8');
  test('both listings take the first AUTHOR turn of the same thread, clipped, and the last turn time', () => {
    const picks = store.match(/SELECT left\(a\.body, 160\) FROM ask_turns a\s+WHERE a\.thread_id = t\.id AND a\.speaker = 'author'\s+ORDER BY a\.turn_index LIMIT 1\) AS opening/g);
    expect(picks?.length).toBe(2);
    expect(store.match(/MAX\(u\.created_at\) AS last_at/g)?.length).toBe(2);
  });
  test('negative: still member-scoped, still read-only, still newest-opened first (presentation order only)', () => {
    expect(store).toContain('WHERE t.manuscript_id = $1 AND t.member_id = $2 AND t.anchor = $3::jsonb');
    expect(store).toContain('AND t.member_id = $2');
    expect(store.match(/ORDER BY t\.opened_at DESC/g)?.length).toBeGreaterThanOrEqual(2);
  });
  test('the Work conversation shows the title and the context, and no thread id', () => {
    const ui = fs.readFileSync(path.join(process.cwd(), 'app/writers-studio/canvas/WorkConversation.tsx'), 'utf8');
    expect(ui).toContain('{threadChoiceTitle(t)}');
    expect(ui).toContain('{threadChoiceContext(t, when)}');
    expect(ui).not.toContain('{t.id}</');
  });
});
