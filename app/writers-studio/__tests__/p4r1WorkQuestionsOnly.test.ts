/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import IsolatedEditorialRoom from '@/app/dev/writers-studio-pc3-live/IsolatedEditorialRoom';

/**
 * Work-wide "MAIA asks, never rewrites" in the live Studio's Focus Preferences
 * (ledger #1938, 2026-11-13). Before this, the control lived only in the Canvas
 * Work drawer, which the live Studio never mounts, so a writer could not reach it.
 */

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root; let host: HTMLDivElement;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

function renderRoom(extra: Record<string, unknown>) {
  act(() => root.render(React.createElement(IsolatedEditorialRoom, {
    appearance: 'evening', title: 'Fire', currentText: 'x', sectionBody: 'x', busy: false,
    editingLatitude: 2, onEditingLatitude: jest.fn(), mayRemoveParagraphs: false, onMayRemoveParagraphs: jest.fn(),
    mayProposeImmediately: false, onMayProposeImmediately: jest.fn(), onClose: jest.fn(),
    children: React.createElement('div'), ...extra,
  } as any)));
}

describe('Work-wide "MAIA asks, never rewrites" in Focus Preferences', () => {
  it('is in Preferences, reflects the saved setting and reports the writer’s choice', () => {
    const onPauseWorkRevisions = jest.fn();
    renderRoom({ workRevisionsPaused: false, onPauseWorkRevisions });
    const box = host.querySelector<HTMLInputElement>('[data-pause-work-revisions] input')!;
    expect(box.closest('.p4r1-isolated-preferences')).not.toBeNull();
    expect(box.checked).toBe(false);
    expect(host.querySelector('[data-pause-work-revisions]')!.textContent).toContain('MAIA asks, never rewrites');
    act(() => box.click());
    expect(onPauseWorkRevisions).toHaveBeenCalledWith(true);
  });

  it('shows the saved "on" state, and a save error, without changing it', () => {
    renderRoom({ workRevisionsPaused: true, onPauseWorkRevisions: jest.fn(), workPauseError: 'Could not save that just now. Nothing changed.' });
    expect(host.querySelector<HTMLInputElement>('[data-pause-work-revisions] input')!.checked).toBe(true);
    expect(host.querySelector('[data-pause-work-revisions] [role="alert"]')!.textContent).toContain('Nothing changed');
  });

  it('is disabled while a save is in flight', () => {
    renderRoom({ workRevisionsPaused: false, onPauseWorkRevisions: jest.fn(), workPauseSaving: true });
    expect(host.querySelector<HTMLInputElement>('[data-pause-work-revisions] input')!.disabled).toBe(true);
  });

  it('without a Work the control is absent (unchanged room)', () => {
    renderRoom({});
    expect(host.querySelector('[data-pause-work-revisions]')).toBeNull();
  });
});

describe('the live view wires it to the member’s own Work setting', () => {
  const view = read('app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx');
  it('saves through the member Work PATCH, never anything else', () => {
    expect(view).toMatch(/apiFetch\(`\/api\/sovereign\/living-works\/\$\{workId\}`/);
    expect(view).toMatch(/JSON\.stringify\(\{ maiaRevisionsPaused: paused \}\)/);
  });
  it('NEGATIVE: while the Work is paused, every request is reply-only and the passage pause cannot re-open wording', () => {
    expect(view).toMatch(/const revisionsPaused = passageRevisionsPaused \|\| workRevisionsPaused;/);
    expect(view).toMatch(/pausedSendOptions\(options, revisionsPaused\)/);
    expect(view).toMatch(/onPauseRevisions=\{heldKey && !workRevisionsPaused \?/);
  });
  it('starts from the saved setting, not a default', () => {
    expect(view).toMatch(/useState\(props\.work\?\.maiaRevisionsPaused === true\)/);
  });
});

describe('the selection menu honours the Work-wide setting (live walk finding, 2026-11-13)', () => {
  const view = read('app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx');
  it('NEGATIVE: "Show me an edit" is not offered while the Work is questions-only; a plain note is', () => {
    const menu = view.slice(view.indexOf('or let MAIA offer'), view.indexOf('Teach me the craft'));
    expect(menu).toMatch(/\{workRevisionsPaused \? \(\s*<p[^>]*data-questions-only-note>MAIA asks, never rewrites: on for this Work<\/p>\s*\) : \(\s*<button[^>]*data-passage-choice="revise"/);
  });
  it('every passage act, sent now or held behind a gate, goes through the Work pause', () => {
    const run = view.slice(view.indexOf('const runPassageAct = '), view.indexOf('const runPassageAct = ') + 900);
    expect(run).toMatch(/options: pausedSendOptions\(requested\.options, workRevisionsPaused\)/);
    expect(run).toMatch(/props\.onSendEditorial\(act\.prompt, act\.options\)/);
    expect(run).toMatch(/setRequestedPassageAct\(\{ key: Date\.now\(\), \.\.\.act \}\)/);
  });
  it('the Work setting is declared before the passage actions that read it', () => {
    expect(view.indexOf('const [workRevisionsPaused')).toBeLessThan(view.indexOf('const runPassageAct = '));
    expect(view.indexOf('const [workRevisionsPaused')).toBeLessThan(view.indexOf('const contextualActions = '));
  });
});

describe('Focus "More" menu closes and fits the window (live walk, 2026-11-13)', () => {
  function stageRoom() {
    act(() => root.render(React.createElement(IsolatedEditorialRoom, {
      appearance: 'evening', title: 'Fire', currentText: 'x', sectionBody: 'x', busy: false,
      editingLatitude: 2, onEditingLatitude: jest.fn(), mayRemoveParagraphs: false, onMayRemoveParagraphs: jest.fn(),
      mayProposeImmediately: false, onMayProposeImmediately: jest.fn(), onClose: jest.fn(), stage: true,
      workRevisionsPaused: false, onPauseWorkRevisions: jest.fn(),
      children: React.createElement('div'),
    } as any)));
    return host.querySelector<HTMLDetailsElement>('[data-stage-more]')!;
  }
  it('Escape closes the open More menu and any open sub-menu', () => {
    const more = stageRoom();
    more.open = true;
    more.querySelectorAll('details').forEach(d => { d.open = true; });
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(more.open).toBe(false);
    expect(Array.from(more.querySelectorAll('details')).some(d => d.open)).toBe(false);
  });
  it('a press outside closes it; NEGATIVE: a press inside does not', () => {
    const more = stageRoom();
    more.open = true;
    const inside = more.querySelector('.p4r1-isolated-more-card')!;
    act(() => { inside.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(more.open).toBe(true);
    act(() => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(more.open).toBe(false);
  });
  it('the More card fits the window and scrolls', () => {
    const css = read('app/dev/writers-studio-p4r1/p4r1-live.css');
    expect(css).toMatch(/\.p4r1-isolated-more-card\{ width:min\(380px, calc\(100vw - 24px\)\); max-height:calc\(100vh - 120px\); overflow-y:auto;/);
  });
});

describe('the "Start with MAIA" card tells the truth on a questions-only Work (2026-11-15)', () => {
  it('the editorial panel renders the shared promise with the Work\'s pause state', () => {
    const panel = read('app/dev/writers-studio-pc3-live/EditorialDancePanel.tsx');
    expect(panel).toContain('<MaiaRelationshipPromise paused={Boolean(props.revisionsPaused)} />');
  });
});

describe('a held-back example reads as care on a questions-only Work (live walk 2026-11-15)', () => {
  const controller = read('app/dev/writers-studio-pc3-live/P4R1WriteEditController.tsx');
  it('shows the questions-only explanation when the Work is paused; NEGATIVE: the ordinary message otherwise', () => {
    expect(controller).toMatch(/setEditorialFailure\(work\?\.maiaRevisionsPaused === true \? QUOTE_HELD_FOR_QUESTIONS_ONLY_DETAIL : QUOTE_NOT_IN_TEXT_DETAIL\)/);
  });
  it('the explanation says why and what to ask instead', () => {
    const { QUOTE_HELD_FOR_QUESTIONS_ONLY_DETAIL } = jest.requireActual('@/lib/manuscript/editorialRuntime/editorialQuoteGate');
    expect(QUOTE_HELD_FOR_QUESTIONS_ONLY_DETAIL).toContain('keeps every sentence yours');
    expect(QUOTE_HELD_FOR_QUESTIONS_ONLY_DETAIL).toContain('Ask her what to notice');
  });
});

describe('each Studio program speaks in its own words (founder 2026-11-15)', () => {
  const { studioPathById, pathBeginPatch, STUDIO_PATHS } = jest.requireActual('@/lib/writersStudio/studioPaths');
  const view = read('app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx');
  it('the college essay program has its own Studio copy and MAIA posture, and never calls the essay a book', () => {
    const p = studioPathById('college-essay');
    expect(p.studioCopy.whole).toBe('Talk about the whole essay');
    expect(p.studioCopy.orient).toContain('your essay');
    expect(p.studioPosture).toContain('never a book, chapter or manuscript');
  });
  it('Begin records the program on the Work from the member\'s own act', () => {
    const patch = pathBeginPatch({ path: STUDIO_PATHS[0], title: 'College essay', revisionsPausedConfirmed: true, purpose: null });
    expect(patch.studioPath).toBe('college-essay');
  });
  it('NEGATIVE: an unknown or missing program falls back to the ordinary Studio words', () => {
    expect(studioPathById('not-a-path')).toBeNull();
    expect(studioPathById(null)).toBeNull();
    expect(view).toMatch(/workStudioCopy \? workStudioCopy\.whole : 'Talk about the whole Work'/);
  });
  it('the breadcrumb yields to the save state', () => {
    const css = read('app/dev/writers-studio-full-redesign-review/full-redesign-review.css');
    expect(css).toMatch(/\.fr-write-crumb \{ max-width: 50%; min-width: 0; overflow: hidden; \}/);
  });
});

describe('member-facing Studio wording says Work, not book, and never promises edits on a questions-only Work (review F4, 2026-11-15)', () => {
  // Member-facing text only: comments are stripped first. Publish and cover tools produce a book and are out of scope.
  const FILES = [
    'app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx',
    'app/dev/writers-studio-pc3-live/EditorialLetterPanel.tsx',
    'app/dev/writers-studio-pc3-live/EditorialDancePanel.tsx',
  ];
  const stripComments = (src: string) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  it.each(FILES)('%s has no member-facing "book"', (file) => {
    const code = stripComments(read(file));
    const hits = code.split('\n').filter((l) => /\bbook\b/i.test(l) && !/data-write-talk-book|data-[a-z-]*book/i.test(l));
    expect(hits).toEqual([]);
  });
  it('the Craft view renders the shared not-yet line with the Work\'s pause state', () => {
    const view = read('app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx');
    expect(view).toContain('<MaiaNotYetNote paused={revisionsPaused} />');
  });
});

describe('RENDERED: what MAIA promises before the writer starts with her (review F4, 2026-11-15)', () => {
  const { MaiaNotYetNote, MaiaRelationshipPromise } = jest.requireActual('@/app/dev/writers-studio-pc3-live/MaiaQuestionsOnlyCopy');
  const render = (el: unknown) => { act(() => root.render(el as never)); return host.textContent ?? ''; };
  it('questions-only ON: Craft promises questions and no rewrite, and never edits', () => {
    const text = render(React.createElement(MaiaNotYetNote, { paused: true }));
    expect(text).toContain('ask questions. She won’t rewrite it: every sentence stays yours.');
    expect(text).not.toMatch(/suggest edits/);
    expect(text).not.toMatch(/\bbook\b/i);
  });
  it('NEGATIVE, questions-only OFF: Craft offers edits, and still says Work', () => {
    const text = render(React.createElement(MaiaNotYetNote, { paused: false }));
    expect(text).toContain('suggest edits');
    expect(text).not.toMatch(/won’t rewrite/);
    expect(text).toContain('this Work');
  });
  it('questions-only ON: the relationship card promises questions and no rewrite', () => {
    const text = render(React.createElement(MaiaRelationshipPromise, { paused: true }));
    expect(text).toContain('I won’t rewrite it: every sentence stays yours.');
    expect(text).not.toMatch(/suggest edits/);
  });
  it('NEGATIVE, questions-only OFF: the relationship card offers edits', () => {
    const text = render(React.createElement(MaiaRelationshipPromise, { paused: false }));
    expect(text).toContain('suggest edits');
    expect(text).not.toMatch(/won’t rewrite/);
  });
});
