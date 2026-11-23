/**
 * Newcomer walk 2026-11-23: "Help me find a beginning" offered AI instructions in the writer's
 * voice. The writer's turn is now only the button's words; the instruction is server-owned.
 */
import { BEGINNING_WORDS, beginningTurnInstruction, isStudioIntent } from '../beginningTurn';
import { workAskPromptHash } from '@/lib/manuscript/ask/askReader';

test('the writer\'s turn is only the button\'s words, and carries no instruction', () => {
  expect(BEGINNING_WORDS).toBe('Help me find a beginning.');
  expect(BEGINNING_WORDS).not.toMatch(/do not|assume|idea|source|ask me/i);
});

test('the instruction is MAIA\'s: one question, no opening written for them, no assumed Sources', () => {
  const text = beginningTurnInstruction('find-a-beginning');
  expect(text).toMatch(/Do not write the opening for them/);
  expect(text).toMatch(/do not assume you have read any Idea or Source/);
  expect(text).toMatch(/Ask one useful, gentle question/);
});

test('only the known intent is accepted', () => {
  expect(isStudioIntent('find-a-beginning')).toBe(true);
  expect(isStudioIntent('write-my-opening')).toBe(false);
  expect(isStudioIntent(undefined)).toBe(false);
});

test('the prompt hash names the intent, so provenance shows what ran', () => {
  expect(workAskPromptHash(undefined, undefined, false, [], 'find-a-beginning')).not.toBe(workAskPromptHash());
});
