/**
 * Work-wide "MAIA asks, never rewrites" (founder authorization 2026-11-13, ledger #1938).
 *
 * Answers one question for an editorial turn: has the writer paused MAIA's revisions
 * on ANY of their Works that holds this manuscript (or this chain's recorded origin)?
 *
 * ⭐ Member-declared only (living_works.maia_revisions_paused, written solely by the
 *   member's PATCH). Never inferred from the Work's free-text form.
 * ⭐ A manuscript may belong to more than one Work (living_work_expressions is not
 *   unique on the expression). If any of the writer's Works holding it is paused,
 *   the writer's stated limit wins.
 * ⛔ Member-scoped in every predicate: another member's Work can never affect this.
 */
import { query } from '@/lib/db/postgres';

export const WORK_REVISION_PAUSE_SQL = `SELECT EXISTS (
    SELECT 1
      FROM living_work_expressions e
      JOIN living_works lw ON lw.id = e.living_work_id
     WHERE e.expression_type = 'manuscript'
       AND e.expression_id = $3
       AND lw.member_id = $2
       AND lw.maia_revisions_paused
  ) OR EXISTS (
    SELECT 1
      FROM writer_editorial_chain_origins o
      JOIN living_works lw ON lw.id = o.living_work_id AND lw.member_id = o.member_id
     WHERE o.proposal_chain_id = $1
       AND o.member_id = $2
       AND lw.maia_revisions_paused
  ) AS paused`;

export async function workPausesRevisions(
  memberId: string, chainId: string, manuscriptId: string,
): Promise<boolean> {
  try {
    const r = await query<{ paused: boolean }>(WORK_REVISION_PAUSE_SQL, [chainId, memberId, manuscriptId]);
    return r.rows[0]?.paused === true;
  } catch (error) {
    /* ⛔ Fail closed: if the writer's setting cannot be read, MAIA may still talk
       but may not propose wording. Never assume a pause was lifted. */
    console.error('[editorial] work revision pause unreadable; holding reply_only', error);
    return true;
  }
}

/**
 * The instruction MAIA is given on every turn of a Work the writer has set to
 * "MAIA asks, never rewrites" (live walk 2026-11-15). The server already withholds
 * proposals on such turns; this closes the remaining channel, wording inside the
 * reply itself, which the general reply-only instruction allows "as illustration".
 * A college essay must stay the writer's own words in every channel.
 */
export function workQuestionsOnlyInstruction(): string {
  return [
    'WORK-WIDE: THE WRITER HAS CHOSEN "MAIA ASKS, NEVER REWRITES" FOR THIS WHOLE WORK.',
    'This overrides any allowance for illustrative or example wording.',
    'Never write sentences, phrases, openings, endings, transitions or example wording that could be placed in this Work, not as a proposal, not as an illustration, not as "something like…", not even if the writer asks.',
    'Do not offer, promise or hint at rewriting, now or later.',
    'Reflect what you notice in the writer\'s own words (quote only their words), name what is working, and ask one or two questions that help them find their own next sentence.',
    'If the writer asks you to rewrite, say kindly that this Work is set to keep every sentence theirs, and ask a question that helps them write it themselves.',
    'If the writer asks for an example sentence, an opening, or "something like…", give none: say in one line that this Work keeps every sentence theirs, then ask one concrete question about the moment itself (what they saw, heard, did, or felt).',
    'Use quotation marks ONLY around the writer\'s own exact words from the passage. Never put any other wording in quotation marks.',
  ].join('\n');
}

/**
 * The Studio program (path) of the Work this turn's manuscript belongs to (founder 2026-11-15, ledger #1938), so MAIA
 * coaches in that program's own posture. Member-declared on the Work; looked up server-side by id; member-scoped.
 *
 * Review F3 (2026-11-15): the answer is explicit, never a silent pick.
 *   'one'        exactly one program among the writer's Works holding this manuscript;
 *   'none'       no program: the ordinary Studio;
 *   'ambiguous'  Works holding it belong to DIFFERENT programs, or to a program AND the ordinary Studio: no program's
 *                posture is applied;
 *   'unknown'    the lookup failed.
 * 'ambiguous' and 'unknown' receive a conservative instruction (workProgramUncertainInstruction), never the ordinary
 * posture by default. The questions-only enforcement is a separate, fail-closed check and is never relaxed here.
 */
export const WORK_STUDIO_PATH_SQL = `SELECT DISTINCT lw.studio_path AS studio_path
    FROM living_works lw
   WHERE lw.member_id = $2
     AND (lw.id IN (SELECT e.living_work_id FROM living_work_expressions e
                     WHERE e.expression_type = 'manuscript' AND e.expression_id = $3)
       OR lw.id IN (SELECT o.living_work_id FROM writer_editorial_chain_origins o
                     WHERE o.proposal_chain_id = $1 AND o.member_id = $2))
   ORDER BY 1 NULLS FIRST
   LIMIT 2`;

export type WorkProgram =
  | { kind: 'one'; id: string }
  | { kind: 'none' }
  | { kind: 'ambiguous' }
  | { kind: 'unknown' };

export async function workStudioProgram(
  memberId: string, chainId: string, manuscriptId: string,
): Promise<WorkProgram> {
  try {
    const r = await query<{ studio_path: string | null }>(WORK_STUDIO_PATH_SQL, [chainId, memberId, manuscriptId]);
    /* Review F3 (shared manuscripts): an ordinary Work (NULL) counts as an answer too. A manuscript held by an ordinary
       Work AND a program's Work, or by two programs' Works, is ambiguous: no program is assumed for it. */
    if (r.rows.length === 0) return { kind: 'none' };
    if (r.rows.length > 1) return { kind: 'ambiguous' };
    const only = r.rows[0]!.studio_path;
    return typeof only === 'string' ? { kind: 'one', id: only } : { kind: 'none' };
  } catch (error) {
    console.error('[editorial] work studio program unreadable; holding the conservative program posture', error);
    return { kind: 'unknown' };
  }
}

/** When the Work's program cannot be determined (ambiguous or unreadable): the safe common ground of every program. */
export function workProgramUncertainInstruction(): string {
  return [
    'PROGRAM UNCERTAIN: this Work\'s Studio program could not be determined for this turn.',
    'Call it the writer\'s Work. Stay with what is on the page and the writer\'s own words.',
    'Do not tell the writer what their writing means about them, and do not write it toward any outside reader\'s approval.',
    'Keep it plain and brief: one or two observations and one question.',
  ].join('\n');
}
