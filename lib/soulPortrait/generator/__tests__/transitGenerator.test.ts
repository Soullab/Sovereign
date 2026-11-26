/**
 * Transit generator — checked against the ephemeris itself, not against its
 * own output: every exact date it reports is recomputed independently and must
 * sit on the exact aspect angle, and every retrograde flag must match the
 * planet's actual direction of motion on that date.
 */
import * as Astronomy from 'astronomy-engine';
import type { BirthChart, PlanetPosition } from '@/lib/astrology/proEphemerisCalculator';
import { SIGNS } from '@/lib/astrology/proChartGeometry';
import { longitudeOf, type SeriesBody } from '@/lib/astrology/proEphemerisSeries';
import { presentTransits } from '@/lib/astrology/presentTransits';
import { generateTransitReport } from '../transitGenerator';
import { describeTransit, deriveTimeframe } from '../transitReportParser';

const ANGLE: Record<string, number> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
const FROM = new Date('2027-01-01T00:00:00Z');

function lonAt(body: SeriesBody, date: Date): number {
  return longitudeOf(body, Astronomy.MakeTime(date));
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
  const report = generateTransitReport(chart, { from: FROM });

  it('produces a sequentially numbered report for the 12-month window', () => {
    expect(report.transits.length).toBeGreaterThan(0);
    report.transits.forEach((t, i) => expect(t.id).toBe(i + 1));
    expect(report.timeframe).toBe('January 2027 – December 2027');
    expect(report.transits.every((t) => ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(t.body))).toBe(true);
  });

  it('places every exact date on the exact aspect angle (independent recompute)', () => {
    let checked = 0;
    for (const t of report.transits.filter((x) => x.kind === 'aspect')) {
      const target = natalLon(chart, t.natalPoint!);
      for (const pass of t.exactDates) {
        // Dates are printed to the day; within ±1 day the planet must cross the angle.
        const day = Date.parse(`${pass.date} UTC`);
        let best = Infinity;
        for (let h = -24; h <= 48; h += 1) {
          const lon = lonAt(t.body as SeriesBody, new Date(day + h * 3_600_000));
          best = Math.min(best, Math.abs(dist(lon, target) - ANGLE[t.aspect!]));
        }
        expect(best).toBeLessThan(0.02);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('marks a pass retrograde exactly when the planet is moving backwards', () => {
    for (const t of report.transits) {
      for (const pass of t.exactDates) {
        const day = Date.parse(`${pass.date} UTC`) + 12 * 3_600_000;
        const before = lonAt(t.body as SeriesBody, new Date(day - 86_400_000));
        const after = lonAt(t.body as SeriesBody, new Date(day + 86_400_000));
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
      expect(describeTransit(t)).toMatch(/^(Jupiter|Saturn|Uranus|Neptune|Pluto) /);
    }
    expect(deriveTimeframe(report.transits)).toBeTruthy();
  });

  it('finds a planet returning to its own natal place', () => {
    const saturnMidYear = lonAt('Saturn', new Date('2027-06-01T00:00:00Z'));
    const r = generateTransitReport(chartWith({ saturn: saturnMidYear }), { from: FROM });
    const ret = r.transits.find((t) => t.body === 'Saturn' && t.natalPoint === 'Saturn' && t.aspect === 'conjunction');
    expect(ret).toBeDefined();
    expect(ret!.exactDates.length).toBeGreaterThan(0);
    expect(describeTransit(ret!)).toBe('Saturn returning to your Saturn');
  });

  it('reports house ingresses when a slow planet crosses a cusp', () => {
    const jupiterMarch = lonAt('Jupiter', new Date('2027-03-15T00:00:00Z'));
    const houses = Array.from({ length: 12 }, (_, i) => (jupiterMarch + i * 30) % 360);
    const r = generateTransitReport(chartWith({ ascendant: jupiterMarch }, houses), { from: FROM });
    const ingress = r.transits.find((t) => t.kind === 'ingress' && t.body === 'Jupiter');
    expect(ingress).toBeDefined();
    expect(ingress!.house).toBeGreaterThanOrEqual(1);
    expect(ingress!.exactDates.length).toBeGreaterThan(0);
  });

  it('prints dates in the requested time zone', () => {
    const utc = generateTransitReport(chart, { from: FROM, timeZone: 'UTC' });
    const bad = generateTransitReport(chart, { from: FROM, timeZone: 'Not/AZone' });
    expect(bad.transits.map((t) => t.exactDates)).toEqual(utc.transits.map((t) => t.exactDates));
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
