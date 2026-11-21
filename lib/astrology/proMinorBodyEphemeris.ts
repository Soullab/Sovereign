/**
 * Chiron and Ceres from NASA JPL Horizons positions (2026-11-21). They had come
 * from one fixed Keplerian orbit, measured against the J2000 ecliptic: against
 * Swiss Ephemeris that put Chiron up to 9° and Ceres up to 17° out between
 * 1900 and 2100, with Ceres in the wrong sign in November 2026.
 *
 * data/minorBodyVectors.json holds heliocentric ICRF vectors at fixed TDB
 * steps from 1800 to 2200 (scripts/astrology/fetch-jpl-minor-bodies.mjs). This
 * interpolates them, corrects for light-time and aberration, and takes the
 * true ecliptic longitude of date, as the planets are.
 *
 * The table is loaded on first use with a dynamic import, so it stays out of
 * the browser bundle (client components import constants from the engine).
 */
import * as Astronomy from 'astronomy-engine';

export type MinorBody = 'chiron' | 'ceres';

interface BodyTable { startJdTdb: number; stepDays: number; count: number; xyz: number[] }
type Tables = Record<MinorBody, BodyTable>;

const LIGHT_DAYS_PER_AU = 0.005775518331436995;
const J2000_JD = 2451545.0;

let tables: Promise<Tables> | null = null;
function load(): Promise<Tables> {
  tables ??= import('./data/minorBodyVectors.json').then((m) => {
    const data = ((m as { default?: unknown }).default ?? m) as { bodies: Tables };
    return data.bodies;
  });
  return tables;
}

/** Heliocentric ICRF position (AU) at a TDB Julian day, by four-point Lagrange interpolation. */
function heliocentric(t: BodyTable, jdTdb: number): [number, number, number] {
  const f = (jdTdb - t.startJdTdb) / t.stepDays;
  const i = Math.floor(f);
  if (!(i >= 1 && i + 2 < t.count)) throw new Error('MINOR_BODY_OUT_OF_RANGE');
  const s = f - i;
  // Weights for nodes i-1, i, i+1, i+2 at fraction s from node i.
  const w = [
    -s * (s - 1) * (s - 2) / 6,
    (s + 1) * (s - 1) * (s - 2) / 2,
    -(s + 1) * s * (s - 2) / 2,
    (s + 1) * s * (s - 1) / 6,
  ];
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const row = (i - 1 + k) * 3;
    out[0] += w[k] * t.xyz[row];
    out[1] += w[k] * t.xyz[row + 1];
    out[2] += w[k] * t.xyz[row + 2];
  }
  return out;
}

/** Apparent geocentric longitude on the true ecliptic of date, in degrees. */
export async function minorBodyLongitude(body: MinorBody, date: Date): Promise<number> {
  const table = (await load())[body];
  const time = Astronomy.MakeTime(date);
  const earth = Astronomy.HelioState(Astronomy.Body.Earth, time);
  const jd = time.tt + J2000_JD;
  let light = 0;
  let d: [number, number, number] = [0, 0, 0];
  for (let pass = 0; pass < 3; pass++) {
    const p = heliocentric(table, jd - light);
    d = [p[0] - earth.x, p[1] - earth.y, p[2] - earth.z];
    light = Math.hypot(d[0], d[1], d[2]) * LIGHT_DAYS_PER_AU;
  }
  // Annual aberration: shift by the Earth's velocity over the light-time.
  const apparent = new Astronomy.Vector(d[0] + earth.vx * light, d[1] + earth.vy * light, d[2] + earth.vz * light, time);
  return Astronomy.Ecliptic(apparent).elon;
}
