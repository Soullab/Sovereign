/**
 * Kept Pro "Ask MAIA" conversations (ASTRO-PRO-KEEP Phase 1).
 * Every query filters by member_id: another member's thread is never returned.
 * Turns are stored verbatim; nothing is summarised or sent to MAIA memory.
 */
import { query, transaction } from '@/lib/db/postgres';

export const PRO_SUBJECT_KEY_MAX = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isThreadId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export interface ProThread { id: string; keep: boolean }
export interface ProTurnPair { q: string; a: string }

export async function findLatestThread(memberId: string, subjectKey: string): Promise<ProThread | null> {
  const r = await query<ProThread>(
    `SELECT id, keep FROM astro_pro_threads
      WHERE member_id = $1 AND subject_key = $2 AND keep = true
      ORDER BY COALESCE(last_turn_at, opened_at) DESC LIMIT 1`,
    [memberId, subjectKey]);
  return r.rows[0] ?? null;
}

export async function openThread(memberId: string, subjectKey: string): Promise<string> {
  const r = await query<{ id: string }>(
    `INSERT INTO astro_pro_threads (member_id, subject_key, keep) VALUES ($1, $2, true) RETURNING id`,
    [memberId, subjectKey]);
  return r.rows[0].id;
}

/** True when the thread exists, belongs to the member, and is kept. */
export async function ownsKeptThread(threadId: string, memberId: string, subjectKey: string): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM astro_pro_threads WHERE id = $1 AND member_id = $2 AND subject_key = $3 AND keep = true`,
    [threadId, memberId, subjectKey]);
  return (r.rows?.length ?? 0) > 0;
}

/** Appends a member and a MAIA turn in one transaction. Returns false if the thread is not the member's kept thread. */
export async function appendExchange(threadId: string, memberId: string, q: string, a: string): Promise<boolean> {
  return transaction(async (client) => {
    const own = await client.query(
      `SELECT 1 FROM astro_pro_threads WHERE id = $1 AND member_id = $2 AND keep = true FOR UPDATE`,
      [threadId, memberId]);
    if (!own.rows.length) return false;
    const next = await client.query(
      `SELECT COALESCE(MAX(turn_index) + 1, 0) AS n FROM astro_pro_turns WHERE thread_id = $1`, [threadId]);
    const n = Number(next.rows[0].n);
    await client.query(
      `INSERT INTO astro_pro_turns (thread_id, turn_index, speaker, body) VALUES ($1, $2, 'member', $3), ($1, $4, 'maia', $5)`,
      [threadId, n, q, n + 1, a]);
    await client.query(`UPDATE astro_pro_threads SET last_turn_at = now() WHERE id = $1 AND member_id = $2`, [threadId, memberId]);
    return true;
  });
}

/**
 * keep=false deletes the whole thread (its turns go by cascade), so nothing of a
 * conversation the member stopped keeping remains, not even when it was had.
 * Returns false if it is not the member's thread.
 */
export async function setKeep(threadId: string, memberId: string, keep: boolean): Promise<boolean> {
  if (!keep) {
    const r = await query(`DELETE FROM astro_pro_threads WHERE id = $1 AND member_id = $2 RETURNING id`, [threadId, memberId]);
    return (r.rows?.length ?? 0) > 0;
  }
  const r = await query(`UPDATE astro_pro_threads SET keep = true WHERE id = $1 AND member_id = $2 RETURNING id`, [threadId, memberId]);
  return (r.rows?.length ?? 0) > 0;
}

export async function listTurns(threadId: string, memberId: string): Promise<ProTurnPair[]> {
  const r = await query<{ speaker: string; body: string }>(
    `SELECT t.speaker, t.body FROM astro_pro_turns t
       JOIN astro_pro_threads th ON th.id = t.thread_id
      WHERE t.thread_id = $1 AND th.member_id = $2
      ORDER BY t.turn_index ASC`,
    [threadId, memberId]);
  const pairs: ProTurnPair[] = [];
  let pending: string | null = null;
  for (const row of r.rows) {
    if (row.speaker === 'member') pending = row.body;
    else if (pending !== null) { pairs.push({ q: pending, a: row.body }); pending = null; }
  }
  return pairs;
}
