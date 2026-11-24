/**
 * Examples in the Work conversation (founder rulings 2026-11-24): "Yes, as examples"; "it should stay in alignment with
 * what level of intervention they asked for and that should be clearly selected"; "under the rewrites the writer can
 * also choose deeper or lighter options".
 *
 * Pure and client-safe: shared by the server's instruction (workRevisionPause.ts) and the conversation's controls.
 * The level IS the writer's Revision latitude (editorialScope/contract.ts): one setting for passage edits and examples.
 */
import {
  DEFAULT_EDITORIAL_LATITUDE, EDITORIAL_LATITUDES, isEditorialLatitude, type EditorialLatitude,
} from '@/lib/manuscript/editorialScope/contract';

/** The fixed line MAIA puts before an example. The conversation finds an example by it. */
export const WORK_EXAMPLE_LINE = 'An example, not your words:';

/** A pressed Lighter / Deeper sends only these words (like Teach me): they are not the writer's writing. */
export const LIGHTER_EXAMPLE_WORDS = 'Show me a lighter example.';
export const DEEPER_EXAMPLE_WORDS = 'Show me a deeper example.';

/** The first line of the server's example allowance (workRevisionPause.ts). Shared so the reply check below can tell
 *  whether this turn was allowed to show an example at all. */
export const EXAMPLE_RULE_HEADER = 'WHEN THEY ASK TO SEE A CHANGE';

/** #2398 review (Low 1): the marking was enforced only by the prompt. Where examples are not allowed for this Work
 *  (MAIA asks, never rewrites; a program; anything uncertain), a reply that shows one is not shown: this is said instead. */
export const EXAMPLE_NOT_ALLOWED_ANSWER =
  'I started to write an example of new wording, which I don\'t offer in this Work, so I\'ve left it out. Tell me what you\'d like to look at, and we can think it through together.';

export function examplesAllowed(programInstructions: readonly string[]): boolean {
  return programInstructions.some((p) => p.startsWith(`${EXAMPLE_RULE_HEADER}\n`));
}

/* #2402 review (Low 1): the exact-line match let common variants through ("**An example, not your words:**", the example
   on the same line, other spacing or dashes). A line is a marker when, ignoring case, formatting and punctuation, it
   BEGINS with the marker's words. Unicode lookalikes are folded first (NFKC). A rewrite with no marker at all is still
   bound only by MAIA's instructions; this cannot detect one. */
const MARKER_WORDS = markerWords(WORK_EXAMPLE_LINE);
function markerWords(line: string): string {
  return line.normalize('NFKC').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
}

export function containsExample(body: string): boolean {
  return body.split('\n').some((line) => {
    const words = markerWords(line);
    return words === MARKER_WORDS || words.startsWith(`${MARKER_WORDS} `);
  });
}

/** One step lighter or deeper, never past either end; an invalid level is the smallest. */
export function stepLatitude(current: EditorialLatitude, direction: 'lighter' | 'deeper'): EditorialLatitude {
  const at = isEditorialLatitude(current) ? current : DEFAULT_EDITORIAL_LATITUDE;
  const levels = EDITORIAL_LATITUDES as readonly EditorialLatitude[];
  const i = levels.indexOf(at);
  return levels[Math.max(0, Math.min(levels.length - 1, i + (direction === 'deeper' ? 1 : -1)))]!;
}
