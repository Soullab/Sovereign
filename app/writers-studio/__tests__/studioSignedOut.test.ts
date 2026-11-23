/**
 * A signed-out Studio room is never a dead end (witnessed 2026-11-16: unreadable "Sign in to open your Writer's
 * Studio." that needed a manual reload). Real component in jsdom for the screen; source checks for the wiring.
 * @jest-environment jsdom
 */
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import StudioSignedOut, { studioSignInHref } from '@/app/dev/writers-studio-pc3-live/StudioSignedOut';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('the sign-in link returns the writer to exactly where they were', () => {
  expect(studioSignInHref({ pathname: '/writers-studio', search: '?path=college-essay&mode=write&m=abc' }))
    .toBe('/signin?next=%2Fwriters-studio%3Fpath%3Dcollege-essay%26mode%3Dwrite%26m%3Dabc');
});

test('the signed-out screen is readable on the navy field and offers Sign in', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {}); // jsdom: "Not implemented: navigation"
  window.history.replaceState(null, '', '/writers-studio?path=college-essay&mode=write');
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(StudioSignedOut)); });
  const main = host.querySelector('[data-studio-signed-out]') as HTMLElement;
  expect(main.style.background).not.toBe('');
  expect(main.style.color).not.toBe('');
  const link = host.querySelector('a') as HTMLAnchorElement;
  expect(link.textContent).toBe('Sign in');
  expect(link.getAttribute('href')).toBe('/signin?next=%2Fwriters-studio%3Fpath%3Dcollege-essay%26mode%3Dwrite');
  act(() => root.unmount());
  host.remove();
});

test.each([
  'P4R1HomeController.tsx', 'P4R1WriteEditController.tsx', 'P4R1DevelopController.tsx',
  'P4R1ReviewController.tsx', 'P4R1HistoryPage.tsx',
])('%s sends a signed-out writer to StudioSignedOut, not a bare sentence', (file) => {
  const src = fs.readFileSync(path.join(__dirname, '../../dev/writers-studio-pc3-live', file), 'utf8');
  expect(src).toMatch(/<StudioSignedOut[ />]/);
  expect(src).not.toMatch(/Sign in to (open|see) /);
});
