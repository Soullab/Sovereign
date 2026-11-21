/**
 * WS-F1 (live walk 2026-11-21, production 2fa63e846): a dropped connection is not evidence that a question failed to arrive.
 *
 * The browser lost the connection (net::ERR_NETWORK_CHANGED) after the question was sent. The page said "That didn't reach her",
 * but the server had kept the question and MAIA had answered it; the answer appeared only after a reload. A transport error says
 * nothing about which side of the wire the question reached, so the conversation asks the server before it tells the writer.
 *
 * PURE: compares the thread as it was before the send with the thread re-read from the server afterwards.
 *   answered     a NEW writer turn with exactly this question, followed by a MAIA turn
 *   held         that writer turn is the thread's last turn: it arrived and no answer exists. The server persists the writer's turn
 *                BEFORE calling the model (lib/manuscript/ask/retry.ts), and an identical resend reuses it rather than duplicating it.
 *   not_arrived  the re-read thread is exactly as long as before: nothing is visible YET. ⛔ Not proof of non-delivery: the request
 *                may still be on its way, and a transport error cannot show it was never dispatched. Surfaces say "unconfirmed".
 *   unknown      no re-read (offline, refused), or the thread changed in a way that does not prove either
 * ⛔ Never 'answered' or 'held' on length alone, and never 'not_arrived' without a successful re-read.
 */
import type { AskThreadView } from '@/lib/writersStudio/askClient';

export type Delivery = 'answered' | 'held' | 'not_arrived' | 'unknown';

export function deliveryAfterDrop(turnsBefore: number, after: AskThreadView | null, question: string): Delivery {
  if (!after || !Array.isArray(after.turns)) return 'unknown';
  if (after.turns.length === turnsBefore) return 'not_arrived';
  const asked = question.trim();
  const turns = after.turns;
  for (let i = turnsBefore; i < turns.length; i++) {
    if (turns[i].speaker !== 'author' || turns[i].body.trim() !== asked) continue;
    if (i === turns.length - 1) return 'held';
    if (turns[i + 1].speaker === 'maia') return 'answered';
  }
  return 'unknown';
}
