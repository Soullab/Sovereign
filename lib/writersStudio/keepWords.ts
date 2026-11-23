/**
 * KEEP MY WORDS — placing a writer's own message on their page (founder standard 2026-11-23).
 *
 * Pure, so the claim it makes can be tested apart from the page. Pre-review of #2383: the
 * write path (editSection) silently does nothing for a missing or read-only section, so this
 * reports success only when the page now holds exactly the new body.
 */
export type KeepWordsResult = boolean | 'saving';

export interface KeepWordsWriting {
  hasUnsavedWork(): boolean;
  statusOf(sectionId: string): string;
  bodyOf(sectionId: string): string;
  editSection(sectionId: string, body: string): void;
}

/** true = placed; 'saving' = refused while the page saves; false = could not be placed here. */
export function placeWordsOnSection(
  writing: KeepWordsWriting | null | undefined,
  sectionId: string | null | undefined,
  text: string,
): KeepWordsResult {
  if (!writing || !sectionId || !text.trim()) return false;
  if (writing.hasUnsavedWork() || ['dirty', 'saving', 'conflict', 'error'].includes(writing.statusOf(sectionId))) return 'saving';
  const body = writing.bodyOf(sectionId);
  if (typeof body !== 'string') return false;
  const before = body.replace(/\s+$/, '');
  const next = before ? `${before}\n\n${text}` : text;
  writing.editSection(sectionId, next);
  return writing.bodyOf(sectionId) === next;
}
