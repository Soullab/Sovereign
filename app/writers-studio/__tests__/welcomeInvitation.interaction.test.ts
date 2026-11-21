/**
 * @jest-environment jsdom
 */
/**
 * WS-WELCOME-01 (founder, 2026-11-21: "the more we can guide our new writers initially the better").
 * The invitation greets the signed-in writer from their own account, names no member in source, collects nothing,
 * and does not promise what is not live.
 */
import React, { act } from 'react';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createRoot, type Root } from 'react-dom/client';

jest.mock('@/app/writers-studio/welcome/welcome.module.css', () => new Proxy({}, { get: (_t, k) => String(k) }));
const mockIdentity = jest.fn();
jest.mock('@/app/writers-studio/useMemberIdentity', () => ({ useMemberIdentity: () => mockIdentity() }));

import { WelcomeInvitation, greetingName } from '@/app/writers-studio/welcome/WelcomeInvitation';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const mount = () => act(() => root.render(React.createElement(WelcomeInvitation)));
const q = (sel: string) => host.querySelector<HTMLElement>(sel);

describe('WS-WELCOME-01 · the invitation a new writer is sent to', () => {
  it('greets a signed-in writer by the first name on their own account, and opens the Studio', () => {
    mockIdentity.mockReturnValue({ phase: 'ready', memberId: 'm-1', name: 'Fictional Writer Person' });
    mount();
    expect(q('[data-welcome-greeting]')!.textContent).toBe('Fictional, your writing has more in it than you remember.');
    expect(q('[data-welcome-cta="studio"]')!.getAttribute('href')).toBe('/writers-studio');
  });
  it('⭐ MUST FAIL IF a signed-out visitor is greeted by name or sent straight into the Studio', () => {
    mockIdentity.mockReturnValue({ phase: 'unauthorized', memberId: null, name: null });
    mount();
    expect(q('[data-welcome-greeting]')!.textContent).toBe('Your writing has more in it than you remember.');
    expect(q('[data-welcome-cta="studio"]')).toBeNull();
    expect(q('[data-welcome-cta="signin"]')!.getAttribute('href')).toBe('/signin');
    expect(q('[data-welcome-cta="begin"]')!.getAttribute('href')).toBe('/begin');
  });
  it('choosing where to begin shows that path, and only that path', () => {
    mockIdentity.mockReturnValue({ phase: 'ready', memberId: 'm-1', name: null });
    mount();
    expect(q('[data-welcome-greeting]')!.textContent).toBe('Your writing has more in it than you remember.');
    expect(q('[data-welcome-journey]')).toBeNull();
    act(() => q('[data-welcome-path="return"]')!.click());
    expect(q('[data-welcome-journey]')!.getAttribute('data-welcome-journey')).toBe('return');
    expect(q('[data-welcome-path="return"]')!.getAttribute('aria-pressed')).toBe('true');
    act(() => q('[data-welcome-path="both"]')!.click());
    expect(host.querySelectorAll('[data-welcome-journey]').length).toBe(1);
    expect(q('[data-welcome-journey]')!.getAttribute('data-welcome-journey')).toBe('both');
  });
  it('greetingName never invents a name', () => {
    expect(greetingName(null)).toBeNull();
    expect(greetingName('   ')).toBeNull();
    expect(greetingName(' Ada  Lovelace ')).toBe('Ada');
  });
});

describe('WS-WELCOME-01 · source discipline (static)', () => {
  const dir = join(process.cwd(), 'app/writers-studio/welcome');
  const src = readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  it('⭐ MUST FAIL IF the page collects, stores or reports anything about the visitor', () => {
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|<form|method: 'POST'|sendBeacon|analytics|track\(/);
    expect(code).not.toMatch(/apiFetch\(|fetch\(/);   // identity comes only through useMemberIdentity
  });
  it('⭐ MUST FAIL IF the page promises automatic fixing, or hides where MAIA’s reading goes', () => {
    expect(code).not.toMatch(/MAIA (will )?(fix|fixes|polish|rewrite)s? your/i);
    expect(code).toContain('Not automatically.');
    expect(code).toContain("Anthropic's Claude");
  });
});
