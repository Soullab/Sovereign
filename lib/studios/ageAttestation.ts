/**
 * Recording a member's own age attestation at a Studio program door (founder ruling 2026-11-16, #1900):
 *   "if minors are using they must check off that they are under adult supervision." · "Yes, block under 13".
 *
 * ⭐ By the member's own act only. Adult, or minor (13–17) WITH the supervision tick. The database refuses a minor row
 *    without supervision (CHECK). ⛔ There is no way to record an under-13 answer: they are turned away and nothing is kept.
 */
import { query } from '@/lib/db/postgres';

export type AttestationInput = { band: 'adult' } | { band: 'minor'; supervised: true };

export const INSERT_AGE_ATTESTATION_SQL = `INSERT INTO member_age_attestations (member_id, age_band, supervision_attested, studio_path)
  VALUES ($1, $2, $3, $4)`;

/** Validates an untrusted body. Returns null for anything that is not exactly an adult, or a supervised minor. */
export function parseAttestation(body: unknown): AttestationInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (b.band === 'adult') return { band: 'adult' };
  if (b.band === 'minor' && b.supervised === true) return { band: 'minor', supervised: true };
  return null;
}

export async function recordAgeAttestation(memberId: string, a: AttestationInput, studioPath: string | null): Promise<void> {
  await query(INSERT_AGE_ATTESTATION_SQL, [memberId, a.band, a.band === 'minor', studioPath]);
}
