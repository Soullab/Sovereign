/**
 * Where what a member keeps lives — named the same way everywhere.
 *
 * Members keep things in two places, and before 2026-11-25 nothing linked them:
 *   - Keep (/maia/keep-capture): what MAIA may bring back into conversation.
 *   - Reflections (/reflections): moments saved from conversations, journal and rooms.
 *
 * Founder ruling (Kelly, 2026-11-25): Reflections must be obvious and easy to
 * reach from Keep, the Journal and the other places members save things, to
 * encourage keeping. Each room draws its own link in its own material; this
 * file only fixes the destinations and their names so they cannot drift.
 */

export const KEPT_PLACES = {
  keep: { label: 'Keep', href: '/maia/keep-capture', purpose: 'what MAIA may bring back to you' },
  reflections: { label: 'Reflections', href: '/reflections', purpose: 'moments you have saved' },
} as const;
