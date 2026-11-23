/**
 * The Studio doorway's sign-up must leave this browser holding ONLY the new member's session (witnessed 2026-11-16:
 * a stale `maia_session_token` from an earlier member, beside the new account's cookie, was refused by the server as
 * a credential conflict, and the new member landed on "Sign in to open your Writer's Studio").
 * Real component, jsdom, stubbed fetch; not a browser run.
 * @jest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DoorwayJoin } from '../DoorwayJoin';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

function type(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
}

async function walk(registerBody: unknown) {
  global.fetch = jest.fn(async (url: string) => ({
    ok: true,
    json: async () => (String(url).includes('/check') ? { valid: true } : registerBody),
  })) as unknown as typeof fetch;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(DoorwayJoin, {
      studio: 'writer', studioName: 'Writer’s Studio', selectedPath: 'college-essay', returnPath: '/writers-studio?path=college-essay',
    }));
  });
  await act(async () => { type(host.querySelector('#doorway-code') as HTMLInputElement, 'WRITER-TEST-CODE-0000'); });
  await act(async () => { (host.querySelector('form') as HTMLFormElement).requestSubmit(); });
  await flush();
  const inputs = host.querySelectorAll('input');
  await act(async () => {
    type(inputs[0] as HTMLInputElement, 'New Writer');
    type(inputs[1] as HTMLInputElement, 'new@example.com');
    type(inputs[2] as HTMLInputElement, 'throwaway-pass');
  });
  await act(async () => { (host.querySelector('form') as HTMLFormElement).requestSubmit(); });
  await flush();
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('maia_session_token', 'EARLIER-MEMBER-TOKEN');
  jest.spyOn(console, 'error').mockImplementation(() => {}); // jsdom: "Not implemented: navigation"
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.restoreAllMocks();
});

test('a new account replaces an earlier member’s header token with its own', async () => {
  await walk({ success: true, signedIn: true, member: { id: 'm-new' }, next: '/writers-studio?path=college-essay',
    session: { token: 'NEW-MEMBER-TOKEN', expiresAt: '2027-01-01T00:00:00Z' } });
  expect(localStorage.getItem('maia_session_token')).toBe('NEW-MEMBER-TOKEN');
  expect(JSON.parse(localStorage.getItem('beta_user')!).id).toBe('m-new');
});

test('with no token in the reply, the earlier member’s token is removed rather than left to conflict', async () => {
  await walk({ success: true, signedIn: true, member: { id: 'm-new' }, next: '/writers-studio' });
  expect(localStorage.getItem('maia_session_token')).toBeNull();
});
