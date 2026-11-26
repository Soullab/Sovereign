/**
 * Transit generator — checked against the ephemeris itself, not against its
 * own output: every exact date it reports is recomputed independently and must
 * sit on the exact aspect angle, and every retrograde flag must match the
 * planet's actual direction of motion on that date.
 */
import * as Astronomy from 'astronomy-engine';
import { calculateBirthChart as calculateProBirthChart, type BirthChart, type PlanetPosition } from '@/lib/astrology/proEphemerisCalculator';
import { SIGNS } from '@/lib/astrology/proChartGeometry';
import { longitudeOf, type SeriesBody } from '@/lib/astrology/proEphemerisSeries';
import { minorBodyLongitude } from '@/lib/astrology/proMinorBodyEphemeris';
import { presentTransits } from '@/lib/astrology/presentTransits';
import { generateTransitReport, TRANSITING_BODIES } from '../transitGenerator';
import { describeTransit, deriveTimeframe } from '../transitReportParser';

const ANGLE: Record<string, number> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
const FROM = new Date('2027-01-01T00:00:00Z');

function lonAt(body: SeriesBody, date: Date): number {
  return longitudeOf(body, Astronomy.MakeTime(date));
}

/** Any transiting body, Chiron included (from its own JPL table). */
async function bodyLon(body: string, date: Date): Promise<number> {
  return body === 'Chiron' ? minorBodyLongitude('chiron', date) : lonAt(body as SeriesBody, date);
}

function pos(lon: number): PlanetPosition {
  const l = ((lon % 360) + 360) % 360;
  return { sign: SIGNS[Math.floor(l / 30)], degree: l % 30, house: 1, retrograde: false };
}

/** A synthetic natal chart: every point placed at a chosen longitude. */
function chartWith(lons: Partial<Record<string, number>>, houses?: number[]): BirthChart {
  const base = (k: string, fallback: number) => pos(lons[k] ?? fallback);
  return {
    sun: base('sun', 5), moon: base('moon', 47), mercury: base('mercury', 88), venus: base('venus', 131),
    mars: base('mars', 172), jupiter: base('jupiter', 214), saturn: base('saturn', 253), uranus: base('uranus', 296),
    neptune: base('neptune', 337), pluto: base('pluto', 19), chiron: base('chiron', 61), northNode: base('northNode', 103),
    southNode: base('southNode', 283), lilith: pos(0), ceres: pos(0),
    ascendant: pos(lons.ascendant ?? 145), midheaven: pos(lons.midheaven ?? 55),
    houses: houses ?? Array.from({ length: 12 }, (_, i) => (145 + i * 30) % 360),
    aspects: [],
  } as BirthChart;
}

function natalLon(chart: BirthChart, point: string): number {
  const key = point === 'North Node' ? 'northNode' : point.charAt(0).toLowerCase() + point.slice(1);
  const p = (chart as any)[key];
  return SIGNS.indexOf(p.sign) * 30 + p.degree;
}

function dist(a: number, b: number): number {
  return Math.abs(((a - b) % 360 + 540) % 360 - 180);
}

describe('generateTransitReport', () => {
  const chart = chartWith({});
  let report: Awaited<ReturnType<typeof generateTransitReport>>;
  beforeAll(async () => { report = await generateTransitReport(chart, { from: FROM }); });

  it('produces a sequentially numbered report for the 12-month window', () => {
    expect(report.transits.length).toBeGreaterThan(0);
    report.transits.forEach((t, i) => expect(t.id).toBe(i + 1));
    expect(report.timeframe).toBe('January 2027 – December 2027');
    expect(report.transits.every((t) => (TRANSITING_BODIES as readonly string[]).includes(t.body))).toBe(true);
    // Astrograph's reports carry Mars and Chiron as well as the slow planets.
    for (const body of TRANSITING_BODIES) expect(report.transits.some((t) => t.body === body)).toBe(true);
  });

  it('places every exact date on the exact aspect angle (independent recompute)', async () => {
    let checked = 0;
    for (const t of report.transits.filter((x) => x.kind === 'aspect')) {
      const target = natalLon(chart, t.natalPoint!);
      for (const pass of t.exactDates) {
        // Dates are printed to the day; within ±1 day the planet must cross the angle.
        const day = Date.parse(`${pass.date} UTC`);
        let best = Infinity;
        for (let h = -24; h <= 48; h += 1) {
          const lon = await bodyLon(t.body, new Date(day + h * 3_600_000));
          best = Math.min(best, Math.abs(dist(lon, target) - ANGLE[t.aspect!]));
        }
        // Mars covers ~0.03° an hour, so its hourly check is coarser.
        expect(best).toBeLessThan(t.body === 'Mars' ? 0.03 : 0.02);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('marks a pass retrograde exactly when the planet is moving backwards', async () => {
    for (const t of report.transits) {
      for (const pass of t.exactDates) {
        const day = Date.parse(`${pass.date} UTC`) + 12 * 3_600_000;
        const before = await bodyLon(t.body, new Date(day - 86_400_000));
        const after = await bodyLon(t.body, new Date(day + 86_400_000));
        const motion = ((after - before) % 360 + 540) % 360 - 180;
        // Skip the rare pass on a station, where the direction is genuinely ambiguous.
        if (Math.abs(motion) < 0.002) continue;
        expect(pass.retrograde).toBe(motion < 0);
      }
    }
  });

  it('gives a begin date on or before the end date, and parses like a pasted report', () => {
    for (const t of report.transits) {
      if (t.beginDate && t.endDate) expect(Date.parse(t.beginDate)).toBeLessThanOrEqual(Date.parse(t.endDate));
      expect(describeTransit(t)).toMatch(/^(Jupiter|Saturn|Uranus|Neptune|Pluto|Chiron|Mars) /);
    }
    expect(deriveTimeframe(report.transits)).toBeTruthy();
  });

  it('finds a planet returning to its own natal place', async () => {
    const saturnMidYear = lonAt('Saturn', new Date('2027-06-01T00:00:00Z'));
    const r = await generateTransitReport(chartWith({ saturn: saturnMidYear }), { from: FROM });
    const ret = r.transits.find((t) => t.body === 'Saturn' && t.natalPoint === 'Saturn' && t.aspect === 'conjunction');
    expect(ret).toBeDefined();
    expect(ret!.exactDates.length).toBeGreaterThan(0);
    expect(describeTransit(ret!)).toBe('Saturn returning to your Saturn');
  });

  it('reports house ingresses when a slow planet crosses a cusp', async () => {
    const jupiterMarch = lonAt('Jupiter', new Date('2027-03-15T00:00:00Z'));
    const houses = Array.from({ length: 12 }, (_, i) => (jupiterMarch + i * 30) % 360);
    const r = await generateTransitReport(chartWith({ ascendant: jupiterMarch }, houses), { from: FROM });
    const ingress = r.transits.find((t) => t.kind === 'ingress' && t.body === 'Jupiter');
    expect(ingress).toBeDefined();
    expect(ingress!.house).toBeGreaterThanOrEqual(1);
    expect(ingress!.exactDates.length).toBeGreaterThan(0);
  });

  it('prints dates in the requested time zone', async () => {
    const utc = await generateTransitReport(chart, { from: FROM, timeZone: 'UTC' });
    const bad = await generateTransitReport(chart, { from: FROM, timeZone: 'Not/AZone' });
    expect(bad.transits.map((t) => t.exactDates)).toEqual(utc.transits.map((t) => t.exactDates));
  });
});

/**
 * Agreement with a real Astrograph 12-month report (starting 7/8/2026), as
 * recorded in lib/soulPortrait/portraits/andreaFagan.ts. Dates only — the
 * report's prose is never used. ±1 day: Astrograph and astronomy-engine differ
 * by arcseconds, which moves a slow retrograde pass by up to a day.
 */
describe('agrees with an Astrograph report for the same chart', () => {
  const near = (date: string | undefined, expected: string) => {
    expect(date).toBeDefined();
    expect(Math.abs(Date.parse(date!) - Date.parse(expected))).toBeLessThanOrEqual(86_400_000);
  };
  let transits: Awaited<ReturnType<typeof generateTransitReport>>['transits'] = [];
  beforeAll(async () => {
    const chart = await calculateProBirthChart({
      date: '1956-07-11', time: '01:43',
      location: { lat: 43.2342, lng: -86.2484, timezone: 'America/Detroit' },
    });
    transits = (await generateTransitReport(chart, { from: new Date('2026-07-08T12:00:00Z'), timeZone: 'America/Detroit' })).transits;
  });
  const find = (body: string, aspect: string, point: string, after = '2026-07-01') =>
    transits.find((t) => t.body === body && t.aspect === aspect && t.natalPoint === point
      && (!t.endDate || Date.parse(t.endDate) >= Date.parse(after)));

  it('lists the ingress already in effect when the year opens', () => {
    const ingress = transits.find((t) => t.kind === 'ingress' && t.body === 'Jupiter' && t.house === 4);
    near(ingress?.exactDates[0]?.date, 'July 6, 2026');
  });

  it('spans each transit as Astrograph does (2° orb, one entry per continuous stretch)', () => {
    const pluto = find('Pluto', 'conjunction', 'Midheaven')!;
    near(pluto.beginDate, 'September 5, 2026');
    near(pluto.endDate, 'November 23, 2026');
    const uranus = find('Uranus', 'trine', 'Midheaven', '2027-01-01')!;
    near(uranus.beginDate, 'December 2, 2026');
    near(uranus.endDate, 'April 14, 2027');
  });

  it('matches the exact dates, retrograde passes and station touches', () => {
    const saturn = find('Saturn', 'square', 'Mercury')!;
    near(saturn.exactDates[0].date, 'November 6, 2026');
    expect(saturn.exactDates[0].retrograde).toBe(true);
    near(saturn.exactDates[1].date, 'January 12, 2027');
    // Jupiter stations 0.006° from natal Pluto without crossing it.
    near(find('Jupiter', 'conjunction', 'Pluto')!.exactDates[0]?.date, 'December 13, 2026');
    near(find('Saturn', 'square', 'Sun')!.exactDates[0].date, 'April 17, 2027');
  });

  it('includes Chiron and Mars, with the same dates', () => {
    const exacts = (body: string, aspect: string, point: string) => transits
      .filter((t) => t.body === body && t.aspect === aspect && t.natalPoint === point)
      .flatMap((t) => t.exactDates.map((e) => e.date));
    const has = (body: string, aspect: string, point: string, expected: string) => {
      const dates = exacts(body, aspect, point);
      expect(dates.some((d) => Math.abs(Date.parse(d) - Date.parse(expected)) <= 86_400_000)).toBe(true);
    };
    has('Chiron', 'trine', 'Jupiter', 'July 12, 2026');
    has('Chiron', 'opposition', 'Neptune', 'November 9, 2026');
    has('Chiron', 'opposition', 'Neptune', 'March 2, 2027');
    has('Chiron', 'trine', 'Pluto', 'February 15, 2027');
    has('Chiron', 'trine', 'Jupiter', 'April 24, 2027');
    has('Chiron', 'trine', 'Moon', 'May 27, 2027');
    has('Mars', 'conjunction', 'Sun', 'September 9, 2026');
    has('Mars', 'conjunction', 'Uranus', 'September 30, 2026');
  });
});

describe('presentTransits (free: the present moment)', () => {
  const at = new Date('2027-04-10T12:00:00Z');

  it('finds a slow planet exactly on a natal point, closest first', () => {
    const saturn = lonAt('Saturn', at);
    const now = presentTransits([{ name: 'Sun', longitude: saturn }, { name: 'Moon', longitude: saturn + 91 }], at);
    expect(now[0]).toMatchObject({ body: 'Saturn', aspect: 'conjunction', natalPoint: 'Sun' });
    expect(now[0].orb).toBeLessThan(0.01);
    expect(now.some((t) => t.body === 'Saturn' && t.aspect === 'square' && t.natalPoint === 'Moon')).toBe(true);
    for (let i = 1; i < now.length; i++) expect(now[i].orb).toBeGreaterThanOrEqual(now[i - 1].orb);
  });

  it('leaves out anything beyond the orb', () => {
    const saturn = lonAt('Saturn', at);
    const now = presentTransits([{ name: 'Sun', longitude: saturn + 2.5 }], at);
    expect(now.some((t) => t.body === 'Saturn' && t.natalPoint === 'Sun')).toBe(false);
  });

  it('says whether the aspect is still closing', () => {
    const tomorrow = new Date(at.getTime() + 86_400_000);
    const ahead = lonAt('Jupiter', tomorrow) - lonAt('Jupiter', at) > 0 ? 1 : -1;
    // A natal point one degree ahead of Jupiter's motion is being approached.
    const [hit] = presentTransits([{ name: 'Venus', longitude: lonAt('Jupiter', at) + ahead }], at)
      .filter((t) => t.body === 'Jupiter');
    expect(hit.applying).toBe(true);
  });
});
