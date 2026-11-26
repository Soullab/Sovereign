/**
 * Transit generator — calculates a 12-month transit report from a natal chart.
 *
 * Replaces the copy-paste of a third-party report (TimePassages / Astrograph)
 * as the Year Ahead source. Its output is the SAME `ParsedTransit[]` shape the
 * report parser yields (transitReportParser.ts), so the Year Ahead generator,
 * its transit-citation guard and the rendering are unchanged.
 *
 * DATA ONLY. Every value is astronomical: which transiting body, which aspect, which
 * natal point, the dates it is within orb, the exact dates (with retrograde
 * passes), and the house ingresses. No meaning is assigned here.
 *
 * Method: daily geocentric apparent longitudes (proEphemerisSeries) over the
 * window padded by up to a year on each side, so a transit already in effect at
 * the start, or still in effect at the end, carries its true begin/end dates.
 * Exact moments are linear interpolations between daily samples — accurate to
 * well within an hour for Mars and slower.
 */
import type { BirthChart } from '@/lib/astrology/proEphemerisCalculator';
import { aspectEndpointLongitudes, normalizeLongitude } from '@/lib/astrology/proChartGeometry';
import { ephemerisSeries, SERIES_LIMITS, type SeriesBody } from '@/lib/astrology/proEphemerisSeries';
import { minorBodyLongitudes } from '@/lib/astrology/proMinorBodyEphemeris';
import { DEFAULT_ORBS as SLOW_ORBS, TRANSIT_ASPECTS as ASPECTS, TRANSITING_BODIES as SLOW_BODIES } from '@/lib/astrology/presentTransits';
import type { ExactPass, ParsedTransit } from './transitReportParser';

/**
 * Transiting bodies in a Year Ahead, as in Astrograph's 12-month reports: the
 * slow planets, Chiron, and Mars. (The free present-moment view keeps to the
 * slow planets.) Chiron comes from the JPL table (proMinorBodyEphemeris).
 */
export const TRANSITING_BODIES = [...SLOW_BODIES, 'Chiron', 'Mars'] as const;
export type TransitingBody = typeof TRANSITING_BODIES[number];

export const DEFAULT_ORBS: Record<TransitingBody, number> = { ...SLOW_ORBS, Chiron: 2, Mars: 2 };

/** Natal points a transit may contact. South Node is left out: it only mirrors the North Node. */
const NATAL_POINTS = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  'Chiron', 'North Node', 'Ascendant', 'Midheaven',
] as const;

const DAY_MS = 86_400_000;

export interface TransitWindow {
  from: Date;
  to: Date;
}

export interface GenerateTransitsOptions {
  /** Start of the report. Default: now. */
  from?: Date;
  /** Length in months. Default 12. */
  months?: number;
  /** IANA zone in which dates are printed. Default UTC. */
  timeZone?: string;
  orbs?: Partial<Record<TransitingBody, number>>;
  /** Include house ingresses (needs house cusps). Default true. */
  ingresses?: boolean;
}

export interface GeneratedTransitReport {
  transits: ParsedTransit[];
  /** "December 2026 – November 2027" — the requested window, not the padded one. */
  timeframe: string;
  window: TransitWindow;
}

function signedDelta(value: number, target: number): number {
  return ((value - target) % 360 + 540) % 360 - 180;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function formatDate(ms: number, timeZone: string): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone });
}

function formatMonth(ms: number, timeZone: string): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone });
}

function safeTimeZone(timeZone: string | undefined): string {
  if (!timeZone) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

/** `touch`: a station within STATION_TOUCH_DEG of exact, with no crossing. */
interface Pass { ms: number; retrograde: boolean; touch?: boolean }

interface Run { start: number; end: number }

/**
 * Sample-index runs where |delta| ≤ orb. Each continuous run is one transit,
 * as in Astrograph's reports: a retrograde loop that stays in orb is one entry
 * with several exact dates; one that leaves orb and returns is a new entry.
 */
function inOrbRuns(deltas: number[], orb: number): Run[] {
  const runs: Run[] = [];
  let start = -1;
  for (let i = 0; i < deltas.length; i++) {
    const inside = Math.abs(deltas[i]) <= orb;
    if (inside && start < 0) start = i;
    if (!inside && start >= 0) { runs.push({ start, end: i - 1 }); start = -1; }
  }
  if (start >= 0) runs.push({ start, end: deltas.length - 1 });
  return runs;
}

/**
 * A planet that stations this close to the exact angle without crossing it
 * still makes the aspect exact (Astrograph reports these; e.g. a Jupiter
 * station 0.006° from a natal point).
 */
const STATION_TOUCH_DEG = 0.02;

/** Exact crossings of zero inside [start, end] (sample indices), interpolated, plus station touches. */
function exactPasses(deltas: number[], start: number, end: number, t0: number, stepMs: number): Pass[] {
  const passes: Pass[] = [];
  for (let i = Math.max(1, start); i <= end; i++) {
    const d0 = deltas[i - 1];
    const d1 = deltas[i];
    if (Math.abs(d1 - d0) > 90) continue;
    if (d0 !== 0 && Math.sign(d0) !== Math.sign(d1)) {
      const fraction = d0 / (d0 - d1);
      passes.push({ ms: t0 + (i - 1 + fraction) * stepMs, retrograde: d1 < d0 });
      continue;
    }
    // Station touch: |delta| at a local minimum, no sign change on either side.
    const d2 = deltas[i + 1];
    if (i < end && d2 !== undefined && Math.abs(d1) <= STATION_TOUCH_DEG
      && Math.abs(d1) < Math.abs(d0) && Math.abs(d1) <= Math.abs(d2)
      && Math.sign(d1) === Math.sign(d0) && Math.sign(d1) === Math.sign(d2)) {
      // The planet is turning here, so the pass is printed unmarked (as Astrograph does).
      passes.push({ ms: t0 + i * stepMs, retrograde: false, touch: true });
    }
  }
  return passes;
}

interface Draft extends Omit<ParsedTransit, 'id' | 'exactDates' | 'beginDate' | 'endDate'> {
  sortMs: number;
  beginMs?: number;
  endMs?: number;
  passes: Pass[];
}

/**
 * Calculate the transit report for `chart` over the window. Deterministic for
 * a given chart and `from`; async only because Chiron's table loads on first use.
 */
export async function generateTransitReport(
  chart: BirthChart,
  options: GenerateTransitsOptions = {},
): Promise<GeneratedTransitReport> {
  const from = options.from ?? new Date();
  const months = Math.min(Math.max(Math.round(options.months ?? 12), 1), 12);
  const to = addMonths(from, months);
  const timeZone = safeTimeZone(options.timeZone);
  const orbs = { ...DEFAULT_ORBS, ...options.orbs };

  // Pad each side so begin/end dates of transits straddling the window are true,
  // staying inside the series limits (12 months + 2 × pad ≤ maxDays).
  const windowDays = Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
  const pad = Math.floor((SERIES_LIMITS.maxDays - windowDays - 2) / 2);
  const seriesFrom = new Date(from.getTime() - pad * DAY_MS);
  const seriesTo = new Date(to.getTime() + pad * DAY_MS);
  const series = ephemerisSeries(seriesFrom, seriesTo, 24);
  if (!series) throw new Error('transit_window_out_of_range');
  const t0 = new Date(series.from).getTime();
  const stepMs = series.stepHours * 3_600_000;
  const msAt = (i: number) => t0 + i * stepMs;
  const sampleCount = series.longitudes.Sun.length;
  const longitudes: Record<TransitingBody, number[]> = {
    ...Object.fromEntries(TRANSITING_BODIES.filter((b) => b !== 'Chiron')
      .map((b) => [b, series.longitudes[b as SeriesBody]])),
    Chiron: await minorBodyLongitudes('chiron', Array.from({ length: sampleCount }, (_, i) => new Date(msAt(i)))),
  } as Record<TransitingBody, number[]>;
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const natal = aspectEndpointLongitudes(chart);
  const drafts: Draft[] = [];

  // ── Aspects ────────────────────────────────────────────────────────────────
  for (const body of TRANSITING_BODIES) {
    const lons = longitudes[body];
    for (const point of NATAL_POINTS) {
      const natalLon = natal.get(point);
      if (natalLon === undefined) continue;
      for (const [aspect, angle] of ASPECTS) {
        const targets = angle === 0 || angle === 180
          ? [natalLon + angle]
          : [natalLon + angle, natalLon - angle];
        for (const target of targets) {
          const deltas = lons.map((lon) => signedDelta(lon, normalizeLongitude(target)));
          for (const run of inOrbRuns(deltas, orbs[body])) {
            const beginMs = msAt(run.start);
            const endMs = msAt(run.end);
            // Only transits in effect at some point inside the window.
            if (endMs < fromMs || beginMs > toMs) continue;
            const passes = exactPasses(deltas, run.start, run.end, t0, stepMs);
            // A run touching the padded edge is cut off: its date there is not a true begin/end.
            const openStart = run.start === 0;
            const openEnd = run.end === deltas.length - 1;
            drafts.push({
              kind: 'aspect',
              body,
              aspect,
              natalPoint: point,
              beginMs: openStart ? undefined : beginMs,
              endMs: openEnd ? undefined : endMs,
              passes,
              sortMs: passes.find((p) => p.ms >= fromMs)?.ms ?? passes[0]?.ms ?? Math.max(beginMs, fromMs),
            });
          }
        }
      }
    }
  }

  // ── House ingresses ────────────────────────────────────────────────────────
  const cusps = Array.isArray(chart.houses) && chart.houses.length === 12 && chart.houses.every(Number.isFinite)
    ? chart.houses.map(normalizeLongitude)
    : null;
  if (cusps && options.ingresses !== false) {
    for (const body of TRANSITING_BODIES) {
      const lons = longitudes[body];
      const byHouse = new Map<number, Pass[]>();
      // The ingress that put the planet in the house it occupies when the
      // window opens is part of the year too (a report starting Jul 8 lists
      // "Jupiter enters your 4th house, Jul 6").
      let lastBefore: { house: number; pass: Pass } | null = null;
      for (let k = 0; k < 12; k++) {
        const deltas = lons.map((lon) => signedDelta(lon, cusps[k]));
        // Only true crossings change house; a station touch on a cusp does not.
        for (const pass of exactPasses(deltas, 0, deltas.length - 1, t0, stepMs)
          .filter((p) => !p.touch)) {
          // Crossing cusp k forwards enters house k+1; backwards (retrograde) re-enters house k.
          const house = pass.retrograde ? ((k + 11) % 12) + 1 : k + 1;
          if (pass.ms < fromMs) {
            if (!lastBefore || pass.ms > lastBefore.pass.ms) lastBefore = { house, pass };
            continue;
          }
          if (pass.ms > toMs) continue;
          byHouse.set(house, [...(byHouse.get(house) ?? []), pass]);
        }
      }
      if (lastBefore) byHouse.set(lastBefore.house, [lastBefore.pass, ...(byHouse.get(lastBefore.house) ?? [])]);
      for (const [house, passes] of byHouse) {
        passes.sort((a, b) => a.ms - b.ms);
        drafts.push({ kind: 'ingress', body, house, passes, sortMs: passes[0].ms, beginMs: passes[0].ms });
      }
    }
  }

  drafts.sort((a, b) => a.sortMs - b.sortMs
    || TRANSITING_BODIES.indexOf(b.body as TransitingBody) - TRANSITING_BODIES.indexOf(a.body as TransitingBody));

  const transits: ParsedTransit[] = drafts.map((d, index) => {
    const exactDates: ExactPass[] = d.passes.map((p) => ({ date: formatDate(p.ms, timeZone), retrograde: p.retrograde }));
    const t: ParsedTransit = { id: index + 1, kind: d.kind, body: d.body, exactDates };
    if (d.kind === 'aspect') { t.aspect = d.aspect; t.natalPoint = d.natalPoint; }
    else t.house = d.house;
    if (d.beginMs !== undefined) t.beginDate = formatDate(d.beginMs, timeZone);
    if (d.kind === 'aspect' && d.endMs !== undefined) t.endDate = formatDate(d.endMs, timeZone);
    return t;
  });

  // Label the window by its middle-of-first-day and middle-of-last-day, so a
  // zone offset of a few hours never shifts it into the neighbouring month.
  const fromLabel = formatMonth(fromMs + DAY_MS / 2, timeZone);
  const toLabel = formatMonth(toMs - DAY_MS / 2, timeZone);
  return {
    transits,
    timeframe: fromLabel === toLabel ? fromLabel : `${fromLabel} – ${toLabel}`,
    window: { from, to },
  };
}
