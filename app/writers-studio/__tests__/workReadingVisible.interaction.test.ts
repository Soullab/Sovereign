/** @jest-environment jsdom */
/**
 * D3 — R3.4.4 founder ruling A (#1819, 2026-11-19): the standing Work read scope is lawful only while MAIA's conversation
 * surface visibly shows an ACTIVE permission with a one-action Stop, and each answer shows which saved sections she read.
 * Fictional manuscript id, mocked read-scope client. NOT an authenticated app/server witness.
 */
import React, { act } from 'react';
import fs from 'fs';
import path from 'path';
import { createRoot, type Root } from 'react-dom/client';

const getReadScope = jest.fn();
const setReadScope = jest.fn();
jest.mock('@/lib/writersStudio/readScopeClient', () => ({
  getReadScope: (...a: unknown[]) => getReadScope(...a),
  setReadScope: (...a: unknown[]) => setReadScope(...a),
}));
jest.mock('@/lib/sanctuary/currentClientPosture', () => ({
  readCurrentSanctuaryPosture: () => ({ resolved: true, sanctuary: false }),
}));
jest.mock('@/app/writers-studio/canvas/SessionPostureChoice', () => ({ __esModule: true, default: () => null }));

import ReadScopeControl, { READ_SCOPE_STOPPED_COPY } from '@/app/writers-studio/canvas/ReadScopeControl';
import { answerReadSentence } from '@/app/writers-studio/canvas/WorkConversation';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  getReadScope.mockReset(); setReadScope.mockReset();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function mount(compact: boolean) {
  await act(async () => { root.render(React.createElement(ReadScopeControl, { manuscriptId: "fictional-ms", compact })); });
}
const buttons = () => [...container.querySelectorAll('button')].map((b) => b.textContent);

describe('compact read-scope control (holdings hidden)', () => {
  test('an ACTIVE permission is shown with Stop', async () => {
    getReadScope.mockResolvedValue({ level: 'work' });
    await mount(true);
    expect(container.textContent).toContain('MAIA may read your saved work when your question needs it.');
    expect(buttons()).toContain('Stop');
  });

  test('no permission: nothing is shown, and no permission is offered here', async () => {
    getReadScope.mockResolvedValue(null);
    await mount(true);
    expect(container.textContent).toBe('');
    expect(buttons()).not.toContain('Let MAIA read my saved work');
  });

  test('Stop revokes, and the writer sees that it took effect', async () => {
    getReadScope.mockResolvedValue({ level: 'work' });
    setReadScope.mockResolvedValue(null);
    await mount(true);
    const stop = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Stop')!;
    await act(async () => { stop.click(); });
    expect(setReadScope).toHaveBeenCalledWith('fictional-ms', { action: 'revoke' });
    expect(container.textContent).toBe(READ_SCOPE_STOPPED_COPY);
    expect(buttons()).not.toContain('Stop');
  });

  test('a failed check shows nothing in compact (the server still enforces; the full control says it)', async () => {
    getReadScope.mockResolvedValue(undefined);
    await mount(true);
    expect(container.textContent).toBe('');
  });
});

describe('full control is unchanged', () => {
  test('no permission: the writer is offered the choice', async () => {
    getReadScope.mockResolvedValue(null);
    await mount(false);
    expect(container.textContent).toContain('MAIA reads only the passage you are in.');
    expect(buttons()).toContain('Let MAIA read my saved work');
  });
});

describe('per-answer disclosure', () => {
  test('names exactly the saved sections the server handed her', () => {
    expect(answerReadSentence([{ sectionId: 'a', label: 'Opening' }, { sectionId: 'b', label: 'Chapter 2' }]))
      .toBe('For this answer MAIA read your saved sections: Opening, Chapter 2.');
    expect(answerReadSentence([{ sectionId: 'a', label: 'Opening' }])).toBe('For this answer MAIA read your saved section: Opening.');
  });

  test('an untitled section is still counted, never dropped', () => {
    expect(answerReadSentence([{ sectionId: 'a', label: null }, { sectionId: 'b', label: '  ' }]))
      .toBe('For this answer MAIA read your saved sections: an untitled section, an untitled section.');
  });

  test('nothing read is said plainly', () => {
    expect(answerReadSentence([])).toBe('For this answer MAIA read none of your saved work.');
  });

  /* Source-level: mounting the full conversation needs identity, thread and provider seams; a jsdom walk is still owed. */
  const src = fs.readFileSync(path.resolve(__dirname, '../canvas/WorkConversation.tsx'), 'utf8');
  test('the conversation records what the server returned for each answer, per conversation generation', () => {
    expect(src).toContain('setAnswerRead({ gen, turns: r.thread.turns.length, read: r.read ?? [] });');
  });
  test('it is shown under MAIA’s latest answer only, in hosts that do not show it themselves', () => {
    expect(src).toMatch(/!onRead && t\.speaker === 'maia' && t\.index === latestMaiaIndex && answerRead\s*\n?\s*&& answerRead\.gen === conversationGenRef\.current && answerRead\.turns === turns\.length/);
    expect(src).toContain('{answerReadSentence(answerRead.read)}');
  });
  test('with holdings hidden, the read-scope control is still mounted in compact form', () => {
    expect(src).toContain('<ReadScopeControl manuscriptId={manuscriptId} compact={hideHoldings} />');
    expect(src).not.toMatch(/!hideHoldings && manuscriptId \? <ReadScopeControl/);
  });
});
