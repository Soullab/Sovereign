/**
 * WHAT THE WRITER HAS DONE WITH MAIA'S SUGGESTED EDITS — for the Work conversation.
 *
 * E0 walk 2026-11-23: the passage room learned what was applied and undone (83c446b0), but
 * the Work conversation had no account of it, so the two doorways could disagree about the
 * writer's own acts. This reads the same receipts the desk writes — an accepted revision
 * authorization, and its undo record — and states, per place, only the latest outcome.
 *
 * ⛔ PLACES ONLY, NEVER WORDING. The Work conversation's reading permission governs what
 * manuscript text MAIA may see there; this block must not become a way around it. It names
 * a section heading and an outcome, nothing else.
 * ⛔ Proposals the writer never applied are not listed: they are not decisions.
 * ⛔ Nothing here is inferred from text.
 */
import { query } from '@/lib/db/postgres';

export interface EditingOutcome {
  /** Section heading where the edit landed, or null when it cannot be named. */
  readonly place: string | null;
  readonly outcome: 'applied' | 'undone';
}

const oneLine = (s: string) => s.replace(/\s*[\r\n]+\s*/g, ' ').trim().slice(0, 120);

export function editingHistoryText(outcomes: readonly EditingOutcome[]): string {
  if (outcomes.length === 0) return '';
  return [
    "WHAT THE WRITER HAS DONE WITH YOUR SUGGESTED EDITS (from the Studio's records; places only, no wording):",
    ...outcomes.map((o) => {
      const where = o.place ? `In "${oneLine(o.place)}"` : 'In one passage';
      return o.outcome === 'undone'
        ? `  - ${where}: the writer applied one of your suggested edits, then undid it. Their own wording stands there now.`
        : `  - ${where}: the writer applied one of your suggested edits. It is in the manuscript now.`;
    }),
    'Never describe an undone edit as what the page says. Suggestions the writer did not apply are not listed and are not decisions.',
  ].join('\n');
}

/** Latest outcome per proposal conversation on this manuscript, for this member only. */
export async function editingHistoryForManuscript(
  memberId: string,
  manuscriptId: string,
): Promise<EditingOutcome[]> {
  const result = await query<{ heading: string | null; undone: boolean }>(
    `SELECT DISTINCT ON (a.proposal_chain_id)
            ms.heading, (r.undone_at IS NOT NULL) AS undone
       FROM manuscript_revision_authorizations a
       LEFT JOIN manuscript_application_recovery r ON r.authorization_id = a.id
       LEFT JOIN manuscript_draft_sections ds ON ds.id = a.target_section_id
       LEFT JOIN manuscript_sections ms ON ms.id = ds.source_section_id
      WHERE a.member_id = $1 AND a.work_id = $2 AND a.accepted_at IS NOT NULL
      ORDER BY a.proposal_chain_id, a.resulting_version DESC
      LIMIT 24`,
    [memberId, manuscriptId],
  );
  return result.rows.map((r) => ({ place: r.heading, outcome: r.undone ? 'undone' : 'applied' }));
}

export async function editingHistoryContextForManuscript(
  memberId: string,
  manuscriptId: string,
): Promise<string> {
  return editingHistoryText(await editingHistoryForManuscript(memberId, manuscriptId));
}
