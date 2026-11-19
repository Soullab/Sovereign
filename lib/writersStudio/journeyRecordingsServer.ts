/**
 * Server store for recorded Beta-journey answers (Studio Academy slice 5). Rulings: lib/writersStudio/journeyRecordings.ts.
 *
 * ⭐ Bytes are encrypted before they reach the vault; the transcript is encrypted in its column.
 * ⭐ Every touch first destroys expired recordings (bytes, then row), and no read returns an expired one. No timer is used
 *    (in-process timers are forbidden; docs/ops/DEVELOP_REFUSAL_RETENTION.md).
 * ⭐ Withdrawal destroys the bytes and then deletes the row; if the bytes cannot be destroyed the row stays, so it can be retried.
 * ⛔ No function here feeds MAIA.
 */
import { randomUUID } from 'crypto';
import { query } from '@/lib/db/postgres';
import { destroyVaultBytes, readVaultBytes, writeDurableVaultBytes } from '@/lib/storage/fileVault';
import {
  decryptRecordingMedia, decryptTranscript, encryptRecordingMedia, encryptTranscript,
} from '@/lib/security/phiAccessors/journeyRecordings';
import { shareExpiresAt } from './sharedExchanges';
import { transcribeUrlAllowed, type RecordingKind } from './journeyRecordings';

const NAMESPACE = 'journey-recordings';
export type OwnRecording = { id: string; promptKey: string; kind: RecordingKind; createdAt: string; expiresAt: string; transcript: string | null };
export type FounderRecording = OwnRecording & { memberName: string };
type Row = {
  id: string; member_id: string; prompt_key: string; kind: RecordingKind; mime: string; storage_path: string; media_enc_meta: string;
  transcript_enc: string | null; transcript_enc_meta: string | null; created_at: string | Date; expires_at: string | Date; member_name?: string | null;
};
const iso = (v: string | Date) => (v instanceof Date ? v.toISOString() : String(v));

export async function purgeExpiredRecordings(): Promise<number> {
  const due = await query<{ id: string; storage_path: string }>(
    'SELECT id, storage_path FROM writer_studio_journey_recordings WHERE expires_at <= now()',
  );
  let purged = 0;
  for (const r of due.rows) {
    try {
      await destroyVaultBytes(r.storage_path);
      await query('DELETE FROM writer_studio_journey_recordings WHERE id = $1', [r.id]);
      purged += 1;
    } catch { console.error('[journey-recordings] expired recording not yet destroyed', { id: r.id }); }
  }
  return purged;
}

/** Transcribe with Soullab's own speech service only. Null on any failure: the recording is kept without a written copy. */
export async function transcribeLocally(bytes: Buffer, mime: string, env: Record<string, string | undefined> = process.env): Promise<string | null> {
  const base = env.WHISPER_LOCAL_URL || 'http://whisper:8000';
  if (!transcribeUrlAllowed(base)) { console.error('[journey-recordings] transcription refused: not Soullab’s own speech service'); return null; }
  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), mime.endsWith('mp4') ? 'answer.mp4' : mime.endsWith('ogg') ? 'answer.ogg' : 'answer.webm');
    form.append('response_format', 'json');
    const res = await fetch(`${base}/v1/audio/transcriptions`, { method: 'POST', body: form, signal: AbortSignal.timeout(90_000) });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null) as { text?: unknown } | null;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    return text || null;
  } catch { return null; }
}

function toOwn(r: Row): OwnRecording {
  let transcript: string | null = null;
  if (r.transcript_enc && r.transcript_enc_meta) {
    try { transcript = decryptTranscript(r.transcript_enc, r.transcript_enc_meta, { rowId: r.id, memberId: r.member_id }); }
    catch { console.error('[journey-recordings] a transcript would not decrypt', { id: r.id }); }
  }
  return { id: r.id, promptKey: r.prompt_key, kind: r.kind, createdAt: iso(r.created_at), expiresAt: iso(r.expires_at), transcript };
}

export type SaveOutcome = { ok: true; recording: OwnRecording } | { ok: false; status: number; refusal: 'beta_ended' };

export async function saveRecording(input: {
  memberId: string; promptKey: string; kind: RecordingKind; mime: string; bytes: Buffer;
  now?: Date; betaEnd?: string | null; transcribe?: (bytes: Buffer, mime: string) => Promise<string | null>;
}): Promise<SaveOutcome> {
  await purgeExpiredRecordings();
  const now = input.now ?? new Date();
  const expiresAt = shareExpiresAt(now, input.betaEnd);
  if (!expiresAt) return { ok: false, status: 409, refusal: 'beta_ended' };
  const id = randomUUID();
  const ctx = { rowId: id, memberId: input.memberId };
  const { file, meta } = encryptRecordingMedia(input.bytes, ctx);
  const storagePath = await writeDurableVaultBytes(NAMESPACE, id, 'enc', file);
  const text = await (input.transcribe ?? transcribeLocally)(input.bytes, input.mime);
  const t = text ? encryptTranscript(text, ctx) : null;
  try {
    await query(
      `INSERT INTO writer_studio_journey_recordings
         (id, member_id, prompt_key, kind, mime, byte_size, storage_path, media_enc_meta, transcript_enc, transcript_enc_meta, created_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, input.memberId, input.promptKey, input.kind, input.mime, input.bytes.length, storagePath, meta,
        t?.ciphertext ?? null, t?.meta ?? null, now.toISOString(), expiresAt.toISOString()],
    );
  } catch (error) {
    await destroyVaultBytes(storagePath).catch(() => console.error('[journey-recordings] orphan bytes after a failed insert', { id }));
    throw error;
  }
  return { ok: true, recording: { id, promptKey: input.promptKey, kind: input.kind, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString(), transcript: text } };
}

const COLUMNS = `r.id, r.member_id, r.prompt_key, r.kind, r.mime, r.storage_path, r.media_enc_meta, r.transcript_enc, r.transcript_enc_meta, r.created_at, r.expires_at`;

export async function listOwnRecordings(memberId: string): Promise<OwnRecording[]> {
  await purgeExpiredRecordings();
  const r = await query<Row>(
    `SELECT ${COLUMNS} FROM writer_studio_journey_recordings r WHERE r.member_id = $1 AND r.expires_at > now() ORDER BY r.created_at ASC`,
    [memberId],
  );
  return r.rows.map(toOwn);
}

export async function listRecordingsForFounder(): Promise<FounderRecording[]> {
  await purgeExpiredRecordings();
  const r = await query<Row>(
    `SELECT ${COLUMNS}, COALESCE(m.name, m.username) AS member_name
       FROM writer_studio_journey_recordings r JOIN members m ON m.id = r.member_id
      WHERE r.expires_at > now() ORDER BY r.created_at DESC`,
  );
  return r.rows.map((row) => ({ ...toOwn(row), memberName: row.member_name || 'A writer' }));
}

/** The decrypted recording, for its writer or (asFounder, already checked by the route) the founder. Null if not theirs or gone. */
export async function readRecordingMedia(readerId: string, id: string, asFounder: boolean): Promise<{ mime: string; bytes: Buffer } | null> {
  await purgeExpiredRecordings();
  const r = await query<Row>(
    `SELECT ${COLUMNS} FROM writer_studio_journey_recordings r
      WHERE r.id = $1 AND r.expires_at > now() AND ($3::boolean OR r.member_id = $2)`,
    [id, readerId, asFounder],
  );
  const row = r.rows[0];
  if (!row) return null;
  const file = await readVaultBytes(row.storage_path);
  return { mime: row.mime, bytes: decryptRecordingMedia(file, row.media_enc_meta, { rowId: row.id, memberId: row.member_id }) };
}

/** Withdraw: destroy the bytes, then delete the row. Only the writer who sent it can. */
export async function withdrawRecording(memberId: string, id: string): Promise<boolean> {
  const r = await query<{ storage_path: string }>(
    'SELECT storage_path FROM writer_studio_journey_recordings WHERE id = $1 AND member_id = $2', [id, memberId],
  );
  const row = r.rows[0];
  if (!row) return false;
  await destroyVaultBytes(row.storage_path);
  const d = await query('DELETE FROM writer_studio_journey_recordings WHERE id = $1 AND member_id = $2', [id, memberId]);
  return (d.rowCount ?? 0) === 1;
}
