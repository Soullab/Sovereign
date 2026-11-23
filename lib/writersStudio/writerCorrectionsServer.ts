import { query } from '@/lib/db/postgres';
import { livingWorkIdForManuscript } from '@/lib/manuscript/ask/workOfManuscript';
import {
  writerCorrectionContext,
  type WriterCorrection,
  type WriterCorrectionKind,
} from './writerCorrections';

type Row = {
  id: string;
  living_work_id: string;
  thread_id: string;
  maia_turn_index: number | string;
  kind: WriterCorrectionKind;
  correction_text: string;
  created_at: string | Date;
  prior_claim: string;
};

const shape = (row: Row): WriterCorrection => ({
  id: row.id,
  workId: row.living_work_id,
  threadId: row.thread_id,
  maiaTurnIndex: Number(row.maia_turn_index),
  kind: row.kind,
  priorClaim: row.prior_claim,
  correction: row.correction_text,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
});

/** Newest correction per exact MAIA turn. History remains in the table. */
export async function currentWriterCorrectionsForWork(
  memberId: string,
  workId: string,
): Promise<WriterCorrection[]> {
  try {
    const result = await query<Row>(
      `SELECT DISTINCT ON (c.thread_id, c.maia_turn_index)
              c.id, c.living_work_id, c.thread_id, c.maia_turn_index,
              c.kind, c.correction_text, c.created_at, t.body AS prior_claim
         FROM writer_studio_corrections c
         JOIN ask_turns t
           ON t.thread_id = c.thread_id AND t.turn_index = c.maia_turn_index
        WHERE c.member_id = $1 AND c.living_work_id = $2
        ORDER BY c.thread_id, c.maia_turn_index, c.created_at DESC
        LIMIT 24`,
      [memberId, workId],
    );
    return result.rows.map(shape);
  } catch (error) {
    /* Migrate-before-swap compatibility: the current Studio must remain usable
       while this candidate exists ahead of its schema. Only undefined-table is
       treated as "correction substrate not installed yet"; every other DB error
       remains an error. */
    if ((error as { code?: string })?.code === '42P01') return [];
    throw error;
  }
}

export async function writerCorrectionContextForWork(
  memberId: string,
  workId: string,
): Promise<string> {
  return writerCorrectionContext(await currentWriterCorrectionsForWork(memberId, workId));
}

/**
 * The same kept corrections, for a conversation that knows only its manuscript (the passage
 * room). E0 walk 2026-11-23: corrections reached the Work conversation but never the passage
 * turn, so one doorway knew what the writer had kept and the other did not. Resolved exactly
 * as decisionContextForManuscript resolves its Work; no Work, no corrections.
 */
export async function writerCorrectionContextForManuscript(
  memberId: string,
  manuscriptId: string,
): Promise<string> {
  const workId = await livingWorkIdForManuscript(manuscriptId, memberId);
  return workId ? writerCorrectionContextForWork(memberId, workId) : '';
}
