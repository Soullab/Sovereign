/**
 * The traditional Maya calendar for a date (founder request 2026-11-07).
 *
 * Pro's Mayan tab showed only the Dreamspell count (Argüelles, 1987), a modern
 * system that does not follow the day count still kept by K'iche' and other
 * Maya daykeepers. This is that traditional count: the 260-day count (in
 * K'iche' and Yucatec names), the 365-day Haab and the Long Count, by the
 * GMT correlation 584283 — the one that makes 21 December 2012 the Long Count
 * date 13.0.0.0.0, 4 Ajaw 3 K'ank'in.
 *
 * The local civil date is counted. Many daykeepers begin the day at sunset or
 * sunrise, so a birth near either can belong to the neighbouring day.
 */
import { julianDayNumber } from './julianDay';

export const GMT_CORRELATION = 584283;

export const KICHE_DAYS = [
  'Imox', 'Iq’', 'Aq’ab’al', 'K’at', 'Kan', 'Kame', 'Kej', 'Q’anil', 'Toj', 'Tz’i’',
  'B’atz’', 'E', 'Aj', 'I’x', 'Tz’ikin', 'Ajmaq', 'No’j', 'Tijax', 'Kawoq', 'Ajpu',
] as const;

export const YUCATEC_DAYS = [
  'Imix', 'Ik’', 'Ak’b’al', 'K’an', 'Chikchan', 'Kimi', 'Manik’', 'Lamat', 'Muluk', 'Ok',
  'Chuwen', 'Eb’', 'B’en', 'Ix', 'Men', 'Kib’', 'Kab’an', 'Etz’nab’', 'Kawak', 'Ajaw',
] as const;

export const HAAB_MONTHS = [
  'Pop', 'Wo’', 'Sip', 'Sotz’', 'Sek', 'Xul', 'Yaxk’in', 'Mol', 'Ch’en', 'Yax',
  'Sak’', 'Keh', 'Mak', 'K’ank’in', 'Muwan', 'Pax', 'K’ayab', 'Kumk’u', 'Wayeb’',
] as const;

export interface TraditionalMaya {
  /** Days since the Long Count's base date. */
  dayCount: number;
  number: number;
  kiche: string;
  yucatec: string;
  haab: { day: number; month: string };
  longCount: string;
  /**
   * The trecena: the 13-day run this day belongs to, named (as daykeepers name
   * it) by the day that opens it with the number 1. `position` is this day's
   * place in it, which is the day's own number.
   */
  trecena: { kiche: string; yucatec: string; position: number };
  correlation: number;
  method: string;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** @param localDate the local civil date, YYYY-MM-DD */
export function traditionalMaya(localDate: string): TraditionalMaya {
  const [y, m, d] = localDate.split('-').map(Number);
  const days = julianDayNumber(y, m, d) - GMT_CORRELATION;
  const signIndex = mod(days + 19, 20);
  const haabDay = mod(days + 348, 365);
  const units = [144000, 7200, 360, 20, 1];
  let rest = days;
  const longCount = units.map((u) => { const n = Math.floor(rest / u); rest -= n * u; return n; }).join('.');
  const number = mod(days + 3, 13) + 1;
  const trecenaSign = mod(days - (number - 1) + 19, 20);
  return {
    dayCount: days,
    number,
    kiche: KICHE_DAYS[signIndex],
    yucatec: YUCATEC_DAYS[signIndex],
    haab: { day: haabDay % 20, month: HAAB_MONTHS[Math.floor(haabDay / 20)] },
    longCount,
    trecena: { kiche: KICHE_DAYS[trecenaSign], yucatec: YUCATEC_DAYS[trecenaSign], position: number },
    correlation: GMT_CORRELATION,
    method: 'Traditional count by the GMT correlation 584283 (21 December 2012 = 13.0.0.0.0, 4 Ajaw 3 K’ank’in), for the local civil birth date. Many daykeepers begin the day at sunset or sunrise, so a birth near either may belong to the neighbouring day. Day names in K’iche’ and Yucatec. Meanings belong to living daykeepers; none are given here.',
  };
}

/** "8 B’atz’" — the traditional day as daykeepers name it, in K’iche’. */
export function cholQijDay(t: TraditionalMaya): string {
  return `${t.number} ${t.kiche}`;
}

/** A local civil date as YYYY-MM-DD, in the zone the runtime is in (the browser's, on a page). */
export function localCivilDate(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Said wherever the two counts appear together (founder ruling 2026-11-23):
 * the traditional Chol Q’ij is the Maya calendar; the Dreamspell is a separate
 * modern system and never a translation of it, nor a substitute for it.
 */
export const DREAMSPELL_DISTINCTION =
  'The Dreamspell is a modern symbolic system created by José Argüelles (1987), inspired partly by Maya calendar mathematics. ' +
  'It keeps its own count, so its Kin, tone and seal for a date differ from the traditional Chol Q’ij day. ' +
  'They are different calendars and interpretive traditions, not translations of one another, and the Dreamspell is not Maya teaching.';
