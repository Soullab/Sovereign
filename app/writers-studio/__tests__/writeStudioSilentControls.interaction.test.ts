/** @jest-environment jsdom */
/**
 * Guided beta session 2026-11-19 — no silent controls (findings F3, F4).
 *  F3: on a one-section Work, Write's "Next" did nothing at all. It now says there is nowhere to go, and moves nothing.
 *  F4: "Add your theme" with the box empty was disabled without a reason, so a press did nothing visible.
 * Fictional Work, real WriteRoom. NOT an authenticated app/server witness.
 */
import React, { act } from 'react';
import fs from 'fs';
import path from 'path';
import { createRoot, type Root } from 'react-dom/client';
import { WriteRoom, WRITE_MOVE_EDGE_COPY, type WriteRoomLivePorts } from '@/app/writers-studio/full-redesign/WriteRoom';
import { WRITE_COPY } from '@/app/writers-studio/full-redesign/fixtures';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const FIXTURE = {
  work: 'Fictional Work', heading: 'Opening',
  chapters: [{ id: 'section-1', label: 'Opening' }],
  currentChapterId: 'section-1', place: 'Opening', title: 'Opening',
  paragraphs: ['A fictional first line.'], blocks: [{ text: 'A fictional first line.', kind: 'paragraph' as const }],
  saveState: 'Saved', unsaved: 'Unsaved',
};

function mount(live: WriteRoomLivePorts) {
  act(() => root.render(React.createElement(WriteRoom, {
    fixture: FIXTURE, copy: WRITE_COPY, canvas: false, onCanvasChange: () => undefined,
    live: { canonicalBody: 'A fictional first line.', onEditBody: () => undefined, ...live },
  })));
}
const button = (move: 'previous' | 'next') => container.querySelector<HTMLButtonElement>(`[data-move="${move}"]`)!;
const note = () => container.querySelector<HTMLElement>('.fr-write-move-note')!;

describe('Write: Previous / Next never do nothing (F3)', () => {
  test('one-section Work: Next says it is the last section, and moves nothing', () => {
    const onNext = jest.fn();
    mount({ onNext, onPrevious: jest.fn(), hasNext: false, hasPrevious: false });
    expect(button('next').getAttribute('aria-disabled')).toBe('true');
    act(() => button('next').click());
    expect(onNext).not.toHaveBeenCalled();
    expect(note().getAttribute('role')).toBe('status');
    expect(note().textContent).toBe(WRITE_MOVE_EDGE_COPY.next);
  });

  test('first section: Previous says so, and moves nothing', () => {
    const onPrevious = jest.fn();
    mount({ onNext: jest.fn(), onPrevious, hasNext: true, hasPrevious: false });
    act(() => button('previous').click());
    expect(onPrevious).not.toHaveBeenCalled();
    expect(note().textContent).toBe(WRITE_MOVE_EDGE_COPY.previous);
  });

  test('a section to move to: the move happens and no edge note is shown', () => {
    const onNext = jest.fn();
    mount({ onNext, onPrevious: jest.fn(), hasNext: true, hasPrevious: true });
    expect(button('next').hasAttribute('aria-disabled')).toBe(false);
    act(() => button('next').click());
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(note().textContent).toBe('');
  });

  test('the edge note is cleared when the writer is on a different section', () => {
    mount({ onNext: jest.fn(), hasNext: false });
    act(() => button('next').click());
    expect(note().textContent).toBe(WRITE_MOVE_EDGE_COPY.next);
    act(() => root.render(React.createElement(WriteRoom, {
      fixture: { ...FIXTURE, currentChapterId: 'section-2', chapters: [...FIXTURE.chapters, { id: 'section-2', label: 'Two' }] },
      copy: WRITE_COPY, canvas: false, onCanvasChange: () => undefined,
      live: { canonicalBody: 'A fictional first line.', onEditBody: () => undefined, onNext: jest.fn(), hasNext: false },
    })));
    expect(note().textContent).toBe('');
  });

  test('host that does not say (older callers): behaviour unchanged, the move is attempted', () => {
    const onNext = jest.fn();
    mount({ onNext });
    act(() => button('next').click());
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(note().textContent).toBe('');
  });

  test('the live Write host tells the room whether there is a section either side', () => {
    const view = fs.readFileSync(path.resolve(__dirname, '../../dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx'), 'utf8');
    expect(view).toContain('hasPrevious: Boolean(projection.previousId),');
    expect(view).toContain('hasNext: Boolean(projection.nextId),');
  });
});

describe('Develop › Themes: "Add your theme" answers a press with an empty box (F4)', () => {
  /* Source-level: ThemeField is internal to P4R1DevelopView. A jsdom walk of the mounted Develop view is still owed. */
  const src = fs.readFileSync(path.resolve(__dirname, '../../dev/writers-studio-pc3-live/P4R1DevelopView.tsx'), 'utf8');
  const declare = src.slice(src.indexOf('<div className="p4r1-theme-declare">'), src.indexOf('{payload.themes.length === 0'));

  test('the button is no longer disabled merely because the box is empty', () => {
    expect(declare).toContain('disabled={busy}');
    expect(declare).not.toMatch(/disabled=\{busy \|\| !draft\.trim\(\)\}/);
  });

  test('an empty press focuses the box and says what to do, in a status region', () => {
    expect(declare).toMatch(/if \(!label\) \{ setNeedsName\(true\); themeInputRef\.current\?\.focus\(\); return; \}/);
    expect(declare).toContain('role="status"');
    expect(declare).toContain('THEME_NEEDS_NAME_COPY');
    expect(src).toMatch(/export const THEME_NEEDS_NAME_COPY = 'Type a theme in the box first/);
  });

  test('a named theme is still declared exactly as before', () => {
    expect(declare).toContain("onMutation({ action: 'declare', label });");
  });
});
