/**
 * "HELP ME FIND A BEGINNING" — a closed Studio intent (newcomer walk 2026-11-23; founder standard
 * of the same day: no expertise required, the writer's first act is authorship).
 *
 * The walk found the button offering a "Suggested start" that was AI instructions written in the
 * writer's voice ("Nothing feeding this Work has been handed to you automatically. Do not assume
 * you have read any Idea or Source…"), which "Use this" put in their box under their name.
 *
 * ⭐ TWO HALVES, KEPT APART, exactly as Teach me (F1 ruling, founder 2026-11-02):
 * - `BEGINNING_WORDS` is the WRITER'S turn: the button's own words, short and visible.
 * - `beginningTurnInstruction` is SERVER-OWNED: how MAIA answers. It travels as the closed
 *   `studioIntent` field and is added to the system prompt, never stored as something the
 *   writer said.
 */
export type StudioIntent = 'find-a-beginning';

export const STUDIO_INTENTS: readonly StudioIntent[] = ['find-a-beginning'];

export function isStudioIntent(value: unknown): value is StudioIntent {
  return typeof value === 'string' && (STUDIO_INTENTS as readonly string[]).includes(value);
}

/** What the writer pressed, stored as their turn. */
export const BEGINNING_WORDS = 'Help me find a beginning.';

/** How MAIA answers a pressed "Help me find a beginning". Server-owned. */
export function beginningTurnInstruction(intent: StudioIntent): string {
  switch (intent) {
    case 'find-a-beginning':
      return [
        'The writer pressed "Help me find a beginning" on a blank writing place for this Work.',
        'Help them clarify what they want to say. Do not write the opening for them.',
        'Nothing feeding this Work has been handed to you automatically: do not assume you have read any Idea or Source unless the writer brings words from it into this conversation.',
        'Ask one useful, gentle question that helps them begin in their own words. Do not assume they are a writer or know any craft terms.',
      ].join(' ');
  }
}
