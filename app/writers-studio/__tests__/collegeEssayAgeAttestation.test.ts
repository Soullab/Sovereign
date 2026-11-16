/**
 * Founder ruling 2026-11-16 (#1900): "if minors are using they must check off that they are under adult supervision" and
 * "Yes, block under 13". The library, the attestation route, and the door as the member meets it.
 * Real components and route handlers in jsdom/node with stubbed database and fetch; not a browser run.
 * @jest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const query = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...a: unknown[]) => query(...a) }));
const apiFetch = jest.fn();
jest.mock('@/lib/http/apiBase', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { ageAttestationAdmits, latestAgeAttestation } from '@/lib/studios/ageAttestationRead';
import { parseAttestation } from '@/lib/studios/ageAttestation';
import { studioPathById } from '@/lib/writersStudio/studioPaths';
import StudioInspirationOpening from '@/app/dev/writers-studio-pc3-live/StudioInspirationOpening';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const ME = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

describe('the library', () => {
  test('only an adult, or a minor who ticked supervision, is a valid attestation', () => {
    expect(parseAttestation({ band: 'adult' })).toEqual({ band: 'adult' });
    expect(parseAttestation({ band: 'minor', supervised: true })).toEqual({ band: 'minor', supervised: true });
    for (const bad of [{ band: 'minor' }, { band: 'minor', supervised: false }, { band: 'minor', supervised: 'yes' },
      { band: 'under_13' }, { band: 'child' }, {}, null, 'adult', []]) {
      expect(parseAttestation(bad)).toBeNull();
    }
  });

  test('admission: adult or supervised minor; nothing else, and an unreadable record never admits', async () => {
    expect(ageAttestationAdmits({ band: 'adult', supervised: false })).toBe(true);
    expect(ageAttestationAdmits({ band: 'minor', supervised: true })).toBe(true);
    expect(ageAttestationAdmits({ band: 'minor', supervised: false })).toBe(false);
    expect(ageAttestationAdmits(null)).toBe(false);
    expect(ageAttestationAdmits('unknown')).toBe(false);
    query.mockRejectedValueOnce(new Error('db down'));
    expect(await latestAgeAttestation(ME)).toBe('unknown');
    query.mockResolvedValueOnce({ rows: [{ age_band: 'something', supervision_attested: true }] });
    expect(await latestAgeAttestation(ME)).toBe('unknown');
    query.mockResolvedValueOnce({ rows: [] });
    expect(await latestAgeAttestation(ME)).toBeNull();
  });

  test('College Essay requires it; the registry says so', () => {
    expect(studioPathById('college-essay')!.requiresAgeAttestation).toBe(true);
  });
});

describe('the door as the member meets it', () => {
  let host: HTMLDivElement;
  let root: Root;
  const essay = studioPathById('college-essay');
  const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === label) as HTMLButtonElement | undefined;
  async function flush() { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); }
  async function mount(attested: 'adult' | 'minor' | null) {
    apiFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (url.includes('age-attestation') && (!init || init.method === 'GET')) return { ok: true, json: async () => ({ attested }) };
      if (url.includes('age-attestation')) return { ok: true, status: 204, json: async () => ({}) };
      return { ok: true, json: async () => ({ reply: 'Am I hearing that right?' }) };
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(React.createElement(StudioInspirationOpening, { busy: false, error: null, studioPath: essay, onPathBegin: jest.fn() })); });
    await flush();
  }
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const posts = () => apiFetch.mock.calls.filter(([u, i]) => String(u).includes('age-attestation') && i?.method === 'POST');

  test('not yet attested: MAIA’s question is not shown; the age question is', async () => {
    await mount(null);
    expect(host.querySelector('[data-age-gate="ask"]')).not.toBeNull();
    expect(host.textContent).toContain('Before we begin: how old are you?');
    expect(host.textContent).not.toContain(essay!.firstPrompt);
  });

  test('under 13: turned away kindly, and NOTHING is sent or saved', async () => {
    await mount(null);
    await act(async () => { button('I’m under 13')!.click(); });
    expect(host.textContent).toContain('College Essay Studio is for students 13 and older.');
    expect(host.textContent).toContain('Nothing about you has been saved.');
    expect(posts()).toHaveLength(0);
    expect(host.textContent).not.toContain(essay!.firstPrompt);
  });

  test('13–17: Continue stays disabled until the supervision box is ticked; then it records and opens the door', async () => {
    await mount(null);
    await act(async () => { button('I’m 13 to 17')!.click(); });
    expect(button('Continue')!.disabled).toBe(true);
    await act(async () => { button('Continue')!.click(); });
    expect(posts()).toHaveLength(0);
    await act(async () => { (host.querySelector('[data-age-supervised]') as HTMLInputElement).click(); });
    expect(button('Continue')!.disabled).toBe(false);
    await act(async () => { button('Continue')!.click(); });
    await flush();
    expect(JSON.parse(posts()[0]![1].body)).toEqual({ band: 'minor', supervised: true, path: 'college-essay' });
    expect(host.textContent).toContain(essay!.firstPrompt);
  });

  test('18+: one tap records it and opens the door', async () => {
    await mount(null);
    await act(async () => { button('I’m 18 or older')!.click(); });
    await flush();
    expect(JSON.parse(posts()[0]![1].body)).toEqual({ band: 'adult', path: 'college-essay' });
    expect(host.textContent).toContain(essay!.firstPrompt);
  });

  test('already attested: never asked again', async () => {
    await mount('minor');
    expect(host.querySelector('[data-age-gate]')).toBeNull();
    expect(host.textContent).toContain(essay!.firstPrompt);
  });

  test('the generic door (no program) never asks', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(React.createElement(StudioInspirationOpening, { busy: false, error: null })); });
    await flush();
    expect(host.querySelector('[data-age-gate]')).toBeNull();
    expect(apiFetch.mock.calls.some(([u]) => String(u).includes('age-attestation'))).toBe(false);
  });
});
