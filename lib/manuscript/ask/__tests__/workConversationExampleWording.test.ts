/**
 * Founder ruling 2026-11-24 ("Yes, as examples"), from the storyteller-elder walk (fictional composite): in the Work
 * conversation MAIA may show an asked-for example of a change, never placed, with what it gains and costs.
 * ⛔ These prove WHO gets the allowance and that it reaches the prompt and its provenance — not that MAIA follows it
 * (that is the walk).
 */
jest.mock('../../../ai/structured/router', () => ({ runStructured: jest.fn() }));
jest.mock('@/lib/writersStudio/workSituation', () => ({ formatWorkSituationForPrompt: () => 'THE WORK ON THE TABLE (fixture)' }));
jest.mock('@/lib/db/postgres', () => ({ query: jest.fn() }));

import fs from 'node:fs';
import path from 'node:path';
import { runStructured } from '../../../ai/structured/router';
import { askMaia, type AskContext } from '../askReader';
import { UNMEASURED } from '../staleness';
import { checkQuoteFidelity } from '../quoteFidelity';
import {
  conversationProgramInstructions, workExampleWordingInstruction, workQuestionsOnlyInstruction, WORK_EXAMPLE_LINE,
} from '../../editorialRuntime/workRevisionPause';
import { studioPathById } from '@/lib/writersStudio/studioPaths';

const mockRun = runStructured as jest.MockedFunction<typeof runStructured>;
const postureOf = (id: string) => studioPathById(id)?.studioPosture ?? null;
const EXAMPLE = workExampleWordingInstruction();

describe('who MAIA may show an example to', () => {
  test('an ordinary Work, not set to questions-only: yes', () => {
    expect(conversationProgramInstructions({ questionsOnly: false, program: { kind: 'none' } }, postureOf)).toEqual([EXAMPLE]);
  });

  test('a Work set to "MAIA asks, never rewrites": no — the writer\'s own rule wins', () => {
    const out = conversationProgramInstructions({ questionsOnly: true, program: { kind: 'none' } }, postureOf);
    expect(out).toEqual([workQuestionsOnlyInstruction()]);
    expect(out).not.toContain(EXAMPLE);
  });

  test('a college essay, even unpaused: no — the ruling was not made for programs', () => {
    expect(conversationProgramInstructions({ questionsOnly: false, program: { kind: 'one', id: 'college-essay' } }, postureOf))
      .not.toContain(EXAMPLE);
  });

  test('a program that is ambiguous or unreadable: no (fail closed)', () => {
    for (const kind of ['ambiguous', 'unknown'] as const) {
      expect(conversationProgramInstructions({ questionsOnly: false, program: { kind } }, postureOf)).not.toContain(EXAMPLE);
    }
  });
});

describe('it keeps to the level the writer selected (founder 2026-11-24)', () => {
  test('the writer\'s Revision latitude is named, and MAIA is told never to go beyond it', () => {
    const touch = workExampleWordingInstruction(1);
    expect(touch).toContain('HOW MUCH AN EXAMPLE MAY CHANGE THEIR WORDS: Touch. Punctuation, a word, a small phrase.');
    expect(touch).toMatch(/Keep every example within Touch/);
    expect(touch).toMatch(/Never go beyond their choice on your own/);
    expect(workExampleWordingInstruction(5)).toContain('HOW MUCH AN EXAMPLE MAY CHANGE THEIR WORDS: Open.');
  });

  test('absent or invalid is the smallest, never a guess', () => {
    expect(workExampleWordingInstruction()).toBe(workExampleWordingInstruction(1));
    expect(workExampleWordingInstruction(9 as never)).toBe(workExampleWordingInstruction(1));
    expect(conversationProgramInstructions({ questionsOnly: false, program: { kind: 'none' } }, postureOf)).toEqual([workExampleWordingInstruction(1)]);
  });

  test('the selected level travels to the instruction, and never reaches a Work without examples', () => {
    expect(conversationProgramInstructions({ questionsOnly: false, program: { kind: 'none' } }, postureOf, undefined, 4))
      .toEqual([workExampleWordingInstruction(4)]);
    expect(conversationProgramInstructions({ questionsOnly: true, program: { kind: 'none' } }, postureOf, undefined, 5))
      .toEqual([workQuestionsOnlyInstruction()]);
  });

  test('both conversation routes refuse an invalid level and pass the selected one through', () => {
    for (const route of ['app/api/sovereign/manuscripts/[id]/ask/route.ts', 'app/api/sovereign/living-works/[id]/ask/route.ts']) {
      const src = fs.readFileSync(path.join(process.cwd(), route), 'utf8');
      expect(src).toMatch(/isEditorialLatitude\(body\.exampleLatitude\)/);
      expect(src).toMatch(/detail: 'exampleLatitude' \}, \{ status: 400 \}/);
      expect(src).toMatch(/conversationProgramInstructions\([\s\S]{0,600}?exampleLatitude,\s*\)/);
    }
  });
});

describe('what the allowance says', () => {
  test('only when asked, set off by a fixed line, never in quotation marks, never placed, with its cost', () => {
    expect(EXAMPLE).toMatch(/Only when they ask: never volunteer one\./);
    expect(EXAMPLE).toContain(`after a line that reads exactly: ${WORK_EXAMPLE_LINE}`);
    expect(EXAMPLE).toMatch(/Never put example wording in quotation marks/);
    expect(EXAMPLE).toMatch(/onto their page only if they put it there themselves/);
    expect(EXAMPLE).toMatch(/what it gains and what it costs/);
    // Walk 2026-11-24: at Line she turned "When I was nine" into "The summer I was nine" and said it added nothing.
    expect(EXAMPLE).toMatch(/Never add a fact the writer has not given you/);
  });

  test('why no quotation marks: the quote guard refuses an invented span in them, and passes it set off by the line', () => {
    const page = 'I sat there till my feet went numb. That is the first teaching, and I still have not finished it.';
    const example = 'I sat by the cold water until I could no longer feel my feet.';
    expect(checkQuoteFidelity(`${WORK_EXAMPLE_LINE}\n${example}\nIt gains the cold; it costs the plainness.`, [page]).ok).toBe(true);
    expect(checkQuoteFidelity(`Something like "${example}"`, [page]).ok).toBe(false);
  });
});

describe('it reaches MAIA last and is named in provenance', () => {
  function ctx(programInstructions?: string[]): AskContext {
    return {
      kind: 'work', anchor: { on: 'work' }, staleness: UNMEASURED, sanctuary: false,
      facts: {
        work: {} as never, manuscript: { id: 'ms-1', draftId: 'd-1', version: 1 },
        sections: [{ id: 'sec-a', position: 1, heading: null }],
        locus: { sectionId: 'sec-a', label: 'Your draft', body: 'I sat there till my feet went numb.' },
        writerUnderstanding: '', writerCorrections: '', continuity: { structure: 'unmeasured', prose: 'unmeasured' },
      },
      ...(programInstructions ? { programInstructions } : {}),
    } as AskContext;
  }
  async function run(c: AskContext) {
    mockRun.mockReset();
    mockRun.mockResolvedValue({ ok: true, result: { content: [{ type: 'text', text: 'A reply.' }] as never, stopReason: 'end_turn',
      usage: { inputTokens: 1, outputTokens: 1 }, provenance: { provider: 'anthropic', model: 'm', latencyMs: 1 } } } as never);
    const out = await askMaia(c, [], 'Can you make this sound more like a book?');
    expect(out.ok).toBe(true);
    return { system: mockRun.mock.calls[0]![0].system as string, hash: out.ok ? out.provenance.promptHash : null };
  }

  test('present in the system prompt after the Studio guide, and the prompt hash differs from a Work without it', async () => {
    const withIt = await run(ctx([EXAMPLE]));
    const without = await run(ctx());
    expect(withIt.system).toContain(WORK_EXAMPLE_LINE);
    expect(withIt.system.indexOf('WHEN THEY ASK TO SEE A CHANGE')).toBeGreaterThan(withIt.system.indexOf('HOW YOU GUIDE'));
    expect(without.system).not.toContain(WORK_EXAMPLE_LINE);
    expect(withIt.hash).not.toBe(without.hash);
  });
});
