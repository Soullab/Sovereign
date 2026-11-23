/**
 * Newcomer walk 2026-11-23: the "Help me find a beginning" instruction reaches MAIA as hers
 * (system prompt), not as the writer's words, and provenance names it.
 */
jest.mock('../../../ai/structured/router', () => ({ runStructured: jest.fn() }));
jest.mock('@/lib/writersStudio/workSituation', () => ({
  formatWorkSituationForPrompt: () => 'THE WORK ON THE TABLE (fixture)',
}));

import { runStructured } from '../../../ai/structured/router';
import { askMaia, type AskContext } from '../askReader';
import { UNMEASURED } from '../staleness';
import { BEGINNING_WORDS, beginningTurnInstruction } from '@/lib/writersStudio/beginningTurn';

const mockRun = runStructured as jest.MockedFunction<typeof runStructured>;

function ctx(intent: boolean): AskContext {
  return {
    kind: 'work', anchor: { on: 'work' }, staleness: UNMEASURED, sanctuary: false,
    ...(intent ? { studioIntent: 'find-a-beginning' as const } : {}),
    facts: {
      work: {} as never, manuscript: { id: 'ms-1', draftId: 'd-1', version: 1 },
      sections: [{ id: 'sec-a', position: 1, heading: 'One' }],
      locus: { sectionId: 'sec-a', label: 'One', body: '' },
      writerUnderstanding: '', writerCorrections: '', continuity: { structure: 'unmeasured', prose: 'unmeasured' },
    },
  } as AskContext;
}

async function run(c: AskContext) {
  mockRun.mockReset();
  mockRun.mockResolvedValue({
    ok: true,
    result: { content: [{ type: 'text', text: 'What would you most like someone to understand?' }] as never, stopReason: 'end_turn',
      usage: { inputTokens: 1, outputTokens: 1 }, provenance: { provider: 'anthropic', model: 'm', latencyMs: 1 } },
  } as never);
  const out = await askMaia(c, [], BEGINNING_WORDS);
  expect(out.ok).toBe(true);
  const call = mockRun.mock.calls[0]![0] as { system: string; messages?: { content: unknown }[] };
  return { system: call.system, request: JSON.stringify(call.messages ?? call), hash: out.ok ? out.provenance.promptHash : null };
}

test('the instruction is in MAIA\'s system prompt, and the writer\'s message is only the button\'s words', async () => {
  const { system, request } = await run(ctx(true));
  expect(system).toContain(beginningTurnInstruction('find-a-beginning'));
  expect(request).toContain(BEGINNING_WORDS);
  expect(request).not.toContain('do not assume you have read any Idea or Source');
});

test('without the intent nothing is added, and provenance tells the two apart', async () => {
  const plain = await run(ctx(false));
  expect(plain.system).not.toContain(beginningTurnInstruction('find-a-beginning'));
  const pressed = await run(ctx(true));
  expect(pressed.hash).not.toBe(plain.hash);
});
