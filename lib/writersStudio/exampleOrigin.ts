/**
 * "Try this on my page" (founder 2026-11-24, "Yes, via the passage"): an example MAIA showed in the Work conversation
 * is taken to the passage, where she proposes a real edit through the ordinary path — measured against the writer's
 * Revision latitude, then applied only by the writer's own "Use this", with Undo.
 *
 * Mirrors the arrival framing (arrivalOrigin.ts):
 * - the client sends only a REFERENCE: which Work conversation, which of MAIA's turns;
 * - the server loads that turn from the member's own conversation on the same manuscript (exampleOriginServer.ts) and
 *   adds `exampleOriginInstruction` to the system prompt.
 * ⛔ The example's wording never comes from the browser, and it is never applied as it stands: MAIA proposes afresh,
 *   and that proposal is what the latitude check judges.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF_KEYS = ['askThreadId', 'turnIndex'] as const;

/** What the client may send: identities only. */
export interface ExampleOriginRef {
  askThreadId: string;
  turnIndex: number;
}

/** A closed shape: exactly the two keys, each well-formed. Unknown keys refuse. */
export function isExampleOriginRef(value: unknown): value is ExampleOriginRef {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v);
  if (keys.length !== REF_KEYS.length || !keys.every((k) => (REF_KEYS as readonly string[]).includes(k))) return false;
  return typeof v.askThreadId === 'string' && UUID.test(v.askThreadId)
    && typeof v.turnIndex === 'number' && Number.isSafeInteger(v.turnIndex) && v.turnIndex >= 0;
}

/** The writer's turn in the passage conversation: only the button's words. */
export const TRY_EXAMPLE_WORDS = 'Try that example on my page.';

/** A stored reply longer than this is not carried (a Work-conversation answer is far shorter). */
/* #2402 review (Low 2): 4000 was below what a Work reply can be (ASK_MAX_TOKENS is 16,000 tokens), so a long Deeper
   example showed "Try this on my page" and then failed. The limit is now 16,000 characters, and the conversation offers
   the button only for a reply within it, so the button and the server agree. */
export const EXAMPLE_REPLY_MAX = 16_000;

/** #2398 review (Low 4): the reply sits between <<< and >>> in the system prompt. Its own text can never close or reopen
 *  that fence: any run of three or more angle brackets inside it is softened before it is placed there. */
export function fenceSafe(reply: string): string {
  return reply.replace(/<{3,}/g, (m) => '‹'.repeat(m.length)).replace(/>{3,}/g, (m) => '›'.repeat(m.length));
}

/** How MAIA treats the example she showed: server-owned, never the writer's turn. */
export function exampleOriginInstruction(reply: string): string {
  return [
    'THE WRITER ASKED TO TRY AN EXAMPLE ON THEIR PAGE (your own earlier reply, from the Work conversation; not their words)',
    'In the Work conversation you showed them an example, after the line "An example, not your words:". This is that reply, exactly as you wrote it:',
    '<<<',
    fenceSafe(reply),
    '>>>',
    [
      'Propose an edit of the passage in front of you that follows that example as closely as the writer\'s chosen latitude allows.',
      'The passage in front of you now is the authority: if it has changed since, work from what is there now, and say so.',
      'Change only what the example changed. Do not add a fact the writer has not given you: no season, place, name, number or event that is not already in their words.',
      'If the example does not fit within their latitude, say so plainly and propose the nearest change that does.',
      'Nothing goes onto their page unless they choose it.',
    ].join('\n'),
  ].join('\n');
}
