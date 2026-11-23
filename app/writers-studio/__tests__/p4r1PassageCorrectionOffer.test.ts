/** @jest-environment jsdom */
/**
 * E0 walk 2026-11-23: a correction given in the passage room never reached the Work
 * conversation, because the passage room never offered to keep it. Same offer, same
 * wording, same route as the Work conversation (#2358); nothing kept without the press.
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

test('after a plain disagreement, the passage room offers to keep it — and Keep stores the writer\'s own words', async () => {
  render();
  expect(container.querySelector('[data-correction-offer]')).not.toBeNull();
  await act(async () => { button(CORRECTION_OFFER_ACCEPT)!.click(); });
  expect(createWriterCorrection).toHaveBeenCalledTimes(1);
  expect(createWriterCorrection.mock.calls[0][0]).toEqual({
    workId: 'work-1', threadId: 't1', maiaTurnIndex: 1, kind: 'interpretation_rejection', correction: DISAGREE,
  });
  expect(container.textContent).toContain('Kept. MAIA will read your Work this way from now on');
});

test('"Not now" keeps nothing and the offer does not come back', async () => {
  render();
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

test('no offer when the writer did not disagree', () => {
  render({ writerSays: 'Can you show me a lighter version?' });
  expect(container.querySelector('[data-correction-offer]')).toBeNull();
});
