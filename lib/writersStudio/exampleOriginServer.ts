/**
 * Server side of "Try this on my page" (see `exampleOrigin.ts`): resolve a client's reference to the example MAIA showed
 * in the member's own Work conversation.
 *
 * ⛔ Every lookup is scoped by member and by manuscript. Another member's conversation, a conversation on a different
 * manuscript from the passage's, the writer's own turn, a turn with no example, and an unknown turn all resolve to null,
 * and are indistinguishable from one another.
 */

import { query } from '@/lib/db/postgres';
import { containsExample } from './exampleLevel';
import { EXAMPLE_REPLY_MAX, type ExampleOriginRef } from './exampleOrigin';

export const EDITORIAL_THREAD_MANUSCRIPT_SQL = 'SELECT manuscript_id FROM ask_threads WHERE id = $1 AND member_id = $2';
export const EXAMPLE_TURN_SQL = `SELECT t.body
   FROM ask_turns t
   JOIN ask_threads th ON th.id = t.thread_id
  WHERE th.id = $1 AND th.member_id = $2 AND th.manuscript_id = $3
    AND t.turn_index = $4 AND t.speaker = 'maia'`;

export async function resolveExampleOrigin(input: {
  memberId: string;
  /** The passage (editorial) conversation this turn belongs to. */
  threadId: string;
  ref: ExampleOriginRef;
}): Promise<string | null> {
  const thread = await query<{ manuscript_id: string | null }>(EDITORIAL_THREAD_MANUSCRIPT_SQL, [input.threadId, input.memberId]);
  const manuscriptId = thread.rows[0]?.manuscript_id;
  if (!manuscriptId) return null;
  const turn = await query<{ body: string }>(EXAMPLE_TURN_SQL,
    [input.ref.askThreadId, input.memberId, manuscriptId, input.ref.turnIndex]);
  const body = turn.rows[0]?.body;
  if (typeof body !== 'string' || body.length > EXAMPLE_REPLY_MAX || !containsExample(body)) return null;
  return body;
}
