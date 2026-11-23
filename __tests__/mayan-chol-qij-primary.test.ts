/**
 * Founder ruling 2026-11-23: the traditional Chol Q'ij (K'iche' Maya count)
 * is the authoritative Maya-calendar layer and comes first; the Dreamspell
 * (Argüelles, 1987) is a separate modern lens beneath it, never a translation
 * of or substitute for the traditional day.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

jest.mock('@/lib/db/postgres', () => ({ query: jest.fn() }));

import { traditionalMaya, YUCATEC_DAYS, cholQijDay, DREAMSPELL_DISTINCTION } from '../lib/astrology/proTraditionalMaya';
import { calculateMayanBirthSign, calculateCompleteMayanProfile } from '../lib/astrology/mayanAstrology';
import { formatMayaCalendarForMAIA, formatTodayMayaForMAIA } from '../lib/services/maiaAstrologyContextService';
import { mayaFacts } from '../lib/astrology/proAskMaiaSections';

const src = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('the trecena', () => {
  it('names the 13-day run by the day that opens it: 4 Ajaw falls in the trecena of 1 Kab’an (No’j)', () => {
    const t = traditionalMaya('2012-12-21');
    expect(t.trecena).toEqual({ kiche: 'No’j', yucatec: 'Kab’an', position: 4 });
  });

  it('is its own opening day when the number is 1, and holds across the whole run', () => {
    const open = traditionalMaya('2012-12-18'); // 1 Kab'an
    expect([open.number, open.yucatec]).toEqual([1, 'Kab’an']);
    expect(open.trecena).toEqual({ kiche: 'No’j', yucatec: 'Kab’an', position: 1 });
    const last = traditionalMaya('2012-12-30'); // twelve days on: 13 Muluk
    expect(last.number).toBe(13);
    expect(last.trecena.yucatec).toBe('Kab’an');
    expect(traditionalMaya('2012-12-31').trecena).toEqual({ kiche: 'Tz’i’', yucatec: 'Ok', position: 1 }); // 1 Ok opens the next
  });

  it('reads the day as number and nawal in K’iche’', () => {
    expect(cholQijDay(traditionalMaya('2012-12-21'))).toBe('4 Ajpu');
  });
});

describe('the two counts are different calendars', () => {
  it('never give the same number and day sign on any day from 1900 to 2030', () => {
    let sameSign = 0;
    let sameDay = 0;
    for (let t = Date.UTC(1900, 0, 1); t <= Date.UTC(2030, 11, 31); t += 86400000) {
      const d = new Date(t).toISOString().slice(0, 10);
      const trad = traditionalMaya(d);
      const ds = calculateMayanBirthSign(new Date(d + 'T12:00:00.000Z'));
      const signMatch = YUCATEC_DAYS.indexOf(trad.yucatec as any) === (ds.tzolkinNumber - 1) % 20;
      if (signMatch) sameSign++;
      if (signMatch && trad.number === ds.tone.number) sameDay++;
    }
    expect(sameDay).toBe(0);
    expect(sameSign).toBeLessThan(2000); // about 3% of days share a day sign alone
  });

  it('says so in the distinction statement, and does not call the Dreamspell Maya teaching', () => {
    expect(DREAMSPELL_DISTINCTION).toContain('José Argüelles (1987)');
    expect(DREAMSPELL_DISTINCTION).toContain('not translations of one another');
    expect(DREAMSPELL_DISTINCTION).toContain('not Maya teaching');
  });
});

describe('MAIA’s conversation context', () => {
  const profile = calculateCompleteMayanProfile(new Date('2003-09-03'));
  const block = formatMayaCalendarForMAIA(profile);

  it('gives the traditional Chol Q’ij birth day first, as the Maya birth day', () => {
    expect(block).toContain("Traditional Chol Q'ij birth day");
    expect(block).toContain('13 Aq’ab’al');
    expect(block.indexOf('13 Aq’ab’al')).toBeLessThan(block.indexOf('Dreamspell'));
  });

  it('labels the Dreamspell as a separate modern lens and forbids substitution', () => {
    expect(block).toContain('Argüelles, 1987');
    expect(block).toContain(profile.tzolkin.galacticSignature);
    expect(block).toContain("Never call a Dreamspell signature their Mayan or Tzolk'in sign");
    expect(block).not.toMatch(/Mayan Profile|Birth sign:/);
  });

  it('gives no nawal meanings and no Dreamspell seal meanings', () => {
    expect(block).not.toContain(profile.tzolkin.daySign.meaning);
    expect(block).toContain('Do not assign meanings to the nawal');
  });

  it('puts today’s traditional day before today’s Dreamspell day', () => {
    const today = formatTodayMayaForMAIA(traditionalMaya('2026-11-23'), calculateMayanBirthSign(new Date('2026-11-23T12:00:00Z')));
    expect(today).toContain('6 Kan');
    expect(today.indexOf('6 Kan')).toBeLessThan(today.indexOf('Dreamspell'));
  });
});

describe('Pro Ask MAIA facts', () => {
  it('carry the trecena with the traditional day', () => {
    expect(mayaFacts(traditionalMaya('2012-12-21'), 'Birth')).toContain('day 4 of the trecena of 1 No’j');
  });
});

describe('the rooms put the traditional day first', () => {
  it('Free Mayan room: the Chol Q’ij cards come before the Dreamspell section', () => {
    const page = src('app/astrology/mayan/page.tsx');
    const firstCard = page.indexOf('<CholQijDayCard');
    expect(firstCard).toBeGreaterThan(0);
    expect(firstCard).toBeLessThan(page.indexOf('Modern Dreamspell'));
    expect(firstCard).toBeLessThan(page.indexOf('<MayanSignCard'));
    expect(page).not.toMatch(/Mayan solar seal|Discover Your Galactic Signature/);
  });

  it('Pro Mayan room opens on the Chol Q’ij and labels every Dreamspell room', () => {
    const pro = src('app/astrology/pro-preview/ProSystemsPanel.tsx');
    expect(pro).toContain("useState<MayanRoom>('count')");
    expect(pro).toContain("['count', 'Chol Q’ij (traditional)']");
    expect(pro).toContain("'Dreamspell path of life'");
    expect(pro).toContain("'Dreamspell signature'");
  });

  it('the hub no longer names the Dreamspell signature as the Tzolk’in', () => {
    const hub = src('app/astrology/page.tsx');
    expect(hub).not.toMatch(/Galactic Signature in the Tzolk/);
    expect(hub).not.toMatch(/Galactic Signature, Tzolk/);
  });
});
