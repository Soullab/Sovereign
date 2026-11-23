/**
 * Storyteller-elder walk 2026-11-23 (fictional composite):
 * - MAIA pointed a 70-year-old storyteller to an edit through Studio terms ("Revision latitude"). She is now told to say
 *   first, in plain words, what the writer can do, and to leave settings out unless asked.
 * - A helper opening a Work that is not theirs saw "could not read this manuscript just now", a passing-fault message. The
 *   page now says the Work is not theirs or no longer exists, and never says which.
 */
import fs from 'node:fs';
import path from 'node:path';
import { GUIDE_STANCE, studioGuideInstruction } from '../studioGuide';

test('MAIA is told to lead with plain words and to leave settings out unless asked', () => {
  expect(GUIDE_STANCE).toMatch(/Speak to someone who may never have used a writing tool/);
  expect(GUIDE_STANCE).toMatch(/Say first, in plain words, what they can do/);
  expect(GUIDE_STANCE).toMatch(/Do not bring in settings, preferences or the Studio's own terms/);
  expect(studioGuideInstruction()).toContain('Speak to someone who may never have used a writing tool');
  expect(studioGuideInstruction({ sanctuary: true })).toContain('Speak to someone who may never have used a writing tool');
});

test('a Work that is not yours is said honestly, without saying whether it exists', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'app/dev/writers-studio-pc3-live/P4R1WriteEditController.tsx'), 'utf8');
  const msg = src.match(/export const NOT_YOURS_OR_GONE = '([^']+)'/)?.[1] ?? '';
  expect(msg).toMatch(/isn’t one of yours, or it no longer exists/);
  expect(msg).not.toMatch(/just now|try again/i);
  // The 404 answer is handled before the generic failure, and does not invite a retry.
  const at404 = src.indexOf('if (response.status === 404)');
  const generic = src.indexOf("if (!response.ok) throw new Error('context');");
  expect(at404).toBeGreaterThan(-1);
  expect(at404).toBeLessThan(generic);
  expect(src.slice(at404, generic)).toContain('setMessage(NOT_YOURS_OR_GONE)');
});
