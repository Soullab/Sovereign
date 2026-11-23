/**
 * A member who already has Works can start a Studio program (founder 2026-11-16, "do both": "Start a College Essay"
 * for existing members such as Nathan). Before this, the essay door appeared only for a member with no Works, so an
 * essay link dropped an existing member on ordinary Home with no way in.
 * Mounts the real P4R1HomeView in jsdom with fictional data. Component-level only: not a browser run.
 * @jest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

jest.mock('@/app/writers-studio/full-redesign/Shell', () => ({
  Shell: ({ work }: { work: React.ReactNode }) => React.createElement('main', { 'data-test-shell': '' }, work),
}));
jest.mock('@/app/writers-studio/useWorkVisual', () => ({ useWorkVisual: () => ({ src: null }) }));
jest.mock('@/app/dev/writers-studio-pc3-live/P4R1WorkMaterialsSummary', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/dev/writers-studio-pc3-live/P4R1ProducePanel', () => ({ __esModule: true, default: () => null }));
// Founder ruling 2026-11-16 (#1900): the essay door first checks the member's age attestation. This member has given one.
jest.mock('@/lib/http/apiBase', () => ({
  apiFetch: jest.fn(async (url: string) => ({ ok: true, json: async () => (String(url).includes('age-attestation') ? { attested: 'adult' } : {}) })),
}));

import P4R1HomeView from '@/app/dev/writers-studio-pc3-live/P4R1HomeView';
import { STUDIO_PATHS, studioPathById } from '@/lib/writersStudio/studioPaths';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const work = {
  id: 'fictional-work-1', title: 'A Fictional Work', purpose: null, form: 'Book',
  stage: 'writing', manuscriptState: 'partial-manuscript',
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z',
  expressions: [{ expressionType: 'manuscript', expressionId: 'fictional-manuscript-1', declaredAt: '2026-10-01T00:00:00Z' }],
  materials: [],
};
const manuscript = {
  id: 'fictional-manuscript-1', title: 'A Fictional Work', createdAt: '2026-10-01T00:00:00Z', sectionCount: 1,
  charCount: 30, keepCount: 0, draftCharCount: 30, hasDraftWriting: true, hasWriting: true,
  hasCurrentMemberContribution: true, lastMemberDraftActivityAt: '2026-10-02T00:00:00Z',
};
const orient = { kind: 'orient', resume: null, alsoWritten: [], shelf: [], feature: null, imported: [] };
const cb = () => ({
  onMode: jest.fn(), onChooseManuscript: jest.fn(), onBegin: jest.fn(), onOpen: jest.fn(),
  onMakeWork: jest.fn(), onAddToWork: jest.fn(), onStartWriting: jest.fn(), onImport: jest.fn(), onSources: jest.fn(),
  onPathBegin: jest.fn(), onStartPath: jest.fn(), onLeavePath: jest.fn(), onDoorLookWithSpark: jest.fn(),
});
const base = {
  appearance: 'night', arrival: orient, works: [work], manuscripts: [manuscript],
  resumeActivity: null, returnWork: null, returnActivity: null,
  markedLines: [], historyActs: [], busy: false, error: null, pendingMode: null,
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

function render(props: Record<string, unknown>) {
  act(() => root.render(React.createElement(P4R1HomeView, { ...base, ...props } as any)));
}

test('every registered program offers its own start on Home for a member with Works', () => {
  const callbacks = cb();
  render({ ...callbacks, studioPath: null });
  for (const path of STUDIO_PATHS) {
    const button = host.querySelector<HTMLButtonElement>(`[data-start-path="${path.id}"]`);
    expect(button?.textContent).toBe(path.startLabel);
    act(() => button!.click());
    expect(callbacks.onStartPath).toHaveBeenCalledWith(path.id);
  }
  expect(host.textContent).toContain('Start a college essay');
});

test('an existing member on an essay link meets the essay door, not ordinary Home', async () => {
  render({ ...cb(), studioPath: studioPathById('college-essay') });
  for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); });
  expect(host.textContent?.toLowerCase()).toContain('college essay');
  expect(host.textContent).toContain(studioPathById('college-essay')!.firstPrompt);
  expect(host.querySelector('.fr-home-field')).toBeNull();
});

test('the first-visit door is unchanged: a member with nothing still gets it through the existing branch', () => {
  render({ ...cb(), studioPath: null, inspirationDoor: false });
  expect(host.querySelector('.fr-home-field')).not.toBeNull();
});
