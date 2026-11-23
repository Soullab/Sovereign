/** @jest-environment jsdom */
/**
 * P0 (#1800): the passage composer never loses the writer's words to a failed send.
 * The words leave the box only once the host reports that MAIA's reply is shown.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import EditorialDancePanel from '@/app/dev/writers-studio-pc3-live/EditorialDancePanel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const WORDS = 'Does the second image undercut the first?';

function renderEmptyRoom(onSend: jest.Mock) {
  act(() => root.render(React.createElement(EditorialDancePanel, {
    manuscriptTitle: 'Threshold',
    currentText: 'Original words.',
    sectionBody: 'Before.\n\nOriginal words.\n\nAfter.',
    thread: null,
    version: null,
    lastMaiaTurn: null,
    appliedVersionId: null,
    busy: false,
    message: null,
    undoMessage: null,
    sessionPosture: { resolved: true, sanctuary: false },
    onChooseSessionPosture: jest.fn(),
    onSelectVersion: jest.fn(),
    onSend,
    onSaveMember: jest.fn(async () => true),
    onApply: jest.fn(),
    onUndo: jest.fn(),
    onKeep: jest.fn(),
    onDepth: jest.fn(),
  } as any)));
}

const box = () =>
  container.querySelector('textarea[aria-label="What do you want to do with this passage?"]') as HTMLTextAreaElement;

function type(text: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box(), text);
    box().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const send = () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Ask MAIA')!;

async function settle(promise: Promise<unknown>) {
  await act(async () => { await promise.catch(() => undefined); });
}

test('a refused or failed send leaves the writer’s words in the box', async () => {
  const outcome = Promise.resolve(false);
  const onSend = jest.fn((_text?: string) => outcome);
  renderEmptyRoom(onSend);
  type(WORDS);
  act(() => send().click());
  await settle(outcome);

  expect(onSend).toHaveBeenCalledTimes(1);
  expect(onSend.mock.calls[0][0]).toBe(WORDS);
  expect(box().value).toBe(WORDS);
});

test('a send that throws also leaves the words', async () => {
  let outcome: Promise<boolean> = Promise.resolve(false);
  const onSend = jest.fn(() => { outcome = Promise.reject(new Error('network')); return outcome; });
  renderEmptyRoom(onSend);
  type(WORDS);
  act(() => send().click());
  expect(onSend).toHaveBeenCalledTimes(1);
  await settle(outcome);

  expect(box().value).toBe(WORDS);
});

test('the words leave the box only once MAIA’s reply is shown', async () => {
  let resolve!: (ok: boolean) => void;
  const outcome = new Promise<boolean>((r) => { resolve = r; });
  const onSend = jest.fn(() => outcome);
  renderEmptyRoom(onSend);
  type(WORDS);
  act(() => send().click());

  // While MAIA is still answering, the words are still there.
  expect(box().value).toBe(WORDS);
  resolve(true);
  await settle(outcome);
  expect(box().value).toBe('');
});

test('words the writer typed while waiting are not wiped by the earlier send', async () => {
  let resolve!: (ok: boolean) => void;
  const outcome = new Promise<boolean>((r) => { resolve = r; });
  renderEmptyRoom(jest.fn(() => outcome));
  type(WORDS);
  act(() => send().click());
  type('And the ending?');
  resolve(true);
  await settle(outcome);

  expect(box().value).toBe('And the ending?');
});

test('a host that reports nothing keeps the older clear-on-send behaviour', () => {
  renderEmptyRoom(jest.fn());
  type(WORDS);
  act(() => send().click());

  expect(box().value).toBe('');
});
