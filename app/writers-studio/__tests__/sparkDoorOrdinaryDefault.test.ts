/**
 * The Spark door starts in Ordinary when nothing is set yet (founder ruling 2026-11-16; Sanctuary invariant 5:
 * "Default off"). An unreadable setting still keeps nothing. Real component, jsdom; not a browser run.
 * @jest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import StudioInspirationOpening from '@/app/dev/writers-studio-pc3-live/StudioInspirationOpening';
const LIVE_SESSION_SETTINGS_KEY = 'maia_settings'; // lib/sanctuary/currentClientPosture.ts

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(StudioInspirationOpening, { busy: false, error: null })); });
}
const pressed = (label: string) =>
  [...host.querySelectorAll('button')].find(b => b.textContent === label)?.getAttribute('aria-pressed');

beforeEach(() => localStorage.clear());
afterEach(() => { act(() => root.unmount()); host.remove(); });

test('a browser with no session setting starts in Ordinary, Sanctuary one tap away', async () => {
  await mount();
  expect(pressed('Ordinary')).toBe('true');
  expect(pressed('Sanctuary')).toBe('false');
  expect(JSON.parse(localStorage.getItem(LIVE_SESSION_SETTINGS_KEY)!).sanctuary).toBe(false);
});

test('an existing Sanctuary choice is respected, never overwritten', async () => {
  localStorage.setItem(LIVE_SESSION_SETTINGS_KEY, JSON.stringify({ sanctuary: true }));
  await mount();
  expect(pressed('Sanctuary')).toBe('true');
  expect(JSON.parse(localStorage.getItem(LIVE_SESSION_SETTINGS_KEY)!).sanctuary).toBe(true);
});

test('an unreadable setting is not overwritten and stays unknown (keeps nothing)', async () => {
  localStorage.setItem(LIVE_SESSION_SETTINGS_KEY, '{not json');
  await mount();
  expect(pressed('Ordinary')).toBe('false');
  expect(pressed('Sanctuary')).toBe('false');
  expect(localStorage.getItem(LIVE_SESSION_SETTINGS_KEY)).toBe('{not json');
});
