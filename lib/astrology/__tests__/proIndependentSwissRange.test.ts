/**
 * The Pro engine against Swiss Ephemeris outside the 1985-2026 fixtures, plus
 * mean Lilith and planet stations. ALL CASES ARE PUBLIC/SYNTHETIC.
 *
 * References: fixtures/swissRangeAndStations.json, generated outside the
 * Soullab code by scripts/astrology/generate-swiss-range-and-stations.py
 * (PySwissEph 2.10.03, Moshier backend). Numerical reference fixtures only,
 * not evidence about astrological interpretation.
 */
import * as Astronomy from 'astronomy-engine';
import { calculateBirthChart, classifyApparentMotion, type BirthChart } from '../proEphemerisCalculator';
import { admitProCalculation } from '../proCalculationPolicy';
import reference from './fixtures/swissRangeAndStations.json';

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const longitude = (p: { sign: string; degree: number }) => SIGNS.indexOf(p.sign) * 30 + p.degree;
const delta = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

// Same tolerance as the 1985-2026 fixtures.
const TOLERANCE = 0.025;
// Mean Lilith uses Meeus's mean-perigee series; Swiss's mean apogee carries
// more terms. Measured worst over 1900-2100: 0.117°. The tolerance holds
// that, so a regression shows, and does not claim Swiss precision.
const LILITH_TOLERANCE = 0.15;

const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;

async function chartAt(utc: string): Promise<BirthChart> {
  const admitted = admitProCalculation({
    date: utc.slice(0, 10), time: utc.slice(11, 16), location: { lat: 0, lng: 0, timezone: 'Etc/UTC' }, houseSystem: 'porphyry',
  });
  if (!admitted.ok) throw new Error(`refused ${utc}: ${admitted.error}`);
  return calculateBirthChart(admitted.birthData);
}

describe('Pro engine vs Swiss Ephemeris, 1900-2100', () => {
  for (const row of reference.positions) {
    it(`${row.utc}: planets and mean node within ${TOLERANCE}°, mean Lilith within ${LILITH_TOLERANCE}°`, async () => {
      const chart = await chartAt(row.utc);
      for (const planet of PLANETS) {
        expect({ planet, error: delta(longitude(chart[planet]), row[planet]) <= TOLERANCE }).toEqual({ planet, error: true });
      }
      expect(delta(longitude(chart.northNode), row.meanNode)).toBeLessThanOrEqual(TOLERANCE);
      expect(delta(longitude(chart.southNode), (row.meanNode + 180) % 360)).toBeLessThanOrEqual(TOLERANCE);
      expect(delta(longitude(chart.lilith), row.meanLilith)).toBeLessThanOrEqual(LILITH_TOLERANCE);
    });
  }
});

describe('Chiron and Ceres vs Swiss Ephemeris, 1900-2100', () => {
  // They come from JPL Horizons positions (proMinorBodyEphemeris.ts). The
  // single-orbit method before 2026-11-21 was up to 9° (Chiron) and 17°
  // (Ceres) out against these references.
  for (const row of reference.minorBodies) {
    it(`${row.utc}: Chiron and Ceres within ${TOLERANCE}°`, async () => {
      const chart = await chartAt(row.utc);
      expect(delta(longitude(chart.chiron), row.chiron)).toBeLessThanOrEqual(TOLERANCE);
      expect(delta(longitude(chart.ceres), row.ceres)).toBeLessThanOrEqual(TOLERANCE);
    });
  }

  it('Ceres is in Cancer on 2026-11-21, not Leo', async () => {
    expect((await chartAt('2026-11-21T12:00:00Z')).ceres.sign).toBe('Cancer');
  });
});

describe('Pro motion labels around Swiss stations, 2018-2026', () => {
  it('has the stations of every planet from Mercury to Pluto', () => {
    expect(new Set(reference.stations.map((s) => s.body)).size).toBe(8);
    expect(reference.stations.length).toBeGreaterThan(100);
  });

  const HOUR = 3_600_000;
  for (const s of reference.stations) {
    const before = s.turns === 'retrograde' ? 'direct' : 'retrograde';
    it(`${s.body} turns ${s.turns} at ${new Date(s.utcMs).toISOString().slice(0, 16)}Z`, () => {
      const body = Astronomy.Body[s.body as keyof typeof Astronomy.Body];
      const at = (hours: number) => classifyApparentMotion(body, new Date(s.utcMs + hours * HOUR)).motionStatus;
      // A day or more away, the label is the right one.
      for (const h of [-72, -24]) expect(at(h)).toBe(before);
      for (const h of [24, 72]) expect(at(h)).toBe(s.turns);
      // Close to the station it may say uncertain, but never the wrong way.
      expect([before, 'stationary-uncertain']).toContain(at(-6));
      expect([s.turns, 'stationary-uncertain']).toContain(at(6));
    });
  }
});
