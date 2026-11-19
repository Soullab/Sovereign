/**
 * Server store for "Share this with Soullab" (Studio Academy slice 6). See lib/writersStudio/sharedExchanges.ts for the rulings.
 *
 * ⭐ Every touch first deletes expired shares, and every read excludes them, so nothing outlives its retention even though no
 *    scheduled job exists (in-process timers are forbidden; docs/ops/DEVELOP_REFUSAL_RETENTION.md).
 * ⭐ Withdrawal is a hard DELETE of the only copy.
 * ⛔ No function here feeds MAIA. The founder list is read only by the founder route.
 */
import { randomUUID } from 'crypto';
import { query } from '@/lib/db/postgres';
import { decryptSharedExchange, encryptSharedExchange, type SharedExchangeSnapshot } from '@/lib/security/phiAccessors/sharedExchanges';
import { shareExpiresAt } from './sharedExchanges';

export type OwnShare = { id: string; threadId: string; maiaTurnIndex: number; createdAt: string; expiresAt: string };
export type FounderShare = OwnShare & { memberName: string; exchange: SharedExchangeSnapshot | null };
export type ShareOutcome =
  | { ok: true; share: OwnShare }
  | { ok: false; status: number; refusal: 'not_found' | 'maia_turn_not_found' | 'beta_ended' };

const iso = (v: string | Date) => (v instanceof Date ? v.toISOString() : String(v));

export async function purgeExpiredShares(): Promise<number> {
  const r = await query('DELETE FROM writer_studio_shared_exchanges WHERE expires_at <= now()');
  return r.rowCount ?? 0;
}

type TurnRow = { living_work_id: string | null; manuscript_id: string | null; speaker: string; body: string };

/** Share one stored MAIA turn (and the writer's question just before it) that belongs to this member's Work. */
export async function shareExchange(input: {
  memberId: string; workId: string; threadId: string; maiaTurnIndex: number; now?: Date; betaEnd?: string | null;
}): Promise<ShareOutcome> {
  const { memberId, workId, threadId, maiaTurnIndex } = input;
  await purgeExpiredShares();
  const owned = await query('SELECT 1 FROM living_works WHERE id = $1 AND member_id = $2', [workId, memberId]);
  if (owned.rows.length !== 1) return { ok: false, status: 404, refusal: 'not_found' };

  const turns = await query<TurnRow & { turn_index: number }>(
    `SELECT th.living_work_id, th.manuscript_id, u.speaker, u.body, u.turn_index
       FROM ask_threads th
       JOIN ask_turns u ON u.thread_id = th.id AND u.turn_index IN ($3, $3 - 1)
      WHERE th.id = $1 AND th.member_id = $2`,
    [threadId, memberId, maiaTurnIndex],
  );
  const maia = turns.rows.find((t) => t.turn_index === maiaTurnIndex);
  if (!maia || maia.speaker !== 'maia') return { ok: false, status: 404, refusal: 'maia_turn_not_found' };
  let belongs = maia.living_work_id === workId;
  if (!belongs && maia.manuscript_id) {
    const expression = await query(
      `SELECT 1 FROM living_work_expressions
        WHERE living_work_id = $1 AND expression_type = 'manuscript' AND expression_id = $2`,
      [workId, maia.manuscript_id],
    );
    belongs = expression.rows.length === 1;
  }
  if (!belongs) return { ok: false, status: 404, refusal: 'not_found' };

  const now = input.now ?? new Date();
  const expiresAt = shareExpiresAt(now, input.betaEnd);
  if (!expiresAt) return { ok: false, status: 409, refusal: 'beta_ended' };

  const asked = turns.rows.find((t) => t.turn_index === maiaTurnIndex - 1 && t.speaker === 'author');
  const id = randomUUID();
  const { ciphertext, meta } = encryptSharedExchange({ question: asked?.body ?? null, answer: maia.body }, { rowId: id, memberId });
  await query(
    `INSERT INTO writer_studio_shared_exchanges
       (id, member_id, living_work_id, thread_id, maia_turn_index, snapshot_enc, snapshot_enc_meta, created_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (member_id, thread_id, maia_turn_index) DO NOTHING`,
    [id, memberId, workId, threadId, maiaTurnIndex, ciphertext, meta, now.toISOString(), expiresAt.toISOString()],
  );
  const row = await query<{ id: string; created_at: string | Date; expires_at: string | Date }>(
    `SELECT id, created_at, expires_at FROM writer_studio_shared_exchanges
      WHERE member_id = $1 AND thread_id = $2 AND maia_turn_index = $3`,
    [memberId, threadId, maiaTurnIndex],
  );
  const r = row.rows[0]!;
  return { ok: true, share: { id: r.id, threadId, maiaTurnIndex, createdAt: iso(r.created_at), expiresAt: iso(r.expires_at) } };
}

/** Which turns of this Work the writer has shared. No content: the writer already has their own conversation. */
export async function listOwnShares(memberId: string, workId: string): Promise<OwnShare[]> {
  await purgeExpiredShares();
  const r = await query<{ id: string; thread_id: string; maia_turn_index: number; created_at: string | Date; expires_at: string | Date }>(
    `SELECT id, thread_id, maia_turn_index, created_at, expires_at FROM writer_studio_shared_exchanges
      WHERE member_id = $1 AND living_work_id = $2 AND expires_at > now() ORDER BY created_at ASC`,
    [memberId, workId],
  );
  return r.rows.map((x) => ({ id: x.id, threadId: x.thread_id, maiaTurnIndex: x.maia_turn_index, createdAt: iso(x.created_at), expiresAt: iso(x.expires_at) }));
}

/** Withdraw: delete the only copy. Only the writer who shared it can. */
export async function withdrawShare(memberId: string, id: string): Promise<boolean> {
  const r = await query('DELETE FROM writer_studio_shared_exchanges WHERE id = $1 AND member_id = $2', [id, memberId]);
  return (r.rowCount ?? 0) === 1;
}

/** Founder only (the route checks): every current share, newest first, decrypted. A row that will not decrypt is shown as unreadable. */
export async function listSharesForFounder(): Promise<FounderShare[]> {
  await purgeExpiredShares();
  const r = await query<{ id: string; member_id: string; thread_id: string; maia_turn_index: number; snapshot_enc: string; snapshot_enc_meta: string; created_at: string | Date; expires_at: string | Date; member_name: string | null }>(
    `SELECT s.id, s.member_id, s.thread_id, s.maia_turn_index, s.snapshot_enc, s.snapshot_enc_meta, s.created_at, s.expires_at,
            COALESCE(m.name, m.username) AS member_name
       FROM writer_studio_shared_exchanges s
       JOIN members m ON m.id = s.member_id
      WHERE s.expires_at > now()
      ORDER BY s.created_at DESC`,
  );
  return r.rows.map((x) => {
    let exchange: SharedExchangeSnapshot | null = null;
    try { exchange = decryptSharedExchange(x.snapshot_enc, x.snapshot_enc_meta, { rowId: x.id, memberId: x.member_id }); }
    catch { console.error('[shared-exchanges] a share would not decrypt', { id: x.id }); }
    return { id: x.id, threadId: x.thread_id, maiaTurnIndex: x.maia_turn_index, createdAt: iso(x.created_at), expiresAt: iso(x.expires_at), memberName: x.member_name || 'A writer', exchange };
  });
}
