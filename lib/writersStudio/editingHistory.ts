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
  /**
   * Whether the section still holds the result of that outcome (the applied body, or after an
   * undo the writer's original), compared exactly in the database. null = cannot be checked.
   * ⭐ History says what HAPPENED; only this says what is there NOW.
   */
  readonly stillThere: boolean | null;
}

const oneLine = (s: string) => s.replace(/\s*[\r\n]+\s*/g, ' ').trim().slice(0, 120);

export function editingHistoryText(outcomes: readonly EditingOutcome[]): string {
  if (outcomes.length === 0) return '';
  return [
    "WHAT THE WRITER HAS DONE WITH YOUR SUGGESTED EDITS (from the Studio's records; places only, no wording):",
    ...outcomes.map((o) => {
      const where = o.place ? `In "${oneLine(o.place)}"` : 'In one passage';
      const changedSince = ' The passage has changed since, so do not assume what the page says there now.';
      if (o.outcome === 'undone') {
        return `  - ${where}: the writer applied one of your suggested edits, then undid it.`
          + (o.stillThere === true ? ' Their own wording stands there now.' : o.stillThere === false ? changedSince : '');
      }
      return `  - ${where}: the writer applied one of your suggested edits.`
        + (o.stillThere === true ? ' It is in the manuscript now.' : o.stillThere === false ? changedSince : '');
    }),
    'Never describe an undone edit as what the page says. Suggestions the writer did not apply are not listed and are not decisions.',
  ].join('\n');
}

/** Latest outcome per proposal conversation on this manuscript, for this member only. */
export async function editingHistoryForManuscript(
  memberId: string,
  manuscriptId: string,
): Promise<EditingOutcome[]> {
  /* still_there: the bodies are COMPARED here and never returned — only a boolean leaves the query. */
  const result = await query<{ heading: string | null; undone: boolean; still_there: boolean | null }>(
    /* Pre-review of #2380: DISTINCT ON orders by chain id, so the LIMIT kept arbitrary chains.
       The latest outcome per chain is chosen inside; the 24 MOST RECENT are kept outside. */
    `SELECT heading, undone, still_there FROM (
     SELECT DISTINCT ON (a.proposal_chain_id)
            a.accepted_at, ms.heading, (r.undone_at IS NOT NULL) AS undone,
            CASE WHEN ds.text IS NULL OR r.authorization_id IS NULL THEN NULL
                 WHEN r.undone_at IS NOT NULL
                   THEN length(r.before_body) > 0 AND position(r.before_body IN ds.text) > 0
                 ELSE length(r.after_body) > 0 AND position(r.after_body IN ds.text) > 0
            END AS still_there
       FROM manuscript_revision_authorizations a
       LEFT JOIN manuscript_application_recovery r ON r.authorization_id = a.id
       LEFT JOIN manuscript_draft_sections ds ON ds.id = a.target_section_id
       LEFT JOIN manuscript_sections ms ON ms.id = ds.source_section_id
      WHERE a.member_id = $1 AND a.work_id = $2 AND a.accepted_at IS NOT NULL
      ORDER BY a.proposal_chain_id, a.resulting_version DESC
     ) latest
      ORDER BY accepted_at DESC
      LIMIT 24`,
    [memberId, manuscriptId],
  );
  return result.rows.map((r) => ({
    place: r.heading, outcome: r.undone ? 'undone' : 'applied',
    stillThere: r.still_there === null || r.still_there === undefined ? null : Boolean(r.still_there),
  }));
}

export async function editingHistoryContextForManuscript(
  memberId: string,
  manuscriptId: string,
): Promise<string> {
  return editingHistoryText(await editingHistoryForManuscript(memberId, manuscriptId));
}
