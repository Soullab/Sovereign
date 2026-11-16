/**
 * College Essay: all six stages (founder 2026-11-16, "We want all phases of writing process for College essay ready to test")
 * and private-by-default stage notes ("Yes, private by default"). Registry, MAIA's stage coaching, privacy pins, and the stage
 * card as the writer meets it. jsdom; stubbed fetch; not a browser run.
 * @jest-environment jsdom
 */
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const apiFetch = jest.fn();
jest.mock('@/lib/http/apiBase', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
jest.mock('@/lib/db/postgres', () => ({ query: jest.fn() }));

import { builtStages, currentStage, nextStage, stageById, studioPathById } from '@/lib/writersStudio/studioPaths';
import { conversationProgramInstructions } from '@/lib/manuscript/editorialRuntime/workRevisionPause';
import StudioStageCard from '@/app/dev/writers-studio-pc3-live/StudioStageCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const essay = studioPathById('college-essay')!;
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('the six stages, in the curriculum’s own words', () => {
  test('all six are built, in order', () => {
    expect(builtStages(essay).map((s) => [s.id, s.stage])).toEqual([
      ['discover', 'Discover'], ['meaning', 'Meaning'], ['voice', 'Voice'], ['draft', 'Draft'], ['revise', 'Revise'], ['ready', 'Ready'],
    ]);
  });
  test('each carries its week’s lead and guidance, verbatim from the curriculum', () => {
    const by = Object.fromEntries(builtStages(essay).map((s) => [s.id, s]));
    expect(by.meaning!.lead).toBe('Look beneath the moment.');
    expect(by.meaning!.guidance).toBe('An essay can show how you attend to the world. It does not need a predetermined moral.');
    expect(by.voice!.question).toBe('Where were you? What did you notice? What actually happened?');
    expect(by.draft!.info).toContain('250–650 words');
    expect(by.draft!.info).toContain('does not limit your writing');
    expect(by.revise!.guidance).toBe('A reviewer can notice patterns, ask questions, or teach techniques. Rewriting remains your decision and your work.');
    expect(by.ready!.guidance).toBe('These reminders help you review your work. They are not a certification or a promise of admission.');
  });
  test('every stage has MAIA coaching, and none of it lets her write, moralise or certify', () => {
    for (const s of builtStages(essay)) expect(s.posture).toMatch(/^STAGE: /);
    const by = Object.fromEntries(builtStages(essay).map((s) => [s.id, s.posture!]));
    expect(by.meaning).toContain('Never supply a meaning, a moral or a lesson');
    expect(by.voice).toContain('Never model a voice');
    expect(by.draft).toContain('never draft for them');
    expect(by.revise).toContain('Never write the revision');
    expect(by.ready).toContain('Never certify it, grade it, or predict admission');
  });
  test('stage helpers: undeclared = first; next; only built ids of THIS program', () => {
    expect(currentStage(essay, null).id).toBe('discover');
    expect(currentStage(essay, 'not-a-stage').id).toBe('discover');
    expect(currentStage(essay, 'voice').id).toBe('voice');
    expect(nextStage(essay, 'meaning')!.id).toBe('voice');
    expect(nextStage(essay, 'ready')).toBeNull();
    expect(stageById(essay, 'revise')!.id).toBe('revise');
    expect(stageById(essay, 'chapter-one')).toBeNull();
    expect(stageById(essay, 7)).toBeNull();
  });
  test('the door names only the stage the writer is at', () => {
    const src = read('app/dev/writers-studio-pc3-live/StudioInspirationOpening.tsx');
    expect(src).toContain('You’re at: {builtStages(studioPath)[0]?.stage}');
  });
});

describe('MAIA’s stage coaching in the conversation', () => {
  const postureOf = (id: string) => studioPathById(id)?.studioPosture ?? null;
  const stagePostureOf = (pid: string, sid: string | null) => { const p = studioPathById(pid); return p ? currentStage(p, sid).posture ?? null : null; };
  test('questions-only, then the program, then THIS Work’s stage', () => {
    const out = conversationProgramInstructions({ questionsOnly: true, program: { kind: 'one', id: 'college-essay' }, stage: 'meaning' }, postureOf, stagePostureOf);
    expect(out).toHaveLength(3);
    expect(out[1]).toBe(essay.studioPosture);
    expect(out[2]).toMatch(/^STAGE: MEANING/);
  });
  test('an undeclared stage is the first; an uncertain program gets no stage coaching', () => {
    expect(conversationProgramInstructions({ questionsOnly: false, program: { kind: 'one', id: 'college-essay' }, stage: null }, postureOf, stagePostureOf)[1])
      .toMatch(/^STAGE: DISCOVER/);
    expect(conversationProgramInstructions({ questionsOnly: false, program: { kind: 'ambiguous' } }, postureOf, stagePostureOf).join('\n'))
      .not.toContain('STAGE:');
  });
});

describe('private by default: no MAIA path reads the writer’s stage notes', () => {
  test('the notes table is touched only by its own route (and the migration)', () => {
    const maiaPaths = [
      'lib/manuscript/ask/askReader.ts', 'lib/manuscript/ask/workContext.ts', 'lib/manuscript/editorialRuntime/turn.ts',
      'lib/manuscript/editorialRuntime/workRevisionPause.ts', 'app/api/sovereign/manuscripts/[id]/ask/route.ts',
      'app/api/sovereign/living-works/[id]/ask/route.ts', 'app/api/sovereign/writers-studio/arrival/route.ts',
    ];
    for (const p of maiaPaths) expect(read(p)).not.toMatch(/studio_stage_notes|stage-notes/);
  });
  test('the notes route is owner-scoped in every predicate', () => {
    const src = read('app/api/sovereign/living-works/[id]/stage-notes/route.ts');
    expect(src).toContain('WHERE id = $1 AND member_id = $2');
    expect(src).toContain('WHERE living_work_id = $1 AND member_id = $2');
    expect(src).toContain('WHERE studio_stage_notes.member_id = EXCLUDED.member_id');
  });
});

describe('the stage card as the writer meets it', () => {
  let host: HTMLDivElement;
  let root: Root;
  const patches = () => apiFetch.mock.calls.filter(([, i]) => i?.method === 'PATCH');
  const puts = () => apiFetch.mock.calls.filter(([, i]) => i?.method === 'PUT');
  const btn = (sel: string) => host.querySelector(sel) as HTMLButtonElement;
  async function flush() { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); }
  async function mount(declared: string | null, onShowMaia = jest.fn()) {
    apiFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (String(url).endsWith('/stage-notes') && (!init || init.method === 'GET')) return { ok: true, json: async () => ({ notes: [{ stage: 'meaning', body: 'He let me lose so I would stay brave.' }] }) };
      return { ok: true, json: async () => ({}) };
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(React.createElement(StudioStageCard, { workId: 'w1', program: essay, declaredStage: declared, draftWords: 76, onShowMaia })); });
    await flush();
    return onShowMaia;
  }
  beforeEach(() => apiFetch.mockReset());
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  test('shows where the writer is and that stage’s own words; says plainly that notes are private', async () => {
    await mount('meaning');
    expect(host.querySelector('[data-studio-stage="meaning"]')).not.toBeNull();
    expect(host.textContent).toContain('Stage 2 of 6 · Meaning');
    expect(host.textContent).toContain('Look beneath the moment.');
    expect(host.textContent).toContain('Private. MAIA sees this only if you show her.');
    expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toBe('He let me lose so I would stay brave.');
  });

  test('"Show MAIA this note" hands the writer’s own words to the conversation; nothing is sent by itself', async () => {
    const onShowMaia = await mount('meaning');
    await act(async () => { btn('[data-stage-show-maia]').click(); });
    expect(onShowMaia).toHaveBeenCalledWith('From my Meaning notes: He let me lose so I would stay brave.');
    expect(apiFetch.mock.calls.some(([u]) => String(u).includes('/ask'))).toBe(false);
  });

  test('an empty note cannot be shown', async () => {
    await mount('voice');
    expect(btn('[data-stage-show-maia]').disabled).toBe(true);
  });

  test('the writer moves on by their own act; the stage is saved through the Work', async () => {
    await mount('meaning');
    await act(async () => { btn('[data-stage-next]').click(); });
    await flush();
    expect(JSON.parse(patches()[0]![1].body)).toEqual({ studioStage: 'voice' });
    expect(String(patches()[0]![0])).toBe('/api/sovereign/living-works/w1');
    expect(host.textContent).toContain('Stage 3 of 6 · Voice');
  });

  test('Draft shows the word count as information, never a limit', async () => {
    await mount('draft');
    expect(host.querySelector('[data-stage-words]')!.textContent).toContain('76 words.');
    expect(host.querySelector('[data-stage-words]')!.textContent).toContain('does not limit your writing');
  });

  test('a note is saved for its stage when the writer leaves the box', async () => {
    await mount('voice');
    const box = host.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, 'The kitchen floor, the flashlight.');
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { box.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    await flush();
    expect(JSON.parse(puts()[0]![1].body)).toEqual({ stage: 'voice', body: 'The kitchen floor, the flashlight.' });
  });

  test('the last stage offers no "Move on"', async () => {
    await mount('ready');
    expect(host.querySelector('[data-stage-next]')).toBeNull();
  });
});
