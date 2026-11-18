/**
 * @jest-environment jsdom
 *
 * Conversation-stage design, build step 1 (founder decision 2026-11-04, lane authorized 2026-11-17): every gate speaks as MAIA, in the
 * thread, with the action attached: Start with MAIA · Keep this private · Just keep writing. No state is only a system message with no
 * action. The Sanctuary action ("Keep this private") never sends.
 */
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import EditorialDancePanel from '@/app/dev/writers-studio-pc3-live/EditorialDancePanel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

function base(over: Record<string, unknown> = {}) {
  return {
    manuscriptTitle: 'Threshold', currentText: 'Original words.', sectionBody: 'Original words.',
    thread: null, version: null, lastMaiaTurn: null, appliedVersionId: null, busy: false,
    message: null, undoMessage: null, sessionPosture: { resolved: true, sanctuary: false },
    onChooseSessionPosture: jest.fn(), onSelectVersion: jest.fn(), onSend: jest.fn(),
    onSaveMember: jest.fn(async () => true), onApply: jest.fn(), onKeep: jest.fn(), onDepth: jest.fn(),
    onBackToPage: jest.fn(),
    maiaRelationship: { active: false, busy: false, choices: [], message: null, onBegin: jest.fn(), onChoose: jest.fn() },
    ...over,
  } as any;
}
const draw = (props: any) => act(() => root.render(React.createElement(EditorialDancePanel, props)));
const button = (label: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement | undefined;

describe('the relationship gate: Start with MAIA · Keep this private · Just keep writing', () => {
  it('⭐ MUST FAIL IF the gate offers only one way forward: all three actions are there', () => {
    draw(base());
    const gate = container.querySelector('[data-relationship-gate]')!;
    expect(gate).not.toBeNull();
    const labels = Array.from(gate.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Start with MAIA', 'Keep this private', 'Just keep writing']));
  });

  it('⭐ MUST FAIL IF "Keep this private" sends anything: it turns Sanctuary on, and a held act is dropped, never run', () => {
    const props = base();
    draw(props);
    act(() => (container.querySelector('.p4r1-dance-start-actions button') as HTMLButtonElement).click()); // an act is now held
    expect(props.onSend).not.toHaveBeenCalled();
    act(() => button('Keep this private')!.click());
    expect(props.onChooseSessionPosture).toHaveBeenCalledWith(true);
    expect(props.maiaRelationship.onBegin).not.toHaveBeenCalled();
    // even if the relationship then begins and the posture is (wrongly) Ordinary, the dropped act does not run
    draw({ ...props, maiaRelationship: { ...props.maiaRelationship, active: true } });
    expect(props.onSend).not.toHaveBeenCalled();
    expect(container.querySelector('[data-held-act]')).toBeNull();
  });

  it('"Just keep writing" returns to the page and sends nothing', () => {
    const props = base();
    draw(props);
    act(() => button('Just keep writing')!.click());
    expect(props.onBackToPage).toHaveBeenCalledTimes(1);
    expect(props.onSend).not.toHaveBeenCalled();
  });
});

describe('the privacy gates also offer "Just keep writing"', () => {
  it.each([
    ['posture not chosen', { resolved: false, sanctuary: false }],
    ['Sanctuary on', { resolved: true, sanctuary: true }],
  ])('%s: a way back to the page, sending nothing', (_name, sessionPosture) => {
    const props = base({ sessionPosture });
    draw(props);
    act(() => button('Just keep writing')!.click());
    expect(props.onBackToPage).toHaveBeenCalledTimes(1);
    expect(props.onSend).not.toHaveBeenCalled();
  });
});

describe('no system voice where MAIA is speaking', () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
  it('⭐ MUST FAIL IF the stage or the Write controller still says "Nothing was sent" / "Nothing has been sent"', () => {
    for (const p of ['app/dev/writers-studio-pc3-live/EditorialDancePanel.tsx', 'app/dev/writers-studio-pc3-live/P4R1WriteEditController.tsx']) {
      expect(read(p)).not.toMatch(/Nothing (was|has been) sent/);
    }
  });
  it('⭐ MUST FAIL IF the no-Living-Work notice speaks as the system: it is MAIA, and says she sent nothing', () => {
    const view = read('app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx');
    const notice = view.match(/const NO_WORK_NOTICE = '([^']+)'/)?.[1] ?? '';
    expect(notice).toMatch(/^I /);
    expect(notice).toMatch(/I haven’t sent anything/);
    expect(notice).not.toMatch(/MAIA works/);
  });
  it('the controller\'s fallbacks speak as MAIA and never say "book"', () => {
    const c = read('app/dev/writers-studio-pc3-live/P4R1WriteEditController.tsx');
    expect(c).not.toMatch(/MAIA isn\\'t sitting with this book yet/);
    expect(c).not.toMatch(/MAIA editorial work is unavailable in Sanctuary/);
  });
});
