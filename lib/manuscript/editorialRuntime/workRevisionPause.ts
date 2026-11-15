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
