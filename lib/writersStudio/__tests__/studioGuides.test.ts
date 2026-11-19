/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import {
  GUIDE_PATH, STUDIO_GUIDES, guideById, guideStepForDevelop, guideStepForWrite, guideStepHref, parseGuideHash,
} from '../studioGuides';
import type { DevelopScreen, WriteScreen } from '../whatNext';
import { matchRule } from '@/config/accessMatrix';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Live Studio UI: the member tree the guide describes. The guide's own files are excluded, so a label cannot pass by living only there. */
function liveUi(): string {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (/__tests__|GuideStepOffer\.tsx$/.test(rel)) continue;
      if (e.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(e.name)) out.push(read(rel));
    }
  };
  walk('app/dev/writers-studio-pc3-live');
  walk('app/dev/writers-studio-p4r1');
  for (const f of ['lib/writersStudio/inspirationOpening.ts', 'app/writers-studio/full-redesign/types.ts', 'app/writers-studio/full-redesign/fixtures.ts']) out.push(read(f));
  return out.join('\n').replace(/&amp;/g, '&');
}

const allText = (g: (typeof STUDIO_GUIDES)[number]) => g.steps.flatMap((s) => [s.title, ...s.steps, s.tip.text, s.talk]).join(' ');

describe('Studio guides', () => {
  test('every control a guide names is text the live Studio shows', () => {
    const ui = liveUi();
    const missing: string[] = [];
    for (const g of STUDIO_GUIDES) {
      for (const s of g.steps) {
        for (const line of [...s.steps, s.tip.text]) {
          for (const m of line.matchAll(/“([^”]+)”/g)) if (!ui.includes(m[1])) missing.push(`${g.id}: ${m[1]}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test('a step link carries only the guide and step', () => {
    const href = guideStepHref({ guide: 'new', step: 7 }, 'https://soullab.life');
    expect(href).toBe('https://soullab.life/explore/writers-studio/guide#new-7');
    expect(new URL(href).search).toBe('');
    expect(new URL(href).hash).toMatch(/^#(new|existing)-\d+$/);
  });

  test('the step in the link round-trips, and anything else is refused', () => {
    for (const g of STUDIO_GUIDES) {
      for (let n = 1; n <= g.steps.length; n += 1) expect(parseGuideHash(`#${g.id}-${n}`)).toEqual({ guide: g.id, step: n });
      expect(parseGuideHash(`#${g.id}-${g.steps.length + 1}`)).toBeNull();
    }
    for (const bad of ['', '#', '#new', '#new-0', '#other-1', '#new-1?x=1', '#new-1&member=abc', 'javascript:alert(1)']) expect(parseGuideHash(bad)).toBeNull();
  });

  test('every Write and Develop screen maps to a real step', () => {
    const W: WriteScreen = { pageEmpty: false, firstPage: false, chosenPlace: null, proseSwitchShown: true, proseView: true, isBook: true, talkWholeLabel: 'x' };
    for (const s of [W, { ...W, pageEmpty: true }, { ...W, firstPage: true }, { ...W, chosenPlace: 'Ch 1' }, { ...W, proseView: false }]) {
      const ref = guideStepForWrite(s);
      expect(guideById(ref.guide).steps[ref.step - 1]).toBeDefined();
    }
    const D: DevelopScreen = { chapterLabel: 'Ch 1', reading: 'idle', noticed: 0, pass: 'none', posture: 'ordinary' };
    for (const pass of ['none', 'running', 'ready', 'error', 'absent'] as const) {
      for (const posture of ['ordinary', 'sanctuary', 'unresolved'] as const) {
        const ref = guideStepForDevelop({ ...D, pass, posture });
        expect(guideById(ref.guide).steps[ref.step - 1]).toBeDefined();
      }
    }
  });

  test('in Sanctuary, Develop never points to the whole-Work reading steps', () => {
    const D: DevelopScreen = { chapterLabel: 'Ch 1', reading: 'ready', noticed: 2, pass: 'ready', posture: 'sanctuary' };
    expect(guideStepForDevelop(D)).toEqual({ guide: 'existing', step: 7 });
    expect(guideStepForDevelop({ ...D, posture: 'ordinary' })).toEqual({ guide: 'existing', step: 9 });
  });

  test('every step has a question to talk with MAIA about, in the writer’s voice', () => {
    for (const g of STUDIO_GUIDES) for (const s of g.steps) expect(s.talk).toMatch(/\?$/);
  });

  test('guide wording says Work, not book (quoted Studio labels aside)', () => {
    for (const g of STUDIO_GUIDES) expect(allText(g).replace(/“[^”]*”/g, '')).not.toMatch(/\bbook\b/i);
  });

  test('the guide page is public, exact, and reads, sends and stores nothing', () => {
    const rule = matchRule(GUIDE_PATH);
    expect(rule?.exact).toBe(GUIDE_PATH);
    expect(rule?.public).toBe(true);
    expect(matchRule(`${GUIDE_PATH}/anything`)?.public).not.toBe(true);
    const page = read('app/explore/writers-studio/guide/GuideClient.tsx') + read('app/explore/writers-studio/guide/page.tsx');
    expect(page).not.toMatch(/fetch\(|apiFetch|localStorage|sessionStorage|sendBeacon|document\.cookie|gtag|posthog/);
  });

  test('the QR offer draws the code locally from the step link and only places the question', () => {
    const offer = read('app/dev/writers-studio-pc3-live/GuideStepOffer.tsx');
    expect(offer).toMatch(/guideStepHref\(props\.step, window\.location\.origin\)/);
    expect(offer).toMatch(/QRCode\.toString\(link/);
    expect(offer).not.toMatch(/fetch\(|apiFetch|localStorage|sendBeacon/);
    expect(offer).toMatch(/onClick=\{\(\) => props\.onTalk\(step\.talk\)\}/);
    const write = read('app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx');
    const develop = read('app/dev/writers-studio-pc3-live/P4R1DevelopView.tsx');
    expect(write).toMatch(/<GuideStepOffer step=\{guideStepForWrite\(whatNextScreen\)\}\s*onTalk=\{\(question\) => \{ setWhatNextOpen\(false\); openWorkConversation\(question\); \}\}/);
    expect(develop).toMatch(/<GuideStepOffer step=\{guideStepForDevelop\(screen\)\}\s*onTalk=\{\(question\) => \{ setWhatNextOpen\(false\); placeInStageConversation\(question\); \}\}/);
  });
});
