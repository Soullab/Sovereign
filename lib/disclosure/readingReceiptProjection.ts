/**
 * WS-STEP4 Package C2 — what the browser is given for a thread: each MAIA turn's reading RECEIPT, never its raw provenance.
 *
 * R20 reviewer decision 3 (2026-11-20, ACCEPT): stop sending the writer's browser internal bookkeeping it does not use (model,
 * provider, prompt hash, digests, section ids). Decision 1: show the writer what MAIA read, also when a conversation is reopened.
 *
 * ⛔ Member-scoped: every query here is the existing member-scoped loader (loadSectionHeads, loadSuppliedSections). The caller has
 *    already established that the member owns the Work and the thread.
 * ⛔ Not a read FOR MAIA: section bodies are hashed here only to say "changed since"; no text leaves this function, nothing is
 *    disclosed to a model, no grant is consulted or created. A receipt is evidence of past access, never permission to read again.
 */
import { loadSectionHeads } from '@/lib/manuscript/ask/frozenReading';
import { loadSuppliedSections } from '@/lib/disclosure/workReadScopeRead';
import { receiptOf, sectionIdsIn, type ReadingReceipt, type SectionsNow } from '@/lib/manuscript/ask/readingReceipt';

interface TurnIn { readonly speaker: 'author' | 'maia'; readonly answerProvenance?: unknown }
type Without<Tn> = Omit<Tn, 'answerProvenance'>;
export type ClientThread<T extends { turns: readonly TurnIn[] }> =
  Omit<T, 'turns'> & { turns: (Without<T['turns'][number]> & { receipt?: ReadingReceipt })[] };

/** Remove raw provenance from every turn. Used where no receipt is shown (developmental threads, Living Work conversations). */
export function withoutProvenance<T extends { turns: readonly TurnIn[] }>(thread: T): ClientThread<T> {
  return { ...thread, turns: thread.turns.map(({ answerProvenance: _drop, ...rest }) => rest) } as ClientThread<T>;
}

/** The thread as the browser sees it: raw provenance removed, a receipt on each MAIA turn. */
export async function withReceipts<T extends { turns: readonly TurnIn[] }>(
  thread: T | null, manuscriptId: string, memberId: string,
): Promise<ClientThread<T> | null> {
  if (!thread) return null;
  const ids = new Set<string>();
  for (const t of thread.turns) if (t.speaker === 'maia') for (const id of sectionIdsIn(t.answerProvenance)) ids.add(id);
  let now: SectionsNow = { heads: new Map(), digests: new Map() };
  if (ids.size > 0) {
    const heads = await loadSectionHeads(manuscriptId, memberId);
    const live = heads.filter((h) => ids.has(h.id)).map((h) => h.id);
    const digests = await loadSuppliedSections(manuscriptId, memberId, live);
    now = {
      heads: new Map(heads.map((h) => [h.id, { heading: h.heading, position: h.position }])),
      digests: new Map(digests.map((d) => [d.id, d.digest])),
    };
  }
  return {
    ...thread,
    turns: thread.turns.map(({ answerProvenance, ...rest }) =>
      rest.speaker === 'maia' ? { ...rest, receipt: receiptOf(answerProvenance, now) } : rest),
  } as ClientThread<T>;
}
