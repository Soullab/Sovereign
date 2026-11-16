/**
 * College Essay live walk (production 82895ac1a, 2026-11-16) — three polish findings, founder "fix all":
 *   1. the age gate's disabled Continue looked clickable;
 *   2. a stage note's "Saved." never showed (a re-render reset it at once);
 *   3. "Show MAIA this note" on a Work with several conversations filled the box, but Send silently waited for a choice.
 * Real components in jsdom with stubbed clients; not a browser run.
 * @jest-environment jsdom
 */
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const apiFetch = jest.fn();
jest.mock('@/lib/http/apiBase', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
const threadsOn = jest.fn();
jest.mock('@/lib/writersStudio/askClient', () => ({
  ...jest.requireActual('@/lib/writersStudio/askClient'),
  threadsOn: (...a: unknown[]) => threadsOn(...a),
  threadsOnLivingWorkAsk: (...a: unknown[]) => threadsOn(...a),
  loadThread: jest.fn(async () => ({ ok: false })),
}));
jest.mock('@/app/writers-studio/useMemberIdentity', () => ({ useMemberIdentity: () => ({ phase: 'ready', memberId: 'm1' }) }));
jest.mock('@/app/writers-studio/useManuscriptKeeps', () => ({ useManuscriptKeeps: () => ({ keeps: [] }) }));

import StudioStageCard from '@/app/dev/writers-studio-pc3-live/StudioStageCard';
import { studioPathById } from '@/lib/writersStudio/studioPaths';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no layout: the conversation scrolls its latest turn into view.
Element.prototype.scrollIntoView = function scrollIntoView() { /* no layout in jsdom */ };
const essay = studioPathById('college-essay')!;
let host: HTMLDivElement;
let root: Root;
async function flush() { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); }
beforeEach(() => { jest.clearAllMocks(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });

test('1 · a disabled button at the age gate looks disabled', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'app/dev/writers-studio-pc3-live/inspiration-opening.css'), 'utf8');
  expect(css).toMatch(/\.wsio-age button:disabled \{[^}]*opacity: \.45;[^}]*cursor: not-allowed;/);
});

test('2 · after saving a stage note the writer sees "Saved." (and it stays)', async () => {
  apiFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (String(url).endsWith('/stage-notes') && (!init || init.method === 'GET')) return { ok: true, json: async () => ({ notes: [] }) };
    return { ok: true, json: async () => ({ note: {} }) };
  });
  await act(async () => { root.render(React.createElement(StudioStageCard, { workId: 'w1', program: essay, declaredStage: 'meaning', draftWords: 0, onShowMaia: jest.fn() })); });
  await flush();
  const box = host.querySelector('textarea') as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, 'Maybe brave isn’t loud.');
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { box.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
  await flush();
  expect(host.querySelector('.p4r1-stage-private')!.textContent).toContain('Saved.');
  expect(box.value).toBe('Maybe brave isn’t loud.');
});

describe('3 · a note the writer shows MAIA never waits silently on a conversation choice', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WorkConversation = () => require('@/app/writers-studio/canvas/WorkConversation').default;
  const work = { id: 'w1', title: 'Essay', studioPath: 'college-essay', expressions: [], materials: [] };
  const twoThreads = { kind: 'ok', threads: [{ id: 't1', turnCount: 4, lastAt: '2026-11-15' }, { id: 't2', turnCount: 2, lastAt: '2026-11-15' }] };
  async function mount(startFresh: boolean) {
    threadsOn.mockResolvedValue(twoThreads);
    await act(async () => {
      root.render(React.createElement(WorkConversation(), { work, manuscriptId: 'ms1', sectionId: 's1', initialDraft: 'From my Meaning notes: brave isn’t loud.', onClose: jest.fn(), startFresh }));
    });
    await flush();
  }

  test('with startFresh, several conversations begin a new one: no "Send waits until you do"', async () => {
    await mount(true);
    expect(host.querySelector('[data-discovery="choose"]')).toBeNull();
    expect(host.textContent).not.toContain('Send waits until you do');
  });

  test('without it (any other opening), the existing choice is unchanged', async () => {
    await mount(false);
    expect(host.querySelector('[data-discovery="choose"]')).not.toBeNull();
  });

  test('the Write room passes startFresh only for the note the writer chose to show', () => {
    const view = fs.readFileSync(path.join(process.cwd(), 'app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx'), 'utf8');
    expect(view).toContain('onShowMaia={(text) => { setStageNoteStarter(text); openWorkConversation(text); }}');
    expect(view).toContain('startFresh={stageNoteStarter !== null && workConversationStarter === stageNoteStarter}');
  });
});
