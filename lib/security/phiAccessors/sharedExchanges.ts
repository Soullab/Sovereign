/**
 * PHI accessor — exchanges a writer shared with Soullab (Studio Academy slice 6, founder rulings 2026-11-19).
 *
 * `writer_studio_shared_exchanges.snapshot_enc` holds one question the writer asked and MAIA's answer, copied at the moment the
 * writer chose to share it. It is encrypted from birth: the table has no plaintext sibling, so reads decrypt or they fail.
 * The AAD binds the ciphertext to the row id and the member who shared it, so it cannot be moved to another row or person.
 */
import { encryptForDB, decryptFromDB, type PHIContext, type PHIEncryptionMeta } from '@/lib/security/phiEncryption';

const TABLE = 'writer_studio_shared_exchanges';
const COLUMN = 'snapshot_enc';

/** What the writer chose to share: their question (if it was stored just before) and MAIA's answer. */
export interface SharedExchangeSnapshot {
  question: string | null;
  answer: string;
}

export interface SharedExchangePHIContext {
  /** writer_studio_shared_exchanges.id — generated before encrypting (the AAD binds to it). */
  rowId: string;
  /** members.id of the writer who shared it. */
  memberId: string;
}

function buildContext(ctx: SharedExchangePHIContext): PHIContext {
  return { table: TABLE, column: COLUMN, rowId: ctx.rowId, ownerId: ctx.memberId };
}

export function encryptSharedExchange(snapshot: SharedExchangeSnapshot, ctx: SharedExchangePHIContext): { ciphertext: string; meta: string } {
  const { ciphertext, meta } = encryptForDB(JSON.stringify(snapshot), buildContext(ctx));
  return { ciphertext, meta: JSON.stringify(meta) };
}

/** Decrypt for an already-authorized reader. ⛔ Performs no authorization: callers must have checked the reader first. */
export function decryptSharedExchange(ciphertext: string, meta: PHIEncryptionMeta | string, ctx: SharedExchangePHIContext): SharedExchangeSnapshot {
  const parsed: PHIEncryptionMeta = typeof meta === 'string' ? JSON.parse(meta) : meta;
  return JSON.parse(decryptFromDB(ciphertext, parsed, buildContext(ctx))) as SharedExchangeSnapshot;
}
