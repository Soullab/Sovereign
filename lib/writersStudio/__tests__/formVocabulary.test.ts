/**
 * @jest-environment jsdom
 *
 * The Studio's words follow what the Work is (founder 2026-11-20): "If a writer says they are doing an essay, MAIA shouldn't be
 * asking about chapters but about essay content. If it is a poem, it should be about stanzas." Rulings: the WRITER chooses the
 * form (never inferred), and an unknown form is spoken of neutrally, never as a book.
 */
import fs from 'fs';
import path from 'path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  FORM_CHOICES, formStudioCopy, formToSave, formVocabulary, inFormWords, readingFrame,
} from '../formVocabulary';
import { StudioVocabularyProvider, placeLabel } from '../StudioVocabularyContext';
import { DevelopStage, DevelopHoldings, FormControl } from '@/app/dev/writers-studio-pc3-live/DevelopStage';
import { apiFetch } from '@/lib/http/apiBase';

jest.mock('@/lib/http/apiBase', () => ({ apiFetch: jest.fn() }));
const fetchMock = apiFetch as unknown as jest.Mock;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const BOOKISH = /\bchapters?\b|\bbook\b/i;

describe('which words a form is spoken with', () => {
  test.each([
    ['essay', 'essay', 'section'], ['An essay for The Sun', 'essay', 'section'], ['poem', 'poem', 'stanza'],
    ['Poems', 'collection', 'poem'], ['a chapbook', 'collection', 'poem'], ['song lyrics', 'song', 'verse'],
    ['screenplay', 'screenplay', 'scene'], ['stage play', 'play', 'scene'], ['short story', 'story', 'scene'],
    ['novel', 'book', 'chapter'], ['Memoir', 'book', 'chapter'],
  ])('“%s” → %s, in %ss', (form, kind, unit) => {
    const v = formVocabulary(form);
    expect(v.kind).toBe(kind);
    expect(v.unit).toBe(unit);
  });

  test('no form, or a blank one, is neutral and never says book or chapter', () => {
    for (const form of [null, undefined, '', '   ']) {
      const v = formVocabulary(form);
      expect(v.kind).toBe('neutral');
      for (const word of [v.noun, v.whole, v.unit, v.units, v.railHeading, v.bringHint]) expect(word).not.toMatch(BOOKISH);
      expect(v.maiaFrame).toMatch(/Do not assume it is a book or speak of chapters/);
    }
    expect(Object.values(formStudioCopy(null)).join(' ')).not.toMatch(BOOKISH);
  });

  test('the writer’s own word we don’t recognise names the Work, with neutral parts', () => {
    const v = formVocabulary('Letter');
    expect([v.noun, v.whole, v.unit]).toEqual(['letter', 'the whole letter', 'part']);
    expect(v.maiaFrame).toMatch(/calls this Work “Letter”/);
  });

  test('every offered form other than a book speaks without book words, on screen and to MAIA', () => {
    for (const { id } of FORM_CHOICES.filter((f) => f.id !== 'book')) {
      const v = formVocabulary(id);
      expect([v.noun, v.whole, v.unit, v.units, v.railHeading, v.bringHint].join(' ')).not.toMatch(BOOKISH);
      expect(Object.values(formStudioCopy(id)).join(' ')).not.toMatch(BOOKISH);
      expect(v.maiaFrame).toMatch(/Never call it a book or its parts chapters/);
      expect(readingFrame(v)).toMatch(new RegExp(`say “${v.unit}” and “${v.noun}”, never “chapter” or “book”`));
    }
  });

  test('a book reads as before: nothing is put in front of its reading instructions', () => {
    expect(readingFrame(formVocabulary('book'))).toBe('');
  });

  test('what is saved is the writer’s choice or their own word, trimmed; nothing else', () => {
    expect(formToSave('poem', 'ignored')).toBe('poem');
    expect(formToSave(null, '  a   liturgy ')).toBe('a liturgy');
    expect(formToSave(null, '   ')).toBeNull();
    expect(formToSave(null, 'x'.repeat(200))).toHaveLength(60);
  });
});

describe('the writer chooses; nothing is inferred', () => {
  const opening = read('app/dev/writers-studio-pc3-live/StudioInspirationOpening.tsx');
  test('the opening asks “What is it becoming?” and passes only the writer’s own choice', () => {
    expect(opening).toMatch(/\{FORM_QUESTION\}/);
    expect(opening).toMatch(/const chosenForm = formToSave\(formChoice, formOwnOpen \? formOwn : ''\);/);
    expect(opening).toMatch(/props\.onBegin\?\.\(destination, planNow\(\)\.purpose, chosenForm\);/);
    expect(opening).toMatch(/You can skip this, or change it any time\./);
  });

  test('the form is never derived from the spark, the reflection or the writing', () => {
    const setters = [...opening.matchAll(/setForm(Choice|Own)\(([^)]*)\)/g)].map((m) => m[2]);
    for (const arg of setters) expect(arg).not.toMatch(/answer|reflection|understood|spark|purpose/);
    const controller = read('app/dev/writers-studio-pc3-live/P4R1HomeController.tsx');
    for (const m of controller.matchAll(/await setForm\(([^)]*)\)/g)) expect(m[1]).toMatch(/^(workId|work\.id), form$/);
    expect(controller).toMatch(/body: JSON\.stringify\(\{ form \}\)/);
  });
});

describe('Develop speaks in the Work’s words', () => {
  let host: HTMLDivElement; let root: Root;
  beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const sections = [
    { draftSectionId: 's1', heading: 'First light', body: 'First light\n\nThe gull opens the sky.', position: 0 },
    { draftSectionId: 's2', heading: '', body: 'Salt on the tongue, and the tide.', position: 1 },
  ];
  const stage = (form: string | null) => {
    const props = { workTitle: 'Tidewater', sections, currentId: 's1', onSelect: jest.fn(), starters: [], onStarter: jest.fn(), onOpenWrite: jest.fn(),
      reading: { status: 'idle', chapterLabel: 'First light' }, onReadChapter: jest.fn(),
      onMoreWays: jest.fn(), lastRead: null, plan: null, planBusy: false, planNote: null, onMakePlan: jest.fn(), onEditPlan: jest.fn(),
      onWorkOnStep: jest.fn(), onAskAbout: jest.fn(), closed: true, view: 'full', onView: jest.fn() };
    act(() => root.render(React.createElement(StudioVocabularyProvider, { value: formVocabulary(form) },
      React.createElement(React.Fragment, null,
        React.createElement(DevelopStage, props as any),
        React.createElement(DevelopHoldings, { manuscriptId: 'm', workId: 'w', kind: null, onKind: jest.fn() } as any)))));
    return host.textContent ?? '';
  };

  test('a poem’s Develop stage says nothing about chapters or books', () => {
    const text = stage('poem');
    // “A helper’s book” is the name of a genre the writer may declare (Fiction / Nonfiction / A helper’s book), not the Studio’s word.
    expect(text.replace('A helper’s book', '')).not.toMatch(BOOKISH);
    expect(text).toMatch(/Your poem/);
    expect(text).toMatch(/What kind of poem is this\?/);
    // Walk 2026-11-21: the stage toolbar's read button still said "Read this chapter with MAIA" for a poem.
    expect(text).toMatch(/Read this stanza with MAIA/);
  });

  test('an untitled place is named as Write names it, never “Section 2”', () => {
    const text = stage('poem');
    expect(text).toMatch(/Stanza 2/);
    expect(text).not.toMatch(/Section 2/);
  });

  test('with no form, Develop is neutral', () => {
    const text = stage(null);
    expect(text).not.toMatch(/\bchapters?\b/i);
    expect(text).toMatch(/Your piece/);
  });
});

describe('the writer can change what the Work is becoming, later', () => {
  let host: HTMLDivElement; let root: Root;
  beforeEach(() => { fetchMock.mockReset(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === label)!;
  const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

  test('a Work with no form is asked, and the writer’s click saves exactly their choice', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const onSaved = jest.fn();
    act(() => root.render(React.createElement(FormControl, { workId: 'w1', form: null, onSaved })));
    expect(host.textContent).toMatch(/What is it becoming\?/);
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => button('Poem').click());
    await flush();
    expect(fetchMock).toHaveBeenCalledWith('/api/sovereign/living-works/w1', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ form: 'poem' }) }));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test('a named form shows with Change, and can be cleared back to neutral', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const onSaved = jest.fn();
    act(() => root.render(React.createElement(FormControl, { workId: 'w1', form: 'essay', onSaved })));
    expect(host.textContent).toMatch(/^Essay/);
    act(() => button('Change').click());
    act(() => button('Leave it unnamed').click());
    await flush();
    expect(fetchMock).toHaveBeenCalledWith('/api/sovereign/living-works/w1', expect.objectContaining({ body: JSON.stringify({ form: null }) }));
    expect(onSaved).toHaveBeenCalled();
  });

  test('when saving fails, the writer is told and nothing is treated as changed', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const onSaved = jest.fn();
    act(() => root.render(React.createElement(FormControl, { workId: 'w1', form: null, onSaved })));
    act(() => button('Song').click());
    await flush();
    expect(onSaved).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/could not be saved just now\. Nothing changed\./);
  });

  test('a Studio program’s Work offers no form control: the program’s own words outrank it', () => {
    act(() => root.render(React.createElement(DevelopHoldings, { manuscriptId: 'm', workId: 'w', kind: null, onKind: jest.fn() } as any)));
    expect(host.querySelector('[data-develop-form]')).toBeNull();
    const view = read('app/dev/writers-studio-pc3-live/P4R1DevelopView.tsx');
    expect(view).toMatch(/onFormSaved=\{props\.work\.studioPath \? undefined : props\.onWorkFormSaved\}/);
    expect(read('app/dev/writers-studio-pc3-live/P4R1DevelopController.tsx')).toMatch(/onWorkFormSaved=\{\(\) => void reloadWorks\(\)\}/);
  });
});

describe('Develop’s older fixed wording is said in the Work’s words', () => {
  test('book wording becomes the form’s words, with the right article, and a book is unchanged', () => {
    const poem = formVocabulary('poem'); const essay = formVocabulary('essay'); const none = formVocabulary(null);
    expect(inFormWords('Let MAIA read this chapter.', poem)).toBe('Let MAIA read this stanza.');
    expect(inFormWords('Chapter scorecard', poem)).toBe('Stanza scorecard');
    expect(inFormWords('How does this chapter fit the book?', essay)).toBe('How does this section fit the essay?');
    expect(inFormWords('A plan across chapters needs a book', essay)).toBe('A plan across sections needs an essay');
    expect(inFormWords('Select a chapter or section at left', poem)).toBe('Select a stanza at left');
    expect(inFormWords('In the book', none)).toBe('In the piece');
    expect(inFormWords('Read this chapter', formVocabulary('novel'))).toBe('Read this chapter');
    expect(inFormWords('read-this-chapter', poem)).toBe('read-this-chapter');
  });

  test('the Develop stage’s own wording names no chapter or book; it speaks through the Work’s words', () => {
    const code = read('app/dev/writers-studio-pc3-live/DevelopStage.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
    const left: string[] = [];
    for (const m of code.matchAll(/(['`])((?:(?!\1)[^\\\n]|\\.)*?\b([Cc]hapters?|[Bb]ook)\b(?![-_])(?:(?!\1)[^\\\n]|\\.)*?)\1/g)) left.push(m[2]);
    for (const m of code.matchAll(/>([^<>{}]*\b([Cc]hapters?|[Bb]ook)\b[^<>{}]*)</g)) left.push(m[1].trim());
    // “A helper’s book” is the name of a genre the writer may declare, not the Studio’s word for their Work.
    expect(left.filter((t) => t !== 'A helper’s book' && !/^[a-z-]+$/.test(t))).toEqual([]);
  });

  test('no Studio wording in Develop’s panels says chapter or book except through the Work’s words', () => {
    let code = read('app/dev/writers-studio-pc3-live/P4R1DevelopView.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // Fixed tables whose every rendered use goes through fw(...), asserted below.
    for (const name of ['FRIENDLY_PHENOMENON', 'INTENT_STARTERS']) {
      const at = code.indexOf(`const ${name}`);
      code = code.slice(0, at) + code.slice(code.indexOf(name === 'INTENT_STARTERS' ? '\n];' : '\n};', at) + 3);
    }
    // Everything inside fw(...) is already said in the Work's words.
    let out = ''; for (let i = 0; i < code.length; i++) {
      if (code.startsWith('fw(', i) && !/[A-Za-z0-9_]/.test(code[i - 1] ?? '')) {
        let depth = 0; let j = i + 2;
        for (; j < code.length; j++) { if (code[j] === '(') depth++; else if (code[j] === ')' && --depth === 0) break; }
        i = j; out += 'fw()'; continue;
      }
      out += code[i];
    }
    const left: string[] = [];
    for (const m of out.matchAll(/(['`])((?:(?!\1)[^\\\n]|\\.)*?\b([Cc]hapters?|[Bb]ook)\b(?:(?!\1)[^\\\n]|\\.)*?)\1/g)) left.push(m[2]);
    for (const m of out.matchAll(/>([^<>{}]*\b([Cc]hapters?|[Bb]ook)\b[^<>{}]*)</g)) left.push(m[1].trim());
    const notWording = (t: string) => /^[a-z-]+$/.test(t) || t.startsWith('[data-') /* keys, scope kinds, selectors */
      || t.startsWith('Source leads currently filed') /* MAIA's instructions, framed by readingFrame */
      || /^Read this \$\{props\.scope\.kind === 'chapter' \? studioWords\.unit/.test(t);
    expect(left.filter((t) => !notWording(t))).toEqual([]);
    const view = read('app/dev/writers-studio-pc3-live/P4R1DevelopView.tsx');
    expect(view).toMatch(/\{fw\(friendly\.title\)\}/);
    expect(view.match(/\{fw\(starter\.(label|detail)\)\}/g)?.length).toBe(6);
    expect(view).not.toMatch(/[^=]\{starter\.(label|detail)\}/); // key={starter.label} is a React key, not wording
  });
});

describe('guided paths are offered when relevant, never chosen for the writer (founder 2026-11-21)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { pathsForForm, STUDIO_PATHS } = require('../studioPaths') as typeof import('../studioPaths');
  test('a path offers itself only for the forms it names', () => {
    expect(pathsForForm('essay').map((p) => p.id)).toEqual(['college-essay']);
    expect(pathsForForm('a college essay').map((p) => p.id)).toEqual(['college-essay']);
    for (const form of [null, '', 'poem', 'book', 'song', 'Letter']) expect(pathsForForm(form)).toEqual([]);
    for (const p of STUDIO_PATHS) { expect(p.forms.length).toBeGreaterThan(0); expect(p.offer.trim()).not.toBe(''); }
  });

  let host: HTMLDivElement; let root: Root;
  beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const render = (form: string | null, onStartPath?: jest.Mock) =>
    act(() => root.render(React.createElement(FormControl, { workId: 'w1', form, onSaved: jest.fn(), onStartPath })));

  test('in Develop, an essay is offered the college essay path; taking it is the writer’s click alone', () => {
    const onStartPath = jest.fn();
    render('essay', onStartPath);
    expect(host.textContent).toMatch(/Writing a college application essay\? There’s a guided path for that\. It begins a new Work; this one stays as it is\./);
    expect(onStartPath).not.toHaveBeenCalled();
    act(() => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Start a college essay')!.click());
    expect(onStartPath).toHaveBeenCalledWith('college-essay');
  });

  test('no offer for a form no path fits, for a Work with no form, or where no path may be started', () => {
    render('poem', jest.fn());
    expect(host.querySelector('[data-path-offer]')).toBeNull();
    render(null, jest.fn());
    expect(host.querySelector('[data-path-offer]')).toBeNull();
    render('essay');
    expect(host.querySelector('[data-path-offer]')).toBeNull();
  });

  test('the opening offers it after the writer’s own form choice, and opens the path’s door from its start', () => {
    const opening = read('app/dev/writers-studio-pc3-live/StudioInspirationOpening.tsx');
    expect(opening).toMatch(/props\.onChoosePath \? pathsForForm\(chosenForm\)\.map/);
    const home = read('app/dev/writers-studio-pc3-live/P4R1HomeView.tsx');
    expect(home).toMatch(/onChoosePath=\{props\.onStartPath\}/);
    // Remounted on a path change, so the path's age check and first questions run before anything else.
    expect(home).toMatch(/key=\{props\.studioPath\?\.id \?\? 'open'\}/);
    const view = read('app/dev/writers-studio-pc3-live/P4R1DevelopView.tsx');
    expect(view).toMatch(/onStartPath=\{props\.work\.studioPath \? undefined : props\.onStartPath\}/);
  });
});

describe('a Work begun from Home is asked what it is becoming too (founder 2026-11-21)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FormQuestion = require('@/app/dev/writers-studio-pc3-live/FormQuestion').default;
  let host: HTMLDivElement; let root: Root;
  beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === label)!;

  test('only the writer’s click or own word sets it; clicking again takes it back', () => {
    const onChange = jest.fn();
    act(() => root.render(React.createElement(FormQuestion, { onChange })));
    expect(host.textContent).toMatch(/What is it becoming\? Optional\. You can change it any time\./);
    expect(onChange).not.toHaveBeenCalled();
    act(() => button('Poem').click());
    expect(onChange).toHaveBeenLastCalledWith('poem');
    act(() => button('Poem').click());
    expect(onChange).toHaveBeenLastCalledWith(null);
    act(() => button('Something else, in my own word').click());
    const input = host.querySelector('input')!;
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'liturgy'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(onChange).toHaveBeenLastCalledWith('liturgy');
  });

  test('an essay is offered the college essay path; nothing is offered without a way to start one', () => {
    const onChoosePath = jest.fn();
    act(() => root.render(React.createElement(FormQuestion, { onChange: jest.fn(), onChoosePath })));
    expect(host.querySelector('[data-path-offer]')).toBeNull();
    act(() => button('Essay').click());
    expect(host.querySelector('[data-path-offer="college-essay"]')).not.toBeNull();
    expect(onChoosePath).not.toHaveBeenCalled();
    act(() => button('Start a college essay').click());
    expect(onChoosePath).toHaveBeenCalledWith('college-essay');
    act(() => root.render(React.createElement(FormQuestion, { onChange: jest.fn() })));
    expect(host.querySelector('[data-path-offer]')).toBeNull();
  });

  test('both Home forms ask it and pass the choice to the new Work; Cancel clears it', () => {
    const home = read('app/dev/writers-studio-pc3-live/P4R1HomeView.tsx');
    expect(home.match(/<FormQuestion onChange=\{setNewForm\} onChoosePath=\{props\.onStartPath\} \/>/g)?.length).toBe(2);
    expect(home).toMatch(/props\.onBeginWithSpark\(title, sparkLine, newForm\)/);
    expect(home.match(/props\.onBegin\(title, newForm\)/g)?.length).toBe(3);
    expect(home).toMatch(/useEffect\(\(\) => \{ if \(!beginning\) setNewForm\(null\); \}, \[beginning\]\);/);
    const controller = read('app/dev/writers-studio-pc3-live/P4R1HomeController.tsx');
    expect(controller).toMatch(/onBegin=\{\(title, form\) => void onBegin\(title, null, form \?\? null\)\}/);
    expect(controller).toMatch(/onBeginWithSpark=\{\(title, spark, form\) => void onBegin\(title, ordinaryNow\(\) \? spark : null, form \?\? null\)\}/);
  });
});

describe('Develop names an untitled place the way Write does (walk 2026-11-21)', () => {
  test('its heading first; else “Your draft” when it is the only place; else the form’s part and number', () => {
    const at = (heading: string | null, position: number) => ({ heading, position });
    expect(placeLabel(formVocabulary('poem'), at('First light', 0), 3)).toBe('First light');
    expect(placeLabel(formVocabulary('poem'), at('', 1), 3)).toBe('Stanza 2');
    expect(placeLabel(formVocabulary('poem'), at(null, 0), 1)).toBe('Your draft');
    expect(placeLabel(formVocabulary('essay'), at(null, 2), 3)).toBe('Section 3');
    expect(placeLabel(formVocabulary(null), at(null, 1), 2)).toBe('Part 2');
    // The same names Write's rail gives (formStudioCopy → unheadedPlaceName), so the two rooms agree.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { unheadedPlaceName } = require('../studioPaths') as typeof import('../studioPaths');
    for (const form of ['poem', 'essay', 'book', 'song', null, 'Letter']) for (const [pos, total] of [[0, 1], [1, 3]] as const) {
      expect(placeLabel(formVocabulary(form), at(null, pos), total)).toBe(unheadedPlaceName(formStudioCopy(form), pos, total));
    }
  });

  test('no Develop file falls back to “Section n” on its own', () => {
    for (const f of ['DevelopStage.tsx', 'P4R1DevelopView.tsx', 'P4R1DevelopController.tsx']) {
      expect(read(`app/dev/writers-studio-pc3-live/${f}`)).not.toMatch(/`Section \$\{/);
    }
  });
});
