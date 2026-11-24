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

export function containsExample(body: string): boolean {
  return body.split('\n').some((line) => line.trim() === WORK_EXAMPLE_LINE);
}

/** One step lighter or deeper, never past either end; an invalid level is the smallest. */
export function stepLatitude(current: EditorialLatitude, direction: 'lighter' | 'deeper'): EditorialLatitude {
  const at = isEditorialLatitude(current) ? current : DEFAULT_EDITORIAL_LATITUDE;
  const levels = EDITORIAL_LATITUDES as readonly EditorialLatitude[];
  const i = levels.indexOf(at);
  return levels[Math.max(0, Math.min(levels.length - 1, i + (direction === 'deeper' ? 1 : -1)))]!;
}
