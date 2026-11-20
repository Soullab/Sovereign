/**
 * Correction offer (WS real-model walk 01, 2026-11-19; founder direction "use best practice").
 *
 * Evidence: a writer who disagreed with MAIA in plain words ("I disagree… I don't want a departure scene") saw MAIA revise well in
 * that conversation, but a NEW conversation reintroduced the rejected reading: nothing captured the disagreement. When the same
 * correction was kept through "Correct MAIA", the next conversation honoured it. The delivery path works; capture was missing.
 *
 * This module only RECOGNISES a deliberately phrased disagreement in the writer's own message, so the surface can OFFER to keep
 * it. It keeps nothing, sends nothing and infers nothing about the writer (no model, no profiling): the writer must still open the
 * existing correction form, see their words, choose the kind and press "Keep correction". Never offered in Sanctuary.
 */
import type { WriterCorrectionKind } from './writerCorrections';

/** Phrases a writer uses to reject MAIA's reading or meaning. Deliberately narrow: a missed offer costs a click; a wrong one nags. */
const REJECTION = [
  /\bi\s+(?:strongly\s+)?disagree\b/i,
  /\bi\s+(?:don['’]t|do\s+not)\s+agree\b/i,
  /\byou(?:['’]re|\s+are)\s+(?:wrong|mistaken|misreading)\b/i,
  /\byou(?:['’]ve|\s+have)\s+misread\b/i,
  /\bthat(?:['’]s|\s+is)\s+not\s+(?:right|it|how\s+i\s+see\s+it|the\s+point)\b/i,
  /\bthat\s+isn['’]t\s+(?:right|it|the\s+point)\b/i,
  /\bi\s+reject\s+that\b/i,
];
const NOT_MEANT = [
  /\b(?:that['’]s|that\s+is|that\s+isn['’]t)\s+not\s+what\s+i\s+mean[t]?\b/i,
  /\bnot\s+what\s+i\s+(?:mean|meant|intended)\b/i,
];

export type CorrectionOffer = { kind: WriterCorrectionKind } | null;

/**
 * Whether the writer's message (their own words, as sent) plainly disagrees with MAIA's reading, and the kind to pre-select.
 * Returns null when it does not. A question ("do you disagree?") is not a disagreement.
 */
export function correctionOfferFor(writerMessage: string): CorrectionOffer {
  const text = writerMessage.trim();
  if (text.length < 8) return null;
  const sentences = text.split(/(?<=[.!])\s+/);
  const declarative = sentences.filter((s) => !/\?\s*$/.test(s)).join(' ');
  if (!declarative) return null;
  if (NOT_MEANT.some((r) => r.test(declarative))) return { kind: 'intent' };
  if (REJECTION.some((r) => r.test(declarative))) return { kind: 'interpretation_rejection' };
  return null;
}

/** What the offer says. The writer's words are what would be kept; nothing is kept until they press "Keep correction". */
export const CORRECTION_OFFER_COPY = 'You disagreed with my reading. Keep that as how I read your book from now on?';
export const CORRECTION_OFFER_ACCEPT = 'Keep it as a correction';
export const CORRECTION_OFFER_DECLINE = 'Not now';
