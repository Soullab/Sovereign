/**
 * Founder direction 2026-11-23: the Free Mayan room's Dreamspell path cards
 * offer "Ask MAIA about this stage in Pro" to members with Pro, and the cards
 * and life-cycle reading speak as a modern Dreamspell lens, never a forecast.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { calculatePathOfLife, generateLifeCycleInsight } from '../lib/astrology/mayanAstrology';

const src = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const yearsAgo = (n: number) => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - n, 0, 15); return d; };

describe('the Dreamspell life-cycle reading is a lens, not a forecast', () => {
  it.each([[12, 'youth'], [40, 'adulthood'], [59, 'later']])('at %s (the %s stage)', (age, stage) => {
    const birth = yearsAgo(age);
    const text = generateLifeCycleInsight(birth, calculatePathOfLife(birth));
    expect(text).toContain(`what the Dreamspell calls its ${stage} stage`);
    expect(text).toMatch(/not a (destiny or a )?forecast/);
    expect(text).not.toMatch(/destiny(?! or)|you'll|will begin|soul evolves|awakening|deeper purpose/i);
  });
});

describe('the path cards', () => {
  const views = src('components/astrology/MayanRoomViews.tsx');

  it('drop predictive wording and name each stage as the Dreamspell’s', () => {
    for (const gone of ['Your soul evolves', 'Fading in from', '>Destiny<', 'Past Influence', 'Core Identity']) {
      expect(views).not.toContain(gone);
    }
    for (const stage of ['Dreamspell · first stage', 'Dreamspell · middle stage', 'Dreamspell · later stage']) {
      expect(views).toContain(stage);
    }
    expect(views).toContain('not part of the traditional Chol Q’ij count');
  });

  it('carry the Ask-in-Pro link on each of the three stages, only when given one', () => {
    expect(views.match(/<AskInPro href=\{askHref\}/g)).toHaveLength(3);
    expect(views).toContain('href ? (');
  });
});

describe('the Free room offers the link only to Pro members, for their own date', () => {
  const page = src('app/astrology/mayan/page.tsx');
  it('asks the Pro access check and ties the link to the verified own date', () => {
    expect(page).toContain("apiFetch('/api/astrology/pro/access'");
    expect(page).toContain("hasPro && ownDate && birthDate === ownDate ? '/astrology/pro-preview?open=mayan' : undefined");
    expect(page).toContain('askHref={askHref}');
  });
});

describe('Pro opens on its Mayan room from the link', () => {
  const cockpit = src('app/astrology/pro-preview/ProAstrologyExperience.tsx');
  const systems = src('app/astrology/pro-preview/ProSystemsPanel.tsx');
  it('reads ?open=mayan once, for the member’s own chart, then calculates', () => {
    expect(cockpit).toContain("url.searchParams.get('open') !== 'mayan'");
    expect(cockpit).toContain("subjectId !== 'own'");
    expect(cockpit).toContain("openTool('traditions', 'systems')");
    expect(cockpit).toContain("calculateNow={mayanLink === 'calculate'}");
    expect(systems).toContain('if (!w.data) void calculate(w.ayanamsa, w.dayStart);');
  });
});
