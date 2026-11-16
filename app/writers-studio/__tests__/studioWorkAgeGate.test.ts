/**
 * Walk 2026-11-16 (#1900): an existing College Essay Work opened straight into the Studio with no age question. The age
 * question now stands in front of any room of a Work whose recorded program requires it. Real component; stubbed fetch.
 * @jest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const apiFetch = jest.fn();
jest.mock('@/lib/http/apiBase', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
import StudioWorkAgeGate from '@/app/dev/writers-studio-pc3-live/StudioWorkAgeGate';

let root: Root; let host: HTMLDivElement;
beforeEach(() => { apiFetch.mockReset(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
async function mount(workId: string | null) {
  act(() => root.render(React.createElement(StudioWorkAgeGate, { workId }, React.createElement('p', { 'data-room': true }, 'the room'))));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}
const room = () => host.querySelector('[data-room]');
const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === text) as HTMLButtonElement;

test('⭐ a College Essay Work with no answer: the age question, and the room does not open', async () => {
  apiFetch.mockResolvedValueOnce(json(200, { attested: null, required: true }));
  await mount('w1');
  expect(apiFetch.mock.calls[0][0]).toBe('/api/sovereign/writers-studio/age-attestation?work=w1');
  expect(room()).toBeNull();
  expect(host.textContent).toContain('Before we begin: how old are you?');
});

test('an adult answers once, and the room opens', async () => {
  apiFetch.mockResolvedValueOnce(json(200, { attested: null, required: true })).mockResolvedValueOnce({ ok: true, status: 204 });
  await mount('w1');
  await act(async () => { button('I’m 18 or older').click(); await Promise.resolve(); await Promise.resolve(); });
  expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toEqual({ band: 'adult' });
  expect(room()).not.toBeNull();
});

test('13 to 17: Continue stays disabled until the supervision tick; then a supervised minor is recorded', async () => {
  apiFetch.mockResolvedValueOnce(json(200, { attested: null, required: true })).mockResolvedValueOnce({ ok: true, status: 204 });
  await mount('w1');
  act(() => button('I’m 13 to 17').click());
  expect(button('Continue').disabled).toBe(true);
  act(() => (host.querySelector('[data-age-supervised]') as HTMLInputElement).click());
  await act(async () => { button('Continue').click(); await Promise.resolve(); await Promise.resolve(); });
  expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toEqual({ band: 'minor', supervised: true });
  expect(room()).not.toBeNull();
});

test('under 13: turned away, nothing is sent, the room stays closed', async () => {
  apiFetch.mockResolvedValueOnce(json(200, { attested: null, required: true }));
  await mount('w1');
  act(() => button('I’m under 13').click());
  expect(host.textContent).toContain('College Essay Studio is for students 13 and older.');
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(room()).toBeNull();
});

test('already answered, or a Work outside the program: the room opens with no question', async () => {
  apiFetch.mockResolvedValueOnce(json(200, { attested: 'minor', required: true }));
  await mount('w1');
  expect(room()).not.toBeNull();
  act(() => root.unmount()); root = createRoot(host);
  apiFetch.mockResolvedValueOnce(json(200, { attested: null, required: false }));
  await mount('w2');
  expect(room()).not.toBeNull();
});

test('no Work in view: nothing to check, the room opens', async () => {
  await mount(null);
  expect(apiFetch).not.toHaveBeenCalled();
  expect(room()).not.toBeNull();
});

test('fails closed: a check that cannot be made keeps the room closed and offers to try again', async () => {
  apiFetch.mockResolvedValueOnce(json(503, { error: 'unavailable' }));
  await mount('w1');
  expect(room()).toBeNull();
  expect(host.textContent).toContain('This couldn’t be checked just now. Nothing was saved.');
  expect(button('Try again')).toBeTruthy();
});
