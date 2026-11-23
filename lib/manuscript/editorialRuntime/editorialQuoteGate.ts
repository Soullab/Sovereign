/**
 * WS-WORK-CONTINUITY · A2 (editorial turn) — mechanical quote fidelity for the passage desk.
 *
 * Same law as the Work conversation: a long quoted span in MAIA's REPLY must occur in text she was actually
 * given for this turn (everything in the request, which includes the passage, the author's sample and the
 * writer's own words) or in her own proposal in the same response. ⛔ Existence of the quote only; not the truth
 * of her claim about it. ⛔ The whole turn is refused, never repaired (this lane's convention): nothing of hers is
 * kept and nothing is written.
 */
import { checkQuoteFidelity } from '@/lib/manuscript/ask/quoteFidelity';
import type { StructuredRequest } from '@/lib/ai/structured/types';

export interface QuotableOutcome {
  readonly kind: string;
  readonly reply: string;
  readonly proposal?: { readonly replacementText: string; readonly rationale?: string };
  readonly direction?: { readonly instruction: string };
}

export const QUOTE_NOT_IN_TEXT_DETAIL =
  'MAIA quoted wording that is not in the text she was given, so nothing was shown or changed. '
  + 'Your own words are untouched. Try asking again, or point her to the exact passage.';

/** The same refusal, read on a Work set to "MAIA asks, never rewrites" (live walk 2026-11-15): there, the quote that
 *  was stopped is almost always wording MAIA should not have offered, so the writer is told why, kindly, and what
 *  to ask instead. Client copy only; the server code is unchanged. */
export const QUOTE_HELD_FOR_QUESTIONS_ONLY_DETAIL =
  'MAIA held back wording: this Work keeps every sentence yours, so she won’t write one, not even as an example. '
  + 'Ask her what to notice in the moment, or what a reader might want to know, and the next sentence can come from you.';

/** Flatten structured message content to the TEXT it carries, so escaped newlines and quotes cannot make a faithful quote unmatchable. */
const contentOf = (c: unknown): string => {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(contentOf).join('\n');
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text;
    if (typeof o.content === 'string' || Array.isArray(o.content)) return contentOf(o.content);
    return Object.values(o).map(contentOf).join('\n');
  }
  return c === null || c === undefined ? '' : String(c);
};

export function judgeEditorialQuotes(request: StructuredRequest, outcome: QuotableOutcome): { ok: boolean; ungrounded: readonly string[] } {
  const sources = [
    request.system,
    ...request.messages.map((m) => contentOf((m as { content?: unknown }).content)),
    outcome.proposal?.replacementText ?? '',
    outcome.proposal?.rationale ?? '',
    outcome.direction?.instruction ?? '',
  ];
  return checkQuoteFidelity(outcome.reply, sources);
}

/**
 * ⭐⭐ THE INSTRUCTION FOR THE LAW ABOVE — stated at the SAME ADDRESS as the judgement,
 * so the two cannot drift apart.
 *
 * `turn.ts` already holds the governing principle, for the scope declaration: *"two
 * resolutions could disagree, and the one that governs must be the one she was told
 * about."* Quote fidelity was NOT held to it. The discipline was given only on a Work
 * set to "MAIA asks, never rewrites" (`workQuestionsOnlyInstruction`), while
 * `judgeEditorialQuotes` refuses EVERY turn by it — so on an ordinary Work MAIA was
 * judged by a rule she was never given, and the general instruction positively allows
 * illustrative wording.
 *
 * Observed as a founder walk failure on Elemental Alchemy, 2026-11-23: asking for an
 * edit returned "MAIA quoted wording that is not in the text she was given", because
 * the natural shape of an edit — *you wrote "X", consider "Y"* — puts her OFFER in
 * quotation marks, where the gate can only read it as a false citation of the Work.
 *
 * ⛔ The gate is not weakened and no wording is exempted by framing: a quotation still
 *    means the author's words. The offer simply travels where the writer can act on it.
 */
export function editorialQuoteDisciplineInstruction(mayPropose: boolean): string {
  return [
    'QUOTATION MARKS BELONG TO THE WRITER.',
    'Put quotation marks ONLY around wording that appears exactly in the text you were given this turn. Quoting anything else refuses the whole turn, and the writer receives nothing at all — not your reading, not your edit.',
    mayPropose
      /* The schema carries `proposal.replacementText`, and the gate already grounds it:
         wording that travels there is never mistaken for a citation, AND it reaches the
         writer as something to use, change, discuss or undo. */
      ? 'Wording you are PROPOSING is not a quotation. Put it in the proposal, never in quotation marks in your reply. The reply says what you notice and why; the proposal carries the words themselves.'
      /* No proposal exists on this turn, so there is nowhere for an offer to go: it must
         be described rather than quoted. */
      : 'You are not offering wording on this turn. If you describe a direction the writing could take, describe it without quotation marks.',
  ].join('\n');
}
