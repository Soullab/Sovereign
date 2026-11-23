/**
 * Relationship visibility on return (founder approval 2026-11-19, live walk WS-LIVE-WALK-01 finding W5).
 *
 * A writer who comes back to a Work with an existing conversation was greeted as on day one; the conversation existed
 * but only behind "Talk about the whole Work". This turns thread DISCOVERY into what the door may truthfully say.
 *
 * Law kept (observationDialogueResume.ts): failure is not an empty list. `unavailable` offers NOTHING (the ordinary
 * label), never "you have no conversations". Several threads are never collapsed into one: MAIA does not choose which
 * conversation continues; the writer does, inside the conversation (founder ruling 2026-11-05).
 * Pure: it reads no manuscript text, opens no thread, sends nothing.
 */
import type { ThreadDiscovery } from './observationDialogueResume';

export type PriorConversationOffer =
  | { kind: 'none' }
  | { kind: 'one'; openedAt: string; turnCount: number }
  | { kind: 'several'; count: number };

export function priorConversationOffer(discovery: ThreadDiscovery): PriorConversationOffer {
  if (discovery.kind !== 'threads') return { kind: 'none' };
  const threads = discovery.threads.filter((t) => t.turnCount > 0);
  if (threads.length === 0) return { kind: 'none' };
  if (threads.length === 1) return { kind: 'one', openedAt: threads[0].openedAt, turnCount: threads[0].turnCount };
  return { kind: 'several', count: threads.length };
}

/** "19 November". An unreadable date gives null, so the label never shows "Invalid Date". */
export function conversationDate(openedAt: string): string | null {
  const d = new Date(openedAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

/** The words on the door. `fallback` is the ordinary label (program copy or "Talk about the whole Work"). */
export function priorConversationLabel(offer: PriorConversationOffer, fallback: string): { label: string; note: string | null } {
  if (offer.kind === 'one') {
    const date = conversationDate(offer.openedAt);
    return { label: 'Continue our conversation', note: date ? `We began on ${date}. It is all still here.` : 'It is all still here.' };
  }
  if (offer.kind === 'several') {
    return { label: 'Continue a conversation', note: `You have ${offer.count} conversations with MAIA about this Work. You choose which one.` };
  }
  return { label: fallback, note: null };
}
