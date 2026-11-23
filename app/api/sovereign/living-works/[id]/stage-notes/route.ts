// Production web requires force-dynamic for runtime database access.
export const dynamic = 'force-dynamic';

/**
 * The writer's own notes for each stage of a Studio program Work (founder 2026-11-16: "Yes, private by default").
 *
 * GET → { notes: [{ stage, body, updatedAt }] }          the member's own notes on their own Work
 * PUT { stage, body, checks? } → { note | null }          save (an empty body with no ticks removes the note)
 *
 * ⛔ PRIVATE BY DEFAULT. No MAIA path reads studio_stage_notes. A note reaches MAIA only when the writer sends it herself, as her
 *    own message in the conversation. ⛔ Owner-scoped in every predicate. Only a built stage of the Work's own program.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { getMemberIdFromRequest } from '@/lib/auth/getMemberFromRequest';
import { stageById, studioPathById } from '@/lib/writersStudio/studioPaths';
import { admittedToStudio, writersStudioStanding } from '@/lib/writersStudio/betaAccessServer';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

/* Review follow-up 2026-11-16: the same gates as the Studio's other server surfaces (e.g. the arrival route): no static build,
   a signed-in member, and Studio admission. Returns a response to send, or null to proceed. */
async function gate(req: NextRequest): Promise<{ memberId: string } | NextResponse> {
  if (process.env.CAPACITOR_BUILD) return NextResponse.json({ error: 'Not available in static build' }, { status: 501 });
  const memberId = await getMemberIdFromRequest(req);
  if (!memberId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  if (!admittedToStudio(await writersStudioStanding(memberId))) {
    return NextResponse.json({ refusal: 'not_in_beta_pilot' }, { status: 403, headers: privateHeaders });
  }
  return { memberId };
}
const MAX_STAGE_NOTE_CHARS = 20000;

async function ownedProgram(workId: string, memberId: string) {
  const r = await query<{ studio_path: string | null }>(
    `SELECT studio_path FROM living_works WHERE id = $1 AND member_id = $2`, [workId, memberId]);
  if (r.rows.length === 0) return { found: false as const };
  return { found: true as const, program: studioPathById(r.rows[0].studio_path) };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req);
  if (g instanceof NextResponse) return g;
  const { memberId } = g;
  const { id } = await ctx.params;
  try {
    const owned = await ownedProgram(id, memberId);
    if (!owned.found) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: privateHeaders });
    const r = await query<{ stage: string; body: string; checks: string[] | null; updated_at: string }>(
      `SELECT stage, body, checks, updated_at FROM studio_stage_notes WHERE living_work_id = $1 AND member_id = $2 ORDER BY stage`,
      [id, memberId]);
    return NextResponse.json({ notes: r.rows.map((n) => ({ stage: n.stage, body: n.body, checks: n.checks ?? [], updatedAt: n.updated_at })) },
      { headers: privateHeaders });
  } catch {
    console.error('[stage-notes] read failed');
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: privateHeaders });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req);
  if (g instanceof NextResponse) return g;
  const { memberId } = g;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as { stage?: unknown; body?: unknown; checks?: unknown } | null;
  if (!body || typeof body.body !== 'string' || body.body.length > MAX_STAGE_NOTE_CHARS) {
    return NextResponse.json({ error: 'malformed' }, { status: 400, headers: privateHeaders });
  }
  try {
    const owned = await ownedProgram(id, memberId);
    if (!owned.found) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: privateHeaders });
    if (!owned.program) return NextResponse.json({ error: 'no_studio_program' }, { status: 400, headers: privateHeaders });
    const stage = stageById(owned.program, body.stage);
    if (!stage) return NextResponse.json({ error: 'unknown_studio_stage' }, { status: 400, headers: privateHeaders });
    // Ticks: only this stage's own checklist ids, each once. Anything else is refused.
    const allowed = new Set((stage.checklist ?? []).map((c) => c.id));
    let checks: string[] = [];
    if (body.checks !== undefined) {
      if (!Array.isArray(body.checks) || body.checks.some((c) => typeof c !== 'string' || !allowed.has(c))
          || new Set(body.checks).size !== body.checks.length) {
        return NextResponse.json({ error: 'unknown_check' }, { status: 400, headers: privateHeaders });
      }
      checks = body.checks as string[];
    }
    if (body.body.trim() === '' && checks.length === 0) {
      await query(`DELETE FROM studio_stage_notes WHERE living_work_id = $1 AND member_id = $2 AND stage = $3`, [id, memberId, stage.id]);
      return NextResponse.json({ note: null }, { headers: privateHeaders });
    }
    const r = await query<{ stage: string; body: string; checks: string[]; updated_at: string }>(
      `INSERT INTO studio_stage_notes (living_work_id, member_id, stage, body, checks)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (living_work_id, stage) DO UPDATE SET body = EXCLUDED.body, checks = EXCLUDED.checks, updated_at = now()
         WHERE studio_stage_notes.member_id = EXCLUDED.member_id
       RETURNING stage, body, checks, updated_at`,
      [id, memberId, stage.id, body.body, checks]);
    if (r.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: privateHeaders });
    const n = r.rows[0];
    return NextResponse.json({ note: { stage: n.stage, body: n.body, checks: n.checks ?? [], updatedAt: n.updated_at } }, { headers: privateHeaders });
  } catch {
    console.error('[stage-notes] save failed');
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: privateHeaders });
  }
}
