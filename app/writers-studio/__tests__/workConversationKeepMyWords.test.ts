/** @jest-environment jsdom */
/**
 * KEEP MY WORDS (founder standard 2026-11-23; newcomer walk): a writer's own message can go
 * onto their page exactly as written, in one deliberate press. Never MAIA's words.
 * Review of #2383: placement is remembered per CONVERSATION, and the note claims placement,
 * never saving (the page's own status line is the authority on saving).
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
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
const work = { id: 'fictional-work', title: 'Untitled Work' } as LivingWork;
/* Fictional, with a line break and punctuation that must survive exactly. */
const WRITER_WORDS = 'That losing my father at twelve didn’t make me sad so much as quiet.\nI stopped drawing — nobody asked why.';
const SECOND_WORDS = 'A different conversation, a different first message.';
const PLACED = 'Placed on your page, exactly as you wrote it. It saves like anything you type.';

const thread = (id: string, writer: string, maia: string) => ({ ok: true, threadId: id, thread: {
  id, anchor: { on: 'work' }, openedAt: '2026-11-23T10:00:00Z',
  turns: [
    { index: 0, speaker: 'author', body: writer, staleness: 'current' },
    { index: 1, speaker: 'maia', body: maia, staleness: 'current' },
  ],
}});
const first = thread('thread-a', WRITER_WORDS, 'Quiet rather than sad. [[studio:new-conversation]]');

beforeEach(() => {
  jest.clearAllMocks();
  mockThreads.mockResolvedValue({ kind: 'threads', threads: [] });
  mockLoadThread.mockResolvedValue(first.thread);
  mockAsk.mockResolvedValue(first);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });

const box = () => host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message MAIA"]')!;
async function say(words: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box(), words);
    box().dispatchEvent(new Event('input', { bubbles: true }));
  });
  const send = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Send')!;
  await act(async () => { send.click(); });
}
async function mount(onKeepWords?: (text: string) => Promise<boolean | 'saving'> | boolean | 'saving') {
  await act(async () => { root.render(React.createElement(WorkConversation, {
    work, manuscriptId: 'fictional-manuscript', sectionId: 'section-a', onClose: jest.fn(),
    ...(onKeepWords ? { onKeepWords } : {}),
  })); });
}
const keepButtons = () => Array.from(host.querySelectorAll<HTMLButtonElement>('[data-keep-words-button]'));

test('the writer\'s own message can be kept, exactly as written — and the note claims placement, not saving', async () => {
  const onKeepWords = jest.fn(async () => true);
  await mount(onKeepWords); await say(WRITER_WORDS);
  expect(keepButtons()).toHaveLength(1);
  expect(keepButtons()[0].getAttribute('data-keep-words-button')).toBe('0'); // the writer's turn, not MAIA's
  await act(async () => { keepButtons()[0].click(); });
  expect(onKeepWords).toHaveBeenCalledWith(WRITER_WORDS);
  expect(host.textContent).toContain(PLACED);
  expect(host.querySelector('[data-keep-words-done]')?.textContent).not.toMatch(/\bsaved\b/i);
});

test('when the page cannot take them yet, nothing is claimed', async () => {
  await mount(jest.fn(async () => 'saving' as const)); await say(WRITER_WORDS);
  await act(async () => { keepButtons()[0].click(); });
  expect(host.textContent).not.toContain('Placed on your page');
  expect(host.textContent).toContain('Your page is still saving. Try again in a moment; nothing was changed.');
});

test('a new conversation does not inherit "placed" from the last one (turn numbers restart)', async () => {
  await mount(jest.fn(async () => true)); await say(WRITER_WORDS);
  await act(async () => { keepButtons()[0].click(); });
  expect(host.textContent).toContain(PLACED);
  // Start a new conversation in the same Work, whose first message is also turn 0.
  await act(async () => { host.querySelector<HTMLButtonElement>('[data-studio-action="new-conversation"]')!.click(); });
  mockAsk.mockResolvedValue(thread('thread-b', SECOND_WORDS, 'A new beginning.'));
  await say(SECOND_WORDS);
  expect(host.textContent).toContain(SECOND_WORDS);
  expect(host.textContent).not.toContain(PLACED);
  expect(keepButtons().map((b) => b.getAttribute('data-keep-words-button'))).toEqual(['0']);
});

test('when the words could not be placed at all, the note says so and does not blame saving', async () => {
  await mount(jest.fn(async () => false)); await say(WRITER_WORDS);
  await act(async () => { keepButtons()[0].click(); });
  expect(host.textContent).not.toContain('Placed on your page');
  expect(host.textContent).not.toContain('still saving');
  expect(host.textContent).toContain('These words could not be placed on this page. Nothing was changed.');
});

test('MAIA\'s words are never offered for keeping', async () => {
  await mount(jest.fn(async () => true)); await say(WRITER_WORDS);
  expect(host.querySelector('[data-keep-words-button="1"]')).toBeNull();
});

test('no host, no button', async () => {
  await mount(); await say(WRITER_WORDS);
  expect(keepButtons()).toHaveLength(0);
});
