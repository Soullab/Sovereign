/**
 * Kept Pro "Ask MAIA" conversations (ASTRO-PRO-KEEP Phase 1).
 * Every query filters by member_id: another member's thread is never returned.
 * Turns are stored verbatim; nothing is summarised.
 *
 * Phase 2 (founder ruling 2026-11-23, design ASTRO-PRO-KEEP_PHASE2_MEMORY_DESIGN):
 * an own-chart exchange reaches MAIA's wider memory only when the member presses
 * "Keep with MAIA" (resolveCarrySource → keepSource). Client charts are recalled
 * inside Pro per chart only (recallSubjectExchanges) and never become memory atoms.
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

/**
 * Appends a member and a MAIA turn in one transaction. Returns MAIA's turn index
 * (always >= 1, what "Keep with MAIA" names), or false if the thread is not the
 * member's kept thread.
 */
export async function appendExchange(threadId: string, memberId: string, q: string, a: string): Promise<number | false> {
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
    return n + 1;
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

/** A kept exchange as the panel sees it. `turnIndex` is MAIA's turn; `carried` is set when the member kept it with MAIA. */
export interface ProKeptExchange extends ProTurnPair { turnIndex: number; carried: boolean }

export async function listTurns(threadId: string, memberId: string): Promise<ProKeptExchange[]> {
  const r = await query<{ speaker: string; body: string; turn_index: number; carried: boolean }>(
    `SELECT t.speaker, t.body, t.turn_index,
            EXISTS (SELECT 1 FROM member_memory_atoms a
                     WHERE a.member_id = th.member_id AND a.source_type = 'astro_pro_exchange'
                       AND a.source_id = t.id) AS carried
       FROM astro_pro_turns t
       JOIN astro_pro_threads th ON th.id = t.thread_id
      WHERE t.thread_id = $1 AND th.member_id = $2
      ORDER BY t.turn_index ASC`,
    [threadId, memberId]);
  const pairs: ProKeptExchange[] = [];
  let pending: string | null = null;
  for (const row of r.rows) {
    if (row.speaker === 'member') pending = row.body;
    else if (pending !== null) {
      pairs.push({ q: pending, a: row.body, turnIndex: Number(row.turn_index), carried: row.carried === true });
      pending = null;
    }
  }
  return pairs;
}

// ── Phase 2 ─────────────────────────────────────────────────────────────────

/**
 * Subject keys are ask.<section>.<subject>.<other>. A thread is about one chart
 * only when <other> is empty; two-chart threads (biwheel, composite) are never
 * carried or recalled, so a second person never enters another's context.
 */
export function parseSubjectKey(subjectKey: string): { section: string; subject: string; other: string } | null {
  const parts = subjectKey.split('.');
  if (parts.length !== 4 || parts[0] !== 'ask' || !parts[1] || !parts[2]) return null;
  return { section: parts[1], subject: parts[2], other: parts[3] };
}

export interface CarrySource {
  memberTurn: string;
  maiaTurn: string;
  maiaTurnId: string;
  section: string;
  askedAt: string;
}

export type CarryRefusal = 'thread_not_found' | 'not_own_chart' | 'turn_not_found';

/**
 * What a "Keep with MAIA" press may carry: the member's own kept thread about
 * their own chart alone, and a MAIA turn with the member's question before it.
 * Everything is re-derived from stored rows; nothing the browser says about the
 * subject is trusted.
 */
export async function resolveCarrySource(
  memberId: string, threadId: string, turnIndex: number,
): Promise<{ ok: true; source: CarrySource } | { ok: false; reason: CarryRefusal }> {
  const th = await query<{ subject_key: string }>(
    `SELECT subject_key FROM astro_pro_threads WHERE id = $1 AND member_id = $2 AND keep = true`,
    [threadId, memberId]);
  const subjectKey = th.rows[0]?.subject_key;
  if (!subjectKey) return { ok: false, reason: 'thread_not_found' };
  const parsed = parseSubjectKey(subjectKey);
  if (!parsed || parsed.subject !== 'own' || parsed.other !== '') return { ok: false, reason: 'not_own_chart' };
  if (!Number.isInteger(turnIndex) || turnIndex < 1) return { ok: false, reason: 'turn_not_found' };
  const turns = await query<{ id: string; turn_index: number; speaker: string; body: string; created_at: Date }>(
    `SELECT id, turn_index, speaker, body, created_at FROM astro_pro_turns
      WHERE thread_id = $1 AND turn_index IN ($2, $3) ORDER BY turn_index ASC`,
    [threadId, turnIndex - 1, turnIndex]);
  const [q, a] = turns.rows;
  if (!q || !a || q.speaker !== 'member' || a.speaker !== 'maia' || Number(a.turn_index) !== turnIndex) {
    return { ok: false, reason: 'turn_not_found' };
  }
  return {
    ok: true,
    source: {
      memberTurn: q.body, maiaTurn: a.body, maiaTurnId: a.id, section: parsed.section,
      askedAt: new Date(q.created_at).toISOString(),
    },
  };
}

/** Earlier exchanges about one chart, for recall inside Pro (founder ruling 2026-11-23 (c)). */
export interface RecalledExchange { section: string; q: string; a: string; at: string }

export const PRO_RECALL_MAX_EXCHANGES = 6;
export const PRO_RECALL_MAX_CHARS = 6000;

/**
 * The caller's earlier kept exchanges about `subject` (a saved chart id, or
 * 'own') from their other single-chart threads, newest first and bounded.
 * Never another member's, never a two-chart thread, never the current thread.
 * Deleting a saved chart deletes every thread naming it (deleteSavedChart), so
 * nothing recalled outlives the client record.
 */
export async function recallSubjectExchanges(
  memberId: string, subject: string, currentSubjectKey: string,
): Promise<RecalledExchange[]> {
  if (!subject || subject.includes('.')) return [];
  const r = await query<{ subject_key: string; speaker: string; body: string; turn_index: number; thread_id: string; created_at: Date }>(
    `SELECT th.subject_key, t.speaker, t.body, t.turn_index, t.thread_id, t.created_at
       FROM astro_pro_turns t
       JOIN astro_pro_threads th ON th.id = t.thread_id
      WHERE th.member_id = $1 AND th.keep = true
        AND split_part(th.subject_key, '.', 1) = 'ask'
        AND split_part(th.subject_key, '.', 3) = $2
        AND split_part(th.subject_key, '.', 4) = ''
        AND th.subject_key <> $3
      ORDER BY t.created_at DESC, t.turn_index DESC
      LIMIT $4`,
    [memberId, subject, currentSubjectKey, PRO_RECALL_MAX_EXCHANGES * 2 + 1]);
  // Rows are newest first: pair each MAIA turn with the member turn just before it in the same thread.
  const out: RecalledExchange[] = [];
  let chars = 0;
  for (let i = 0; i < r.rows.length - 1 && out.length < PRO_RECALL_MAX_EXCHANGES; i++) {
    const a = r.rows[i];
    const q = r.rows[i + 1];
    if (a.speaker !== 'maia' || q.speaker !== 'member' || q.thread_id !== a.thread_id ||
        Number(q.turn_index) !== Number(a.turn_index) - 1) continue;
    const size = q.body.length + a.body.length;
    if (chars + size > PRO_RECALL_MAX_CHARS) break;
    chars += size;
    out.push({
      section: parseSubjectKey(a.subject_key)?.section ?? '',
      q: q.body, a: a.body, at: new Date(q.created_at).toISOString().slice(0, 10),
    });
    i++;
  }
  return out;
}
