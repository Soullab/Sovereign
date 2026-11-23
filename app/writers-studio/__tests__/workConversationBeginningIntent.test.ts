/** @jest-environment jsdom */
/**
 * Newcomer walk 2026-11-23: "Help me find a beginning" put AI instructions in the writer's box
 * under their name. Now it is one press that sends only the button's words with a closed intent.
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
const answered = { ok: true, threadId: 'thread-a', thread: {
  id: 'thread-a', anchor: { on: 'work' }, openedAt: '2026-11-23T10:00:00Z',
  turns: [
    { index: 0, speaker: 'author', body: 'Help me find a beginning.', staleness: 'current' },
    { index: 1, speaker: 'maia', body: 'What would you most want someone to understand?', staleness: 'current' },
  ],
}};

beforeEach(() => {
  jest.clearAllMocks();
  mockThreads.mockResolvedValue({ kind: 'threads', threads: [] });
  mockLoadThread.mockResolvedValue(answered.thread);
  mockAsk.mockResolvedValue(answered);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const box = () => host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message MAIA"]')!;
async function mount(extra: Record<string, unknown>) {
  await act(async () => { root.render(React.createElement(WorkConversation, {
    work, manuscriptId: 'fictional-manuscript', sectionId: 'section-a', onClose: jest.fn(), ...extra,
  })); });
}

test('opened by the beginning button: an offer outside the box, no instruction text anywhere, nothing sent yet', async () => {
  await mount({ startIntent: 'find-a-beginning' });
  expect(host.querySelector('[data-start-intent="find-a-beginning"]')).not.toBeNull();
  expect(box().value).toBe('');
  expect(host.querySelector('[data-composer-starter]')).toBeNull();
  expect(host.textContent).not.toMatch(/Do not assume|handed to you automatically/);
  expect(mockAsk).not.toHaveBeenCalled();
});

test('one press sends only the button\'s words, with the closed intent; the box is untouched', async () => {
  await mount({ startIntent: 'find-a-beginning' });
  await act(async () => { host.querySelector<HTMLButtonElement>('[data-start-intent-send]')!.click(); });
  expect(mockAsk).toHaveBeenCalledTimes(1);
  const sent = mockAsk.mock.calls[0][0];
  expect(sent.question).toBe('Help me find a beginning.');
  expect(sent.studioIntent).toBe('find-a-beginning');
  expect(box().value).toBe('');
  expect(host.querySelector('[data-start-intent]')).toBeNull();
});

test('"Not now" sends nothing and the offer goes', async () => {
  await mount({ startIntent: 'find-a-beginning' });
  await act(async () => { host.querySelector<HTMLButtonElement>('[data-start-intent-dismiss]')!.click(); });
  expect(mockAsk).not.toHaveBeenCalled();
  expect(host.querySelector('[data-start-intent]')).toBeNull();
});

test('the writer\'s own message never carries the intent', async () => {
  await mount({});
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box(), 'I want to write about my father.');
    box().dispatchEvent(new Event('input', { bubbles: true }));
  });
  const send = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Send')!;
  await act(async () => { send.click(); });
  expect(mockAsk.mock.calls[0][0].studioIntent).toBeUndefined();
});
