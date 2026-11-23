#!/usr/bin/env node
/**
 * Builds lib/astrology/data/minorBodyVectors.json from NASA JPL Horizons
 * (https://ssd.jpl.nasa.gov/api/horizons.api; JPL ephemeris data is public
 * domain). Run by hand when the table needs regenerating:
 *
 *   node scripts/astrology/fetch-jpl-minor-bodies.mjs
 *
 * For Chiron (2060) and Ceres (1): heliocentric geometric position vectors,
 * ICRF/J2000 equatorial frame (the frame of astronomy-engine's HelioVector),
 * in AU, at fixed steps in TDB from 1800 to 2200. The engine interpolates
 * between steps and adds light-time and the Earth's position itself.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../lib/astrology/data/minorBodyVectors.json');
const START = '1800-01-01';
const STOP = '2200-01-01';
// Steps short enough that four-point interpolation is far below 0.001°.
const BODIES = [
  { key: 'chiron', command: '2060;', stepDays: 40 },
  { key: 'ceres', command: '1;', stepDays: 10 },
];

async function fetchBody({ key, command, stepDays }) {
  const params = new URLSearchParams({
    format: 'json', COMMAND: `'${command}'`, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS',
    CENTER: "'500@10'", REF_PLANE: 'FRAME', REF_SYSTEM: 'ICRF', VEC_TABLE: '1', VEC_CORR: 'NONE',
    OUT_UNITS: 'AU-D', CSV_FORMAT: 'YES', VEC_LABELS: 'NO', TIME_TYPE: 'TDB',
    START_TIME: `'${START}'`, STOP_TIME: `'${STOP}'`, STEP_SIZE: `'${stepDays} d'`,
  });
  const res = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`);
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
  const body = await res.json();
  const text = body.result ?? '';
  const table = text.split('$$SOE')[1]?.split('$$EOE')[0];
  if (!table) throw new Error(`${key}: no table in Horizons reply:\n${text.slice(0, 800)}`);
  const rows = table.trim().split('\n').map((line) => line.split(',').map((s) => s.trim()));
  const startJd = Number(rows[0][0]);
  const xyz = [];
  rows.forEach((r, i) => {
    const jd = Number(r[0]);
    if (Math.abs(jd - (startJd + i * stepDays)) > 1e-6) throw new Error(`${key}: irregular step at row ${i}`);
    for (const v of r.slice(2, 5)) xyz.push(Number(Number(v).toFixed(7)));
  });
  const source = text.match(/Target body name:[^\n]*/)?.[0]?.trim() ?? command;
  return { key, source, startJdTdb: startJd, stepDays, count: rows.length, xyz };
}

const bodies = {};
for (const b of BODIES) {
  const got = await fetchBody(b);
  bodies[got.key] = got;
  console.log(`${got.key}: ${got.count} rows from ${got.source}`);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  generator: 'scripts/astrology/fetch-jpl-minor-bodies.mjs',
  source: 'NASA JPL Horizons, heliocentric geometric vectors, ICRF equatorial, AU, TDB',
  fetched: new Date().toISOString().slice(0, 10),
  bodies,
}));
console.log(`wrote ${OUT}`);
