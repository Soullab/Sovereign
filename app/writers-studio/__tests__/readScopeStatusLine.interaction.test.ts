/** @jest-environment jsdom */
/**
 * Founder ruling 2026-11-19 — "WS B0 + D3 laptop experience". In the conversation, reading permission is one persistent status
 * line: whether saved-Work reading is allowed, Change, and Stop directly visible whenever a permission is active. No choice is put
 * to the writer before they have said anything; it opens under Change, or when they turn to the whole book (offerNow).
 * Status states permission only; what MAIA read for an answer stays D3's per-answer line.
 * Fictional manuscript id, mocked read-scope client. NOT an authenticated app/server witness.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const getReadScope = jest.fn();
const setReadScope = jest.fn();
jest.mock('@/lib/writersStudio/readScopeClient', () => ({
  getReadScope: (...a: unknown[]) => getReadScope(...a),
  setReadScope: (...a: unknown[]) => setReadScope(...a),
}));
let posture: { resolved: boolean; sanctuary?: boolean } = { resolved: true, sanctuary: false };
jest.mock('@/lib/sanctuary/currentClientPosture', () => ({ readCurrentSanctuaryPosture: () => posture }));
jest.mock('@/app/writers-studio/canvas/SessionPostureChoice', () => ({ __esModule: true, default: () => null }));

import ReadScopeControl, { READ_SCOPE_OFFER_COPY } from '@/app/writers-studio/canvas/ReadScopeControl';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  getReadScope.mockReset(); setReadScope.mockReset(); posture = { resolved: true, sanctuary: false };
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function mount(props: { offerNow?: boolean } = {}) {
  await act(async () => { root.render(React.createElement(ReadScopeControl, { manuscriptId: 'fictional-ms', status: true, ...props })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); // let the scope check resolve inside act
}
const buttons = () => [...container.querySelectorAll('button')].map((b) => b.textContent);
const click = async (label: string) => {
  const b = [...container.querySelectorAll('button')].find((x) => x.textContent === label)!;
  await act(async () => { b.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const status = () => container.querySelector('[data-read-scope-status]')?.textContent;

describe('status line — first opening, no permission', () => {
  test('⭐ MUST FAIL IF a reading-permission choice is put to the writer before they have said anything', async () => {
    getReadScope.mockResolvedValue(null);
    await mount();
    expect(status()).toBe('Off');
    expect(buttons()).toEqual(['Change']);
    expect(container.textContent).not.toContain('Let MAIA read my saved work');
  });
  test('Change opens the choice; granting shows Allowed with Stop', async () => {
    getReadScope.mockResolvedValue(null);
    setReadScope.mockResolvedValue({ level: 'work' });
    await mount();
    await click('Change');
    expect(buttons()).toContain('Let MAIA read my saved work');
    await click('Let MAIA read my saved work');
    expect(setReadScope).toHaveBeenCalledWith('fictional-ms', { action: 'grant', level: 'work' });
    expect(status()).toBe('Allowed');
    expect(buttons()).toContain('Stop');
  });
});

describe('status line — permission active', () => {
  test('⭐ MUST FAIL IF an active permission is shown without a directly visible Stop', async () => {
    getReadScope.mockResolvedValue({ level: 'work' });
    await mount();
    expect(status()).toBe('Allowed');
    const stop = container.querySelector('[data-read-scope-stop]');
    expect(stop).not.toBeNull();
    expect(stop!.closest('details')).toBeNull();
    expect(stop!.closest('[data-read-scope-chooser]')).toBeNull();
  });
  test('passage-level permission is named as such, never as the whole Work', async () => {
    getReadScope.mockResolvedValue({ level: 'chapter' });
    await mount();
    expect(status()).toBe('This passage’s saved version');
    expect(buttons()).toContain('Stop');
  });
  test('Stop revokes in one action and the line says Off', async () => {
    getReadScope.mockResolvedValue({ level: 'work' });
    setReadScope.mockResolvedValue(null);
    await mount();
    await click('Stop');
    expect(setReadScope).toHaveBeenCalledWith('fictional-ms', { action: 'revoke' });
    expect(status()).toBe('Off');
    expect(buttons()).not.toContain('Stop');
  });
  test('a failed Stop says nothing changed and keeps Stop', async () => {
    getReadScope.mockResolvedValue({ level: 'work' });
    setReadScope.mockResolvedValue(undefined);
    await mount();
    await click('Stop');
    expect(container.textContent).toContain('Nothing was changed');
    expect(status()).toBe('Allowed');
    expect(buttons()).toContain('Stop');
  });
  test('Sanctuary on: the line still shows the permission and says MAIA reads only the passage now', async () => {
    posture = { resolved: true, sanctuary: true };
    getReadScope.mockResolvedValue({ level: 'work' });
    await mount();
    expect(container.textContent).toContain('Sanctuary is on, so MAIA is reading only the passage you are in.');
    expect(buttons()).toContain('Stop');
  });
});

describe('status line — unavailable', () => {
  test('a failed check never claims Off or Allowed; it says so and offers Try again', async () => {
    getReadScope.mockResolvedValue(undefined);
    await mount();
    expect(status()).toBeUndefined();
    expect(container.textContent).toContain('could not be checked');
    expect(buttons()).toContain('Try again');
  });
});

describe('the choice at the moment it is needed', () => {
  test('turning to the whole book with no permission offers it, once, with Not now', async () => {
    getReadScope.mockResolvedValue(null);
    await mount({ offerNow: true });
    expect(container.textContent).toContain(READ_SCOPE_OFFER_COPY);
    expect(buttons()).toEqual(expect.arrayContaining(['Let MAIA read my saved work', 'Not now']));
    await click('Not now');
    expect(container.textContent).not.toContain(READ_SCOPE_OFFER_COPY);
    expect(setReadScope).not.toHaveBeenCalled();
  });
  test('with a permission already active, the whole book offers nothing new', async () => {
    getReadScope.mockResolvedValue({ level: 'work' });
    await mount({ offerNow: true });
    expect(container.textContent).not.toContain(READ_SCOPE_OFFER_COPY);
  });
});
