/**
 * @jest-environment jsdom
 */
/**
 * WS-COLUMNS (founder, 2026-11-21: "They should be expandable/collapsible!").
 * Live walk on soullab.life at 887px: the column dividers were display:none below 1024px and transparent until hover above it, and
 * hide/show lived only inside the Layout menu. Each column now carries its own control; a hidden one leaves a way back at its edge.
 */
import React, { act } from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createRoot, type Root } from 'react-dom/client';

jest.mock('next/navigation', () => ({ usePathname: () => '/writers-studio', useSearchParams: () => new URLSearchParams() }));

import { Shell } from '@/app/writers-studio/full-redesign/Shell';
import { WRITE_GEOMETRY } from '@/app/writers-studio/full-redesign/tokens';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => { localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const shell = () => host.querySelector('.fr-shell')!;
const q = (sel: string) => host.querySelector<HTMLButtonElement>(sel);
function mount(extra: Record<string, unknown> = {}) {
  act(() => root.render(React.createElement(Shell, {
    mode: 'write', appearance: 'evening', geometry: WRITE_GEOMETRY, memberInitial: 'F',
    manuscript: React.createElement('nav', null, 'Fictional chapters'),
    work: React.createElement('article', null, 'Fictional page'),
    maia: React.createElement('div', null, 'MAIA'),
    ...extra,
  } as any)));
}

describe('WS-COLUMNS · each column can be collapsed and expanded from the column itself', () => {
  it('⭐ MUST FAIL IF an open column has no visible control of its own', () => {
    mount();
    expect(q('.fr-manuscript [data-column-collapse="manuscript"]')?.getAttribute('aria-label')).toBe('Hide manuscript panel');
    expect(q('.fr-maia [data-column-collapse="maia"]')?.getAttribute('aria-label')).toBe('Hide MAIA panel');
    expect(q('[data-column-reopen]')).toBeNull();
  });
  it('⭐ MUST FAIL IF hiding a column leaves no way back on screen', () => {
    mount();
    act(() => q('[data-column-collapse="manuscript"]')!.click());
    expect(shell().getAttribute('data-left-open')).toBe('false');
    expect(q('[data-column-collapse="manuscript"]')).toBeNull();
    act(() => q('[data-column-reopen="manuscript"]')!.click());
    expect(shell().getAttribute('data-left-open')).toBe('true');

    act(() => q('[data-column-collapse="maia"]')!.click());
    expect(shell().getAttribute('data-right-open')).toBe('false');
    act(() => q('[data-column-reopen="maia"]')!.click());
    expect(shell().getAttribute('data-right-open')).toBe('true');
  });
  it('the column control and the Layout menu drive the same state (nothing new is stored)', () => {
    mount();
    act(() => q('[data-column-collapse="maia"]')!.click());
    const layoutToggle = Array.from(host.querySelectorAll<HTMLButtonElement>('.fr-panel-controls button')).find((b) => b.textContent?.includes('MAIA'))!;
    expect(layoutToggle.getAttribute('aria-label')).toBe('Show MAIA panel');
    act(() => layoutToggle.click());
    expect(q('[data-column-collapse="maia"]')).not.toBeNull();
  });
  it('a room with no side columns (canvas) shows no column controls', () => {
    mount({ canvas: true });
    expect(q('[data-column-collapse]')).toBeNull();
    expect(q('[data-column-reopen]')).toBeNull();
  });
});

describe('WS-COLUMNS · the layout rules (static)', () => {
  const css = readFileSync(join(process.cwd(), 'app/dev/writers-studio-full-redesign-review/full-redesign-review.css'), 'utf8');
  it('⭐ MUST FAIL IF the divider grip is transparent until hovered again', () => {
    const after = css.slice(css.indexOf('.fr-panel-splitter::after {'), css.indexOf('}', css.indexOf('.fr-panel-splitter::after {')));
    expect(after).not.toMatch(/background:\s*transparent/);
  });
  it('below 1024px a hidden column is removed from the layout, so the manuscript band leaves no empty space', () => {
    const start = css.indexOf('@media (max-width: 1023px)');
    const narrow = css.slice(start, css.indexOf('\n}\n', start) + 2);   // the whole media block, to its closing brace
    expect(narrow).toMatch(/data-left-open='false'\] \.fr-manuscript[^{]*\{ display: none; \}/);
  });
  it('the column controls are hidden only on phones (<=720px), never between 721px and 1023px', () => {
    expect(css).toMatch(/@media \(max-width: 720px\) \{\s*\.fr-collapse, \.fr-reopen \{ display: none; \}/);
    const narrow = css.slice(css.indexOf('@media (max-width: 1023px)'), css.indexOf('@media (max-width: 1023px)') + 400);
    expect(narrow).not.toMatch(/fr-collapse|fr-reopen/);
  });
});
