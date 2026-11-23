/**
 * WS-WORK-CONTINUITY · A2 — the quote gate judged against manuscript-shaped text.
 *
 * ⛔ The passage below is INVENTED. It reproduces the shape of the paragraph from the
 *    founder walk (a long comma list, an em dash, a phrase that recurs) without any of
 *    its words. A member's manuscript is never a test fixture, and this repository is public.
 *
 * Written from a failed founder walk (2026-11-23): asking MAIA for an edit on
 * a passage of the founder's Work returned "MAIA quoted wording that is not in
 * the text she was given" instead of an edit, repeatedly.
 *
 * ⭐ The law this suite states: the gate must refuse a FABRICATED CITATION of the
 *    author's text, and must not refuse MAIA for OFFERING WORDING — which is the
 *    edit, and is new by construction.
 *
 * ⚠️ Two cases are marked `test.failing`: they state law the shipped code does
 *    NOT yet satisfy, and they PASS while it fails. ⛔ They are not disabled and
 *    they are not aspirational prose — when the repair lands, each flips to
 *    `test` and must go green. A `test.failing` that starts passing FAILS the
 *    suite, so neither can be quietly left behind.
 */
import { checkQuoteFidelity } from '../../ask/quoteFidelity';
import { judgeEditorialQuotes, editorialQuoteDisciplineInstruction } from '../editorialQuoteGate';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StructuredRequest } from '@/lib/ai/structured/types';

/** Invented, in the shape of the paragraph from the founder walk. Not the author's text. */
const PASSAGE =
  'Although this guide aims to steady your hand at the loom, nothing outranks your own patience, craft, '
  + 'and those older patterns handed down by weavers who spent their winters teaching restless apprentices '
  + 'like you. Always seek counsel from master weavers, dyers, careful mentors, and specialists in wool, linen, '
  + 'silk, cotton, and natural pigment matters who share your temperament — especially the quilters and '
  + 'lacemakers. Treat this as a companion to your own judgment at the bench, working alongside the specialists '
  + 'out there, so you have the steadiest guidance possible.';

const SOURCES = ['You are MAIA, at the passage desk.\nThe passage:\n' + PASSAGE];

const requestWith = (passage: string): StructuredRequest =>
  ({ system: 'You are MAIA, at the passage desk.', messages: [{ role: 'user', content: passage }] }) as StructuredRequest;

describe('A2 quote gate · citation of the Work', () => {
  it('passes a faithful quote, curly or straight', () => {
    for (const q of ['“nothing outranks your own patience, craft, and those older patterns”',
                     '"nothing outranks your own patience, craft, and those older patterns"']) {
      expect(checkQuoteFidelity(`You wrote ${q} and that is the hinge.`, SOURCES).ok).toBe(true);
    }
  });

  it('passes a quote spanning the em dash, and one elided with an ellipsis', () => {
    expect(checkQuoteFidelity(
      'The turn at “matters who share your temperament — especially the quilters and lacemakers” is the strongest moment.',
      SOURCES).ok).toBe(true);
    expect(checkQuoteFidelity(
      'You say “nothing outranks your own patience … especially the quilters and lacemakers”.',
      SOURCES).ok).toBe(true);
  });

  it('⛔ REFUSES a fabricated citation — the guarantee, which no repair may weaken', () => {
    const r = checkQuoteFidelity(
      'You wrote “the reader is invited into a sacred and reciprocal covenant”, which overreaches.',
      SOURCES);
    expect(r.ok).toBe(false);
    expect(r.ungrounded).toHaveLength(1);
  });
});

describe('A2 quote gate · wording MAIA OFFERS is not a citation', () => {
  /* The shape "Show me an edit" actually produces. The second span is the edit:
     it cannot occur in the author's text, because it does not exist yet. */
  const REPLY_WITH_INLINE_PROPOSAL =
    'The phrase “specialists in wool, linen, silk, cotton, and natural pigment matters” '
    + 'carries the sentence twice. Consider “specialists whose work suits your temperament” instead.';

  it('the inline-proposal shape is what an edit request produces', () => {
    // Guard on the fixture: the citation half really is grounded, so a failure
    // below is about the OFFER, never about a bad quotation in the fixture.
    expect(checkQuoteFidelity(
      'The phrase “specialists in wool, linen, silk, cotton, and natural pigment matters” carries it twice.',
      SOURCES).ok).toBe(true);
  });

  it('⛔ the gate REFUSES an inline offer, and must keep doing so', () => {
    /* ⚠️ An earlier draft of this suite asked the gate to PASS this shape. That was
       the wrong law: the gate cannot tell an offer from a false citation, and any
       rule that let it try would have to read framing words — unfalsifiable, and a
       weakening of the one instrument that protects the manuscript. The gate stays
       strict. The repair is that MAIA is now TOLD this, on every turn. */
    const r = checkQuoteFidelity(REPLY_WITH_INLINE_PROPOSAL, SOURCES);
    expect(r.ok).toBe(false);
    expect(r.ungrounded).toEqual(['specialists whose work suits your temperament']);
  });

  it('⭐ MAIA is told the rule she is judged by — on EVERY turn, not only a paused Work', () => {
    const TURN = readFileSync(join(process.cwd(), 'lib/manuscript/editorialRuntime/turn.ts'), 'utf8');
    /* Unconditional: no `workPaused ?` or other ternary may guard it, or an ordinary
       Work is again judged by a rule it was never given (founder walk 2026-11-23). */
    expect(TURN).toContain("editorialQuoteDisciplineInstruction(proposalPolicy !== 'reply_only')");
    const line = TURN.split('\n').find((l) => l.includes('editorialQuoteDisciplineInstruction(')) ?? '';
    expect(line).not.toMatch(/\?/);
  });

  it('the instruction sends offered wording to the proposal, and names the refusal cost', () => {
    const proposing = editorialQuoteDisciplineInstruction(true);
    expect(proposing).toMatch(/Wording you are PROPOSING is not a quotation/);
    expect(proposing).toMatch(/refuses the whole turn/);
    /* ⛔ On a reply-only turn the schema carries NO proposal, so the instruction must
       not send her to a field that is not there. */
    const replyOnly = editorialQuoteDisciplineInstruction(false);
    expect(replyOnly).not.toMatch(/proposal/);
    expect(replyOnly).toMatch(/without quotation marks/);
  });

  it('⭐ offered wording carried in the PROPOSAL field is already grounded', () => {
    // The shape the repair must drive MAIA toward: the edit travels as an object
    // the writer can act on, not as a sentence in chat.
    const outcome = {
      kind: 'proposal',
      reply: 'The phrase “specialists in wool, linen, silk, cotton, and natural pigment matters” carries the sentence twice. Here is one way to tighten it.',
      proposal: { replacementText: 'specialists whose work suits your temperament' },
    };
    expect(judgeEditorialQuotes(requestWith(PASSAGE), outcome).ok).toBe(true);
  });
});

describe('A2 quote gate · normalisation of imported manuscripts', () => {
  it('a soft hyphen from a DOCX import does not defeat a faithful quote', () => {
    expect(checkQuoteFidelity(
      'You wrote “nothing outranks your own pa­tience, craft, and those older patterns” here.',
      SOURCES).ok).toBe(true);
  });
});
