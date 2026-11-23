/** @jest-environment jsdom */
/**
 * KEEP MY WORDS (founder standard 2026-11-23; newcomer walk): a writer's own message can go
 * onto their page exactly as written, in one deliberate press. Never MAIA's words.
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
const response = { ok: true, threadId: 'thread-a', thread: {
  id: 'thread-a', anchor: { on: 'work' }, openedAt: '2026-11-23T10:00:00Z',
  turns: [
    { index: 0, speaker: 'author', body: WRITER_WORDS, staleness: 'current' },
    { index: 1, speaker: 'maia', body: 'Quiet rather than sad. That is a particular thing.', staleness: 'current' },
  ],
}};

beforeEach(() => {
  jest.clearAllMocks();
  mockThreads.mockResolvedValue({ kind: 'threads', threads: [] });
  mockLoadThread.mockResolvedValue(response.thread);
  mockAsk.mockResolvedValue(response);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });

async function converse(onKeepWords?: (text: string) => Promise<boolean> | boolean) {
  await act(async () => { root.render(React.createElement(WorkConversation, {
    work, manuscriptId: 'fictional-manuscript', sectionId: 'section-a', onClose: jest.fn(),
    ...(onKeepWords ? { onKeepWords } : {}),
  })); });
  const box = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message MAIA"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, WRITER_WORDS);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const send = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Send')!;
  await act(async () => { send.click(); });
}
const keepButtons = () => Array.from(host.querySelectorAll<HTMLButtonElement>('[data-keep-words-button]'));

test('the writer\'s own message can be kept, exactly as written', async () => {
  const onKeepWords = jest.fn(async () => true);
  await converse(onKeepWords);
  expect(keepButtons()).toHaveLength(1);
  expect(keepButtons()[0].getAttribute('data-keep-words-button')).toBe('0'); // the writer's turn, not MAIA's
  await act(async () => { keepButtons()[0].click(); });
  expect(onKeepWords).toHaveBeenCalledWith(WRITER_WORDS);
  expect(host.textContent).toContain('On your page, exactly as you wrote it.');
});

test('when the page cannot take them yet, nothing is claimed', async () => {
  await converse(jest.fn(async () => false));
  await act(async () => { keepButtons()[0].click(); });
  expect(host.textContent).not.toContain('On your page');
  expect(host.textContent).toContain('Your page is still saving. Try again in a moment; nothing was changed.');
});

test('MAIA\'s words are never offered for keeping', async () => {
  await converse(jest.fn(async () => true));
  expect(host.querySelector('[data-keep-words-button="1"]')).toBeNull();
});

test('no host, no button', async () => {
  await converse();
  expect(keepButtons()).toHaveLength(0);
});
