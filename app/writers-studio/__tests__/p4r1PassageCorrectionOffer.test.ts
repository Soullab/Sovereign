/** @jest-environment jsdom */
/**
 * E0 walk 2026-11-23: a correction given in the passage room never reached the Work
 * conversation, because the passage room never offered to keep it. Same offer, same
 * wording, same route as the Work conversation (#2358); nothing kept without the press.
 * Review of #2380 (2026-11-23): keeping is a REVIEWED step (the writer sees and can edit their
 * words, then presses "Keep correction"), and only the writer's own typed message is offered,
 * never a composed request that carries draft wording and instructions.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const createWriterCorrection = jest.fn(async (_input: unknown) => ({ ok: true }));
jest.mock('@/lib/writersStudio/writerCorrectionsClient', () => ({
  createWriterCorrection: (input: unknown) => createWriterCorrection(input),
}));

import EditorialDancePanel from '@/app/dev/writers-studio-pc3-live/EditorialDancePanel';
import { CORRECTION_OFFER_ACCEPT, CORRECTION_OFFER_DECLINE } from '@/lib/writersStudio/correctionOffer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  createWriterCorrection.mockClear();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const DISAGREE = 'I disagree. The narrator explains because she still needs the explanation herself.';

function render(opts: { livingWorkId?: string | null; sanctuary?: boolean; writerSays?: string } = {}) {
  const thread = {
    threadId: 't1', chainId: 'c1', targetSectionId: 's1', sectionLabel: 'The Map',
    locusText: 'Original words.', legacyLocus: false,
    turns: [
      { turnIndex: 0, speaker: 'author' as const, body: opts.writerSays ?? DISAGREE, at: '2026-11-23T10:00:00Z' },
      { turnIndex: 1, speaker: 'maia' as const, body: 'Then I had it backwards.', at: '2026-11-23T10:00:05Z' },
    ],
    versions: [], headVersionId: null, application: null,
  };
  act(() => root.render(React.createElement(EditorialDancePanel, {
    stage: true,
    livingWorkId: opts.livingWorkId === undefined ? 'work-1' : opts.livingWorkId,
    manuscriptTitle: 'The Island', currentText: 'Original words.', sectionBody: 'Original words.',
    thread, version: null, lastMaiaTurn: null, appliedVersionId: null,
    busy: false, message: null, undoMessage: null,
    sessionPosture: { resolved: true, sanctuary: opts.sanctuary === true },
    onChooseSessionPosture: jest.fn(), onSelectVersion: jest.fn(), onSend: jest.fn(),
    onSaveMember: jest.fn(async () => true), onApply: jest.fn(), onUndo: jest.fn(), onKeep: jest.fn(), onDepth: jest.fn(),
  } as any)));
}

const button = (label: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);

/** The writer types and sends in the passage composer; the thread then shows MAIA's reply. */
async function writerSends(words: string, opts: Parameters<typeof render>[0] = {}) {
  const box = container.querySelector<HTMLTextAreaElement>('textarea[placeholder="Ask MAIA about this passage…"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, words);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { button('Send')!.click(); });
  render({ ...opts, writerSays: words });
}

test('after the writer\'s own disagreement, Keep opens their words for review; nothing is stored until "Keep correction"', async () => {
  render();
  await writerSends(DISAGREE);
  expect(container.querySelector('[data-correction-offer]')).not.toBeNull();
  await act(async () => { button(CORRECTION_OFFER_ACCEPT)!.click(); });
  expect(createWriterCorrection).not.toHaveBeenCalled();
  const review = container.querySelector<HTMLTextAreaElement>('[data-correction-review-text]')!;
  expect(review.value).toBe(DISAGREE);
  const EDITED = 'The narrator explains because she still needs the explanation herself.';
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(review, EDITED);
    review.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { button('Keep correction')!.click(); });
  expect(createWriterCorrection).toHaveBeenCalledTimes(1);
  expect(createWriterCorrection.mock.calls[0][0]).toEqual({
    workId: 'work-1', threadId: 't1', maiaTurnIndex: 1, kind: 'interpretation_rejection', correction: EDITED,
  });
  expect(container.textContent).toContain('Kept. MAIA will read your Work this way from now on');
});

test('Cancel in review keeps nothing', async () => {
  render();
  await writerSends(DISAGREE);
  await act(async () => { button(CORRECTION_OFFER_ACCEPT)!.click(); });
  await act(async () => { button('Cancel')!.click(); });
  expect(createWriterCorrection).not.toHaveBeenCalled();
  expect(container.querySelector('[data-correction-offer]')).toBeNull();
  expect(container.querySelector('[data-correction-review]')).toBeNull();
});

test('a stored turn the writer did not type here (a composed request with draft wording) is never offered', () => {
  const COMPOSED = [
    'My working revision (not applied):', 'Unapplied draft wording that is not a correction.', '',
    'What I want from you:', 'I disagree with your reading.', '',
    'Nothing is to be applied automatically.',
  ].join('\n');
  render({ writerSays: COMPOSED });
  expect(container.querySelector('[data-correction-offer]')).toBeNull();
  render({ writerSays: DISAGREE }); // also not typed in this session
  expect(container.querySelector('[data-correction-offer]')).toBeNull();
});

test('"Not now" keeps nothing and the offer does not come back', async () => {
  render();
  await writerSends(DISAGREE);
  await act(async () => { button(CORRECTION_OFFER_DECLINE)!.click(); });
  expect(createWriterCorrection).not.toHaveBeenCalled();
  expect(container.querySelector('[data-correction-offer]')).toBeNull();
});

test('no offer in Sanctuary', () => {
  render({ sanctuary: true });
  expect(container.querySelector('[data-correction-offer]')).toBeNull();
});

test('no offer without a Work to keep it in', () => {
  render({ livingWorkId: null });
  expect(container.querySelector('[data-correction-offer]')).toBeNull();
});

test('no offer when the writer did not disagree', async () => {
  render();
  await writerSends('Can you show me a lighter version?');
  expect(container.querySelector('[data-correction-offer]')).toBeNull();
});
