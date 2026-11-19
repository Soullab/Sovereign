/**
 * PHI accessor — recorded Beta-journey answers (Studio Academy slice 5).
 *
 * The recording's bytes are encrypted with phiEncryption before they reach the file vault (the vault itself stores bytes as given),
 * so the vault file is ciphertext; the encryption meta lives in the row. The transcript is encrypted in its own column. Both bind
 * their AAD to the row id and the writer, so neither can be moved to another row or reattributed.
 * ⛔ No authorization here: callers must have checked the reader (the writer, or the founder) first.
 */
import { encryptForDB, decryptFromDB, type PHIContext, type PHIEncryptionMeta } from '@/lib/security/phiEncryption';

const TABLE = 'writer_studio_journey_recordings';
export interface RecordingPHIContext { rowId: string; memberId: string }
const ctxFor = (column: 'media_enc' | 'transcript_enc', c: RecordingPHIContext): PHIContext =>
  ({ table: TABLE, column, rowId: c.rowId, ownerId: c.memberId });
const parse = (m: PHIEncryptionMeta | string): PHIEncryptionMeta => (typeof m === 'string' ? JSON.parse(m) : m);

export function encryptRecordingMedia(bytes: Buffer, c: RecordingPHIContext): { file: Buffer; meta: string } {
  const { ciphertext, meta } = encryptForDB(bytes.toString('base64'), ctxFor('media_enc', c));
  return { file: Buffer.from(ciphertext, 'utf8'), meta: JSON.stringify(meta) };
}
export function decryptRecordingMedia(file: Buffer, meta: PHIEncryptionMeta | string, c: RecordingPHIContext): Buffer {
  return Buffer.from(decryptFromDB(file.toString('utf8'), parse(meta), ctxFor('media_enc', c)), 'base64');
}
export function encryptTranscript(text: string, c: RecordingPHIContext): { ciphertext: string; meta: string } {
  const { ciphertext, meta } = encryptForDB(text, ctxFor('transcript_enc', c));
  return { ciphertext, meta: JSON.stringify(meta) };
}
export function decryptTranscript(ciphertext: string, meta: PHIEncryptionMeta | string, c: RecordingPHIContext): string {
  return decryptFromDB(ciphertext, parse(meta), ctxFor('transcript_enc', c));
}
