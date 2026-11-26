/**
 * The slow-planet transits touching a natal chart at one moment — the free
 * "present moment" view. Geometry only: which slow planet, which aspect, which
 * natal point, how close, and whether it is still closing. No dates ahead, no
 * meaning assigned; the 12-month calculation with exact dates is Pro
 * (lib/soulPortrait/generator/transitGenerator.ts), which shares these orbs.
 */
import * as Astronomy from 'astronomy-engine';
import { longitudeOf } from './proEphemerisSeries';

/** The slow planets a transit reading follows. */
export const TRANSITING_BODIES = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
export type TransitingBody = typeof TRANSITING_BODIES[number];

/**
 * Orb in degrees within which a transit counts as "in effect". 2° for every
 * slow planet: read off the begin/end dates of two real Astrograph 12-month
 * reports (Pluto, Uranus each 2.0° at both ends), so a calculated Year Ahead
 * covers the same spans the pasted reports did.
 */
export const DEFAULT_ORBS: Record<TransitingBody, number> = {
  Jupiter: 2, Saturn: 2, Uranus: 2, Neptune: 2, Pluto: 2,
};

export const TRANSIT_ASPECTS: ReadonlyArray<readonly [string, number]> = [
  ['conjunction', 0], ['sextile', 60], ['square', 90], ['trine', 120], ['opposition', 180],
];

export interface PresentTransit {
  body: TransitingBody;
  aspect: string;
  natalPoint: string;
  /** Degrees from exact. */
  orb: number;
  /** True while the aspect is still closing toward exact. */
  applying: boolean;
}

function separation(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

/**
 * Slow-planet aspects within orb of the given natal points at `at`, closest
 * first. `natal` longitudes are tropical ecliptic degrees.
 */
export function presentTransits(
  natal: ReadonlyArray<{ name: string; longitude: number }>,
  at: Date = new Date(),
): PresentTransit[] {
  const now = Astronomy.MakeTime(at);
  const next = Astronomy.MakeTime(new Date(at.getTime() + 86_400_000));
  const found: PresentTransit[] = [];
  for (const body of TRANSITING_BODIES) {
    const lon = longitudeOf(body, now);
    const lonNext = longitudeOf(body, next);
    for (const point of natal) {
      if (!Number.isFinite(point.longitude)) continue;
      const sep = separation(lon, point.longitude);
      const sepNext = separation(lonNext, point.longitude);
      for (const [aspect, angle] of TRANSIT_ASPECTS) {
        const orb = Math.abs(sep - angle);
        if (orb > DEFAULT_ORBS[body]) continue;
        found.push({
          body, aspect, natalPoint: point.name,
          orb: Number(orb.toFixed(2)),
          applying: Math.abs(sepNext - angle) < orb,
        });
      }
    }
  }
  return found.sort((a, b) => a.orb - b.orb);
}
