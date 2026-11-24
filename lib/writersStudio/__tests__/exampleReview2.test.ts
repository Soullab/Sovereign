/**
 * Two Low findings of the Class A review of #2402 (recorded on #1800, 2026-11-24); founder: "Yes, fix both".
 *   Low 1: the example marker matched only the exact line, so "**An example, not your words:**" and similar variants
 *          got through the "not allowed" check in code.        → matched ignoring case, formatting and punctuation.
 *   Low 2: #2402 cut the carried reply to 4000 characters, below what a Work reply can be, so a long Deeper example
 *          offered "Try this on my page" and then failed.       → 16,000, and the button only within it (see the
 *          conversation test workConversationExampleLength).
 * A rewrite with NO marker at all is still bound only by MAIA's instructions; nothing here claims otherwise.
 */
jest.mock('../../ai/structured/router', () => ({ runStructured: jest.fn() }));
jest.mock('@/lib/writersStudio/workSituation', () => ({ formatWorkSituationForPrompt: () => 'THE WORK ON THE TABLE (fixture)' }));
const query = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...a: unknown[]) => query(...a) }));

import { runStructured } from '../../ai/structured/router';
import { askMaia, type AskContext } from '@/lib/manuscript/ask/askReader';
import { UNMEASURED } from '@/lib/manuscript/ask/staleness';
import { workQuestionsOnlyInstruction, workExampleWordingInstruction } from '@/lib/manuscript/editorialRuntime/workRevisionPause';
import { EXAMPLE_NOT_ALLOWED_ANSWER, WORK_EXAMPLE_LINE, containsExample } from '../exampleLevel';
import { EXAMPLE_REPLY_MAX } from '../exampleOrigin';
import { resolveExampleOrigin } from '../exampleOriginServer';

const mockRun = runStructured as jest.MockedFunction<typeof runStructured>;
beforeEach(() => { query.mockReset(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

const VARIANTS = [
  '**An example, not your words:**',
  '_An example, not your words:_',
  '> An example, not your words:',
  '### An example, not your words',
  'AN EXAMPLE — NOT YOUR WORDS:',
  'An example,  not   your words: The creek ran dark before sunrise.',
  'Ａｎ ｅｘａｍｐｌｅ, ｎｏｔ ｙｏｕｒ ｗｏｒｄｓ:',   // fullwidth lookalikes
];

describe('Low 1: the marker is recognised in its common variants', () => {
  test.each(VARIANTS)('%s', (line) => {
    expect(containsExample(`It could breathe more.\n${line}\nHe lost on purpose, every time.`)).toBe(true);
  });
  test('the exact line still counts', () => {
    expect(containsExample(`x\n${WORK_EXAMPLE_LINE}\ny`)).toBe(true);
  });
  test.each([
    'Here is an example of what I mean.',
    'These are not your words yet.',
    `She wrote "${WORK_EXAMPLE_LINE}" once.`,
    'An example from another book might help.',
    'An examples, not your words:',
  ])('negative: %s is not a marker', (line) => {
    expect(containsExample(`Something.\n${line}\nMore.`)).toBe(false);
  });

  test('a bold marker in a questions-only Work is not shown; with the allowance it is', async () => {
    const reply = `It could breathe more.\n**An example, not your words:**\nHe lost on purpose, every time.`;
    const run = async (instructions: string[]) => {
      mockRun.mockReset();
      mockRun.mockResolvedValue({ ok: true, result: { content: [{ type: 'text', text: reply }] as never, stopReason: 'end_turn',
        usage: { inputTokens: 1, outputTokens: 1 }, provenance: { provider: 'anthropic', model: 'm', latencyMs: 1 } } } as never);
      const out = await askMaia({
        kind: 'work', anchor: { on: 'work' }, staleness: UNMEASURED, sanctuary: false,
        facts: { work: {} as never, manuscript: { id: 'ms-1', draftId: 'd-1', version: 1 }, sections: [{ id: 'sec-a', position: 1, heading: null }],
          locus: { sectionId: 'sec-a', label: 'Your draft', body: 'He kept losing on purpose.' },
          writerUnderstanding: '', writerCorrections: '', continuity: { structure: 'unmeasured', prose: 'unmeasured' } },
        programInstructions: instructions,
      } as AskContext, [], 'Can you make this sound better?');
      if (!out.ok) throw new Error('expected an answer');
      return out.answer;
    };
    expect(await run([workQuestionsOnlyInstruction()])).toBe(EXAMPLE_NOT_ALLOWED_ANSWER);
    expect(await run([workExampleWordingInstruction()])).toBe(reply);
  });
});

describe('Low 2: a long example can still be tried on the page', () => {
  const resolve = (body: string) => {
    query.mockResolvedValueOnce({ rows: [{ manuscript_id: 'ms-1' }] }).mockResolvedValueOnce({ rows: [{ body }] });
    return resolveExampleOrigin({ memberId: 'm1', threadId: 'ed-1',
      ref: { askThreadId: '00000000-0000-4000-8000-000000000001', turnIndex: 1 } });
  };
  test('a 6000-character Deeper example (worked before #2402, failed after it) resolves again', async () => {
    const body = `${WORK_EXAMPLE_LINE}\n${'The creek ran dark. '.repeat(300)}`;
    expect(body.length).toBeGreaterThan(4000);
    expect(await resolve(body)).toBe(body);
  });
  test('negative: past the limit it is still refused', async () => {
    expect(await resolve(`${WORK_EXAMPLE_LINE}\n${'x'.repeat(EXAMPLE_REPLY_MAX)}`)).toBeNull();
  });
  test('the limit covers a full Work reply in practice', () => {
    expect(EXAMPLE_REPLY_MAX).toBe(16_000);
  });
});
