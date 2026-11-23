import fs from 'node:fs';
import path from 'node:path';
import { correctionOfferFor } from '../correctionOffer';

describe('correctionOfferFor — recognises a plainly phrased disagreement, nothing else', () => {
  it('⭐ the walk\'s own message (WS real-model walk 01, T3) is offered as a rejected interpretation', () => {
    expect(correctionOfferFor("I disagree. The leaving isn't missing; it's the point that it's never shown. Salt IS the leaving. I don't want a departure scene."))
      .toEqual({ kind: 'interpretation_rejection' });
  });
  it.each([
    "I don't agree that the ending is rushed.",
    'You are misreading Marta here.',
    "That's not the point of the harbour scene.",
    'I reject that reading of the letter.',
  ])('offers for %p', (m) => { expect(correctionOfferFor(m)).toEqual({ kind: 'interpretation_rejection' }); });
  it('"not what I meant" pre-selects the meaning kind', () => {
    expect(correctionOfferFor("That's not what I meant by the key.")).toEqual({ kind: 'intent' });
  });
  it.each([
    'Do you disagree with how the letter lands?',
    'What would you change in the opening?',
    'I agree, and I want to keep going.',
    'Thank you, that helps.',
    'no',
    '',
  ])('⭐ MUST FAIL IF it offers on an ordinary message or a question: %p', (m) => {
    expect(correctionOfferFor(m)).toBeNull();
  });
});

describe('the conversation only OFFERS; the writer keeps', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'app/writers-studio/canvas/WorkConversation.tsx'), 'utf8');
  const block = src.slice(src.indexOf('Correction offer (WS real-model walk 01)'), src.indexOf('data-maia-correction={t.index}'));
  it('⭐ MUST FAIL IF the offer saves anything by itself', () => {
    expect(block.length).toBeGreaterThan(300);
    expect(block).not.toMatch(/createWriterCorrection|keepCorrection|apiFetch|fetch\(/);
    expect(block).toMatch(/setCorrectingTurn\(t\.index\)/);
    expect(block).toMatch(/setCorrectionDraft\(prev\.body\.trim\(\)\)/);
  });
  it('appears only under MAIA\'s latest kept reply to the writer\'s own message, never in Sanctuary or undeclared posture', () => {
    expect(block).toMatch(/t\.index !== latestMaiaIndex/);
    expect(block).toMatch(/prev\.speaker !== 'author'/);
    expect(block).toMatch(/!posture\.resolved \|\| posture\.sanctuary/);
    expect(block).toMatch(/!threadId/);
  });
  it('answered once (accept or Not now), it does not return for that reply', () => {
    expect(block).toMatch(/offerAnswered\.has\(t\.index\)/);
    expect(block).toMatch(/setOfferAnswered\(\(s\) => new Set\(s\)\.add\(t\.index\)\)/);
  });
});
