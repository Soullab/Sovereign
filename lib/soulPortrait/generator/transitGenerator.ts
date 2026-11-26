/**
 * Transit generator — calculates a 12-month transit report from a natal chart.
 *
 * Replaces the copy-paste of a third-party report (TimePassages / Astrograph)
 * as the Year Ahead source. Its output is the SAME `ParsedTransit[]` shape the
 * report parser yields (transitReportParser.ts), so the Year Ahead generator,
 * its transit-citation guard and the rendering are unchanged.
 *
 * DATA ONLY. Every value is astronomical: which slow planet, which aspect, which
 * natal point, the dates it is within orb, the exact dates (with retrograde
 * passes), and the house ingresses. No meaning is assigned here.
 *
 * Method: daily geocentric apparent longitudes (proEphemerisSeries) over the
 * window padded by up to a year on each side, so a transit already in effect at
 * the start, or still in effect at the end, carries its true begin/end dates.
 * Exact moments are linear interpolations between daily samples — accurate to
 * well within a day for Jupiter and slower.
 */
import type { BirthChart } from '@/lib/astrology/proEphemerisCalculator';
import { aspectEndpointLongitudes, normalizeLongitude } from '@/lib/astrology/proChartGeometry';
import { ephemerisSeries, SERIES_LIMITS, type SeriesBody } from '@/lib/astrology/proEphemerisSeries';
import {
  DEFAULT_ORBS, TRANSIT_ASPECTS as ASPECTS, TRANSITING_BODIES, type TransitingBody,
} from '@/lib/astrology/presentTransits';
import type { ExactPass, ParsedTransit } from './transitReportParser';

export { DEFAULT_ORBS, TRANSITING_BODIES, type TransitingBody };

/** Natal points a transit may contact. South Node is left out: it only mirrors the North Node. */
const NATAL_POINTS = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  'Chiron', 'North Node', 'Ascendant', 'Midheaven',
] as const;

/** Two in-orb runs closer than this belong to one transit (a retrograde loop). */
const MERGE_GAP_DAYS = 200;
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

interface Pass { ms: number; retrograde: boolean }

interface Run { start: number; end: number }

/** Sample-index runs where |delta| ≤ orb, with nearby runs merged. */
function inOrbRuns(deltas: number[], orb: number, mergeGap: number): Run[] {
  const runs: Run[] = [];
  let start = -1;
  for (let i = 0; i < deltas.length; i++) {
    const inside = Math.abs(deltas[i]) <= orb;
    if (inside && start < 0) start = i;
    if (!inside && start >= 0) { runs.push({ start, end: i - 1 }); start = -1; }
  }
  if (start >= 0) runs.push({ start, end: deltas.length - 1 });
  const merged: Run[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && run.start - last.end <= mergeGap) last.end = run.end;
    else merged.push({ ...run });
  }
  return merged;
}

/** Exact crossings of zero inside [start, end] (sample indices), interpolated. */
function exactPasses(deltas: number[], start: number, end: number, t0: number, stepMs: number): Pass[] {
  const passes: Pass[] = [];
  for (let i = Math.max(1, start); i <= end; i++) {
    const d0 = deltas[i - 1];
    const d1 = deltas[i];
    if (d0 === 0 || Math.sign(d0) === Math.sign(d1) || Math.abs(d1 - d0) > 90) continue;
    const fraction = d0 / (d0 - d1);
    passes.push({ ms: t0 + (i - 1 + fraction) * stepMs, retrograde: d1 < d0 });
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
 * Calculate the transit report for `chart` over the window. Pure and
 * deterministic for a given chart and `from`.
 */
export function generateTransitReport(
  chart: BirthChart,
  options: GenerateTransitsOptions = {},
): GeneratedTransitReport {
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
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const natal = aspectEndpointLongitudes(chart);
  const drafts: Draft[] = [];

  // ── Aspects ────────────────────────────────────────────────────────────────
  for (const body of TRANSITING_BODIES) {
    const lons = series.longitudes[body as SeriesBody];
    for (const point of NATAL_POINTS) {
      const natalLon = natal.get(point);
      if (natalLon === undefined) continue;
      for (const [aspect, angle] of ASPECTS) {
        const targets = angle === 0 || angle === 180
          ? [natalLon + angle]
          : [natalLon + angle, natalLon - angle];
        for (const target of targets) {
          const deltas = lons.map((lon) => signedDelta(lon, normalizeLongitude(target)));
          for (const run of inOrbRuns(deltas, orbs[body], MERGE_GAP_DAYS)) {
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
      const lons = series.longitudes[body as SeriesBody];
      const byHouse = new Map<number, Pass[]>();
      for (let k = 0; k < 12; k++) {
        const deltas = lons.map((lon) => signedDelta(lon, cusps[k]));
        for (const pass of exactPasses(deltas, 0, deltas.length - 1, t0, stepMs)) {
          if (pass.ms < fromMs || pass.ms > toMs) continue;
          // Crossing cusp k forwards enters house k+1; backwards (retrograde) re-enters house k.
          const house = pass.retrograde ? ((k + 11) % 12) + 1 : k + 1;
          byHouse.set(house, [...(byHouse.get(house) ?? []), pass]);
        }
      }
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
