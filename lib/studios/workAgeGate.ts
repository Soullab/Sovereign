/**
 * The age gate, applied to the Work MAIA is about to read or answer about (founder ruling 2026-11-16, #1900):
 *   "if minors are using they must check off that they are under adult supervision." · "Yes, block under 13".
 *
 * #2309 enforced the ruling where the BROWSER named the program (the door, Begin). A production walk on 2026-11-16 found
 * MAIA reading a College Essay page with no attestation on record, because the Studio's own MAIA routes never name it.
 * This module answers from the database instead: the program a Work is recorded under (`living_works.studio_path`), reached
 * from the Work, a manuscript declared in it, or a conversation thread about either. Nothing the request says about its
 * program is consulted.
 *
 * ⛔ Read-only: SELECTs and the attestation read; it writes nothing. ⛔ Fails closed: if the program cannot be read, MAIA does
 * not speak (`age_check_unavailable`), and an unreadable attestation never admits (`./ageAttestationRead.ts`).
 * ⭐ Stricter on ambiguity: a manuscript declared in more than one Work is gated if ANY of them requires the attestation.
 */
import { query } from '@/lib/db/postgres';
import { studioPathById } from '@/lib/writersStudio/studioPaths';
import { ageAttestationAdmits, latestAgeAttestation } from './ageAttestationRead';

/* Ids are compared as text so a malformed id reads as "no such Work" (the route's own 404 follows), never as an error. */
export const WORK_PROGRAM_SQL = `SELECT studio_path FROM living_works WHERE member_id = $2 AND id::text = $1`;

export const MANUSCRIPT_PROGRAMS_SQL = `SELECT w.studio_path
    FROM living_work_expressions e
    JOIN member_manuscripts m ON m.id = e.expression_id
    JOIN living_works w ON w.id = e.living_work_id
   WHERE e.expression_type = 'manuscript' AND e.expression_id::text = $1 AND m.member_id = $2`;

export const THREAD_SUBJECT_SQL = `SELECT living_work_id::text AS living_work_id, manuscript_id::text AS manuscript_id
    FROM ask_threads WHERE member_id = $2 AND id::text = $1`;

export type AgeGate =
  | { ok: true }
  | { ok: false; refusal: 'age_attestation_required' | 'age_check_unavailable' };

const UNAVAILABLE: AgeGate = { ok: false, refusal: 'age_check_unavailable' };

async function gateForPrograms(memberId: string, programs: (string | null)[]): Promise<AgeGate> {
  if (!programs.some((p) => studioPathById(p)?.requiresAgeAttestation)) return { ok: true };
  return ageAttestationAdmits(await latestAgeAttestation(memberId)) ? { ok: true } : { ok: false, refusal: 'age_attestation_required' };
}

async function programsOf(sql: string, id: string, memberId: string): Promise<(string | null)[] | null> {
  try {
    const r = await query<{ studio_path: string | null }>(sql, [id, memberId]);
    return r.rows.map((row) => row.studio_path);
  } catch (error) {
    console.error('[age-gate] program unreadable; MAIA does not speak', error instanceof Error ? error.message : 'error');
    return null;
  }
}

/** Whether this member's Work is recorded under a program that requires the attestation ('unknown' if unreadable). */
export async function workRequiresAgeAttestation(memberId: string, workId: string): Promise<boolean | 'unknown'> {
  const programs = await programsOf(WORK_PROGRAM_SQL, workId, memberId);
  return programs === null ? 'unknown' : programs.some((p) => Boolean(studioPathById(p)?.requiresAgeAttestation));
}

/** MAIA is about to read or answer about this Work. */
export async function ageGateForWork(memberId: string, workId: string): Promise<AgeGate> {
  const programs = await programsOf(WORK_PROGRAM_SQL, workId, memberId);
  return programs === null ? UNAVAILABLE : gateForPrograms(memberId, programs);
}

/** MAIA is about to read or answer about this manuscript: gated by every Work it is declared in. */
export async function ageGateForManuscript(memberId: string, manuscriptId: string): Promise<AgeGate> {
  const programs = await programsOf(MANUSCRIPT_PROGRAMS_SQL, manuscriptId, memberId);
  return programs === null ? UNAVAILABLE : gateForPrograms(memberId, programs);
}

/** MAIA is about to answer in this conversation thread: gated by the Work or manuscript the thread is about. */
export async function ageGateForThread(memberId: string, threadId: string): Promise<AgeGate> {
  let subject: { living_work_id: string | null; manuscript_id: string | null } | undefined;
  try {
    subject = (await query<{ living_work_id: string | null; manuscript_id: string | null }>(THREAD_SUBJECT_SQL, [threadId, memberId])).rows[0];
  } catch (error) {
    console.error('[age-gate] thread unreadable; MAIA does not speak', error instanceof Error ? error.message : 'error');
    return UNAVAILABLE;
  }
  if (!subject) return { ok: true }; // no such thread for this member: the route's own refusal follows
  if (subject.living_work_id) return ageGateForWork(memberId, subject.living_work_id);
  if (subject.manuscript_id) return ageGateForManuscript(memberId, subject.manuscript_id);
  return { ok: true };
}

/** The refusal a route returns. Both keys, because Studio clients read either `error` or `refusal`. */
export function ageGateRefusal(gate: Extract<AgeGate, { ok: false }>): { status: number; body: { error: string; refusal: string } } {
  return { status: gate.refusal === 'age_attestation_required' ? 403 : 503, body: { error: gate.refusal, refusal: gate.refusal } };
}
