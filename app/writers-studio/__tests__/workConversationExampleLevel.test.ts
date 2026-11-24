/** @jest-environment jsdom */
/**
 * Founder rulings 2026-11-24: MAIA may show an example when asked; it keeps to the level of change the writer selected
 * (their Revision latitude), shown plainly under the example; and the writer can choose lighter or deeper there.
 * Fictional text only.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
const mockAsk = jest.fn(), mockLoadThread = jest.fn(), mockThreads = jest.fn();
jest.mock('@/app/writers-studio/useMemberIdentity', () => ({
  useMemberIdentity: () => ({ phase: 'ready', memberId: 'fictional-member' }),
}));
jest.mock('@/app/writers-studio/useManuscriptKeeps', () => ({ useManuscriptKeeps: () => ({ keeps: [] }) }));
jest.mock('@/lib/writersStudio/askClient', () => ({
  ask: (...args: unknown[]) => mockAsk(...args),
  askLivingWork: (...args: unknown[]) => mockAsk(...args),
  loadThread: (...args: unknown[]) => mockLoadThread(...args),
  loadLivingWorkAskThread: (...args: unknown[]) => mockLoadThread(...args),
  threadsOn: (...args: unknown[]) => mockThreads(...args),
  threadsOnLivingWorkAsk: (...args: unknown[]) => mockThreads(...args),
}));
jest.mock('@/lib/writersStudio/writerCorrectionsClient', () => ({ createWriterCorrection: jest.fn() }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => React.createElement('a', props, children),
}));
import WorkConversation from '@/app/writers-studio/canvas/WorkConversation';
import type { LivingWork } from '@/app/writers-studio/useLivingWorks';
import { LATITUDE_STORAGE_KEY } from '@/lib/writersStudio/editingLatitude';
import { containsExample, stepLatitude, WORK_EXAMPLE_LINE } from '@/lib/writersStudio/exampleLevel';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
const work = { id: 'fictional-work', title: 'Untitled Work' } as LivingWork;
const thread = (maiaBody: string) => ({ ok: true, threadId: 'thread-a', thread: {
  id: 'thread-a', anchor: { on: 'work' }, openedAt: '2026-11-24T10:00:00Z',
  turns: [
    { index: 0, speaker: 'author', body: 'Can you make this sound more like a book?', staleness: 'current' },
    { index: 1, speaker: 'maia', body: maiaBody, staleness: 'current' },
  ],
}});
const WITH_EXAMPLE = `Here is one way.\n\n${WORK_EXAMPLE_LINE}\n\nThe creek ran dark before sunrise.\n\nIt gains the cold; it costs the plainness.`;

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockThreads.mockResolvedValue({ kind: 'threads', threads: [] });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const box = () => host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message MAIA"]')!;
async function mount(extra: Record<string, unknown> = {}) {
  await act(async () => { root.render(React.createElement(WorkConversation, {
    work, manuscriptId: 'fictional-manuscript', sectionId: 'section-a', onClose: jest.fn(), onKeepWords: jest.fn(async () => true), ...extra,
  })); });
}
async function say(text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box(), text);
    box().dispatchEvent(new Event('input', { bubbles: true }));
  });
  const send = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Send')!;
  await act(async () => { send.click(); });
}

test('every turn sends the level the writer selected; with nothing stored it is the smallest (Touch)', async () => {
  mockAsk.mockResolvedValue(thread('A reply.'));
  await mount();
  await say('Can you make this sound more like a book?');
  expect(mockAsk.mock.calls[0][0].exampleLatitude).toBe(1);
});

test('a stored Revision latitude is the level sent: one setting for passage edits and examples', async () => {
  window.localStorage.setItem(LATITUDE_STORAGE_KEY, '3');
  mockAsk.mockResolvedValue(thread('A reply.'));
  await mount();
  await say('Can you make this sound more like a book?');
  expect(mockAsk.mock.calls[0][0].exampleLatitude).toBe(3);
});

test('under an example: the level in plain words, with Lighter and Deeper; none under a reply without one', async () => {
  window.localStorage.setItem(LATITUDE_STORAGE_KEY, '2');
  mockAsk.mockResolvedValue(thread(WITH_EXAMPLE));
  await mount();
  await say('Can you make this sound more like a book?');
  const level = host.querySelector('[data-example-level]')!;
  expect(level.getAttribute('data-example-level')).toBe('2');
  expect(level.textContent).toContain('How much this example may change your words: Line');
  expect(level.textContent).toContain('A sentence may be recast.');
  expect(host.querySelector('[data-example-lighter]')!.textContent).toBe('Lighter (Touch)');
  expect(host.querySelector('[data-example-deeper]')!.textContent).toBe('Deeper (Passage)');

  mockAsk.mockResolvedValue(thread('No example this time.'));
  await say('Thank you.');
  expect(host.querySelector('[data-example-level]')).toBeNull();
});

test('Deeper sends only its words at the next level, remembers the choice, and leaves the box alone', async () => {
  mockAsk.mockResolvedValue(thread(WITH_EXAMPLE));
  await mount();
  await say('Can you make this sound more like a book?');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box(), 'half-written thought');
    box().dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { host.querySelector<HTMLButtonElement>('[data-example-deeper]')!.click(); });
  const sent = mockAsk.mock.calls[1][0];
  expect(sent.question).toBe('Show me a deeper example.');
  expect(sent.exampleLatitude).toBe(2);
  expect(window.localStorage.getItem(LATITUDE_STORAGE_KEY)).toBe('2');
  expect(box().value).toBe('half-written thought');
});

test('at the lightest level, Lighter is not offered as a choice; the pressed words are never offered for Keep my words', async () => {
  mockAsk.mockResolvedValue({ ...thread(WITH_EXAMPLE), thread: { ...thread(WITH_EXAMPLE).thread, turns: [
    { index: 0, speaker: 'author', body: 'Show me a deeper example.', staleness: 'current' },
    { index: 1, speaker: 'maia', body: WITH_EXAMPLE, staleness: 'current' },
  ] } });
  await mount();
  await say('Can you make this sound more like a book?');
  expect(host.querySelector<HTMLButtonElement>('[data-example-lighter]')!.disabled).toBe(true);
  expect(host.querySelector('[data-keep-words-button="0"]')).toBeNull();
});

test('"Not this one" sets the example aside: nothing is sent, the choices close, and it says so', async () => {
  mockAsk.mockResolvedValue(thread(WITH_EXAMPLE));
  await mount();
  await say('Can you make this sound more like a book?');
  await act(async () => { host.querySelector<HTMLButtonElement>('[data-example-set-aside-button]')!.click(); });
  expect(mockAsk).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[data-example-level]')).toBeNull();
  expect(host.querySelector('[data-example-set-aside="1"]')!.textContent).toContain('Nothing was changed, and nothing was sent to MAIA.');
});

test('"Try this on my page" sends only which reply it is; it is not offered where the room cannot take it to a passage', async () => {
  mockAsk.mockResolvedValue(thread(WITH_EXAMPLE));
  const onTry = jest.fn();
  await mount({ onTryExampleOnPage: onTry });
  await say('Can you make this sound more like a book?');
  await act(async () => { host.querySelector<HTMLButtonElement>('[data-example-try-on-page]')!.click(); });
  expect(onTry).toHaveBeenCalledWith({ askThreadId: 'thread-a', turnIndex: 1 });
  expect(mockAsk).toHaveBeenCalledTimes(1);

  act(() => root.unmount()); root = createRoot(host);
  await mount();
  await say('Can you make this sound more like a book?');
  expect(host.querySelector('[data-example-level]')).not.toBeNull();
  expect(host.querySelector('[data-example-try-on-page]')).toBeNull();
});

test('the example is found only by its own line, and levels never step past either end', () => {
  expect(containsExample(WITH_EXAMPLE)).toBe(true);
  expect(containsExample(`She wrote "${WORK_EXAMPLE_LINE}" once.`)).toBe(false);
  expect(stepLatitude(1, 'lighter')).toBe(1);
  expect(stepLatitude(5, 'deeper')).toBe(5);
  expect(stepLatitude(3, 'deeper')).toBe(4);
});
