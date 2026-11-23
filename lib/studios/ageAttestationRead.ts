/**
 * READ-ONLY: a member's latest self-attested age band at a Studio program door (founder ruling 2026-11-16, #1900).
 *
 * ⛔ This module only SELECTs. It is the one attestation import allowed in the Spark door's reflection route, whose
 *    falsifier F7 forbids anything that can store. Writing lives in ./ageAttestation.ts, which that route never imports.
 * ⭐ Fail closed: an unreadable record never admits.
 */
import { query } from '@/lib/db/postgres';

export type AgeAttestation = { band: 'adult' | 'minor'; supervised: boolean };

export const LATEST_AGE_ATTESTATION_SQL = `SELECT age_band, supervision_attested
    FROM member_age_attestations
   WHERE member_id = $1
   ORDER BY id DESC
   LIMIT 1`;

export async function latestAgeAttestation(memberId: string): Promise<AgeAttestation | null | 'unknown'> {
  try {
    const r = await query<{ age_band: string; supervision_attested: boolean }>(LATEST_AGE_ATTESTATION_SQL, [memberId]);
    const row = r.rows[0];
    if (!row) return null;
    if (row.age_band !== 'adult' && row.age_band !== 'minor') return 'unknown';
    return { band: row.age_band, supervised: row.supervision_attested === true };
  } catch (error) {
    console.error('[age-attestation] unreadable; not admitting', error instanceof Error ? error.message : 'error');
    return 'unknown';
  }
}

/** Admits: an adult, or a minor who attested adult supervision. Nothing else (no record, unreadable, or malformed). */
export function ageAttestationAdmits(a: AgeAttestation | null | 'unknown'): boolean {
  if (!a || a === 'unknown') return false;
  return a.band === 'adult' || (a.band === 'minor' && a.supervised);
}
