/**
 * WS-F1 (live walk 2026-11-21, production 2fa63e846): a dropped connection is not evidence that a question failed to arrive.
 *
 * The browser lost the connection (net::ERR_NETWORK_CHANGED) after the question was sent. The page said "That didn't reach her",
 * but the server had kept the question and MAIA had answered it; the answer appeared only after a reload. A transport error says
 * nothing about which side of the wire the question reached, so the conversation asks the server before it tells the writer.
 *
 * PURE: compares the thread as it was before the send with the thread re-read from the server afterwards.
 *   arrived      the re-read thread holds a NEW writer turn with exactly this question
 *   not_arrived  the re-read thread is exactly as long as before: nothing was added
 *   unknown      no re-read (offline, refused), or the thread changed in a way that does not prove either
 * ⛔ Never 'arrived' on length alone, and never 'not_arrived' without a successful re-read.
 */
import type { AskThreadView } from '@/lib/writersStudio/askClient';

export type Delivery = 'arrived' | 'not_arrived' | 'unknown';

export function deliveryAfterDrop(turnsBefore: number, after: AskThreadView | null, question: string): Delivery {
  if (!after || !Array.isArray(after.turns)) return 'unknown';
  if (after.turns.length === turnsBefore) return 'not_arrived';
  const asked = question.trim();
  const added = after.turns.slice(turnsBefore);
  return added.some((t) => t.speaker === 'author' && t.body.trim() === asked) ? 'arrived' : 'unknown';
}
