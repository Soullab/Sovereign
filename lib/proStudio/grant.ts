/**
 * HOUSE-ENTRANCE-01 §9 — the dedicated, provenance-bearing Pro Studio grant (reader).
 *
 * The ONLY source that may turn `proStudioEntitlement` into 'verified' for
 * `resolveProStudioEntrance` (lib/house/entrance.ts). A member holds the full Pro
 * Studio workspace when `pro_studio_grants` has a CURRENT row for them:
 *   unrevoked, started, and not yet expired — computed here at read time against the
 *   database clock, never stored.
 *
 * Each grant carries its provenance: path (paid | scholarship | exchange |
 * apprenticeship), who granted it, when, its window, and its revocation. Every grant
 * is revocable; the schema permits no other kind.
 *
 * ⛔ NOT `members.tier`, `subscription_*`, a practitioner row, `studioMode` or any
 *    session claim. This module never reads them (static test pins it).
 * ⛔ Workspace only. Holding a grant confers NO client-data, practitioner-relationship
 *    or Co-Lab permission; those surfaces keep their own guards and must not import
 *    this module. The static test pins the importer set to exactly two files: the Pro
 *    Studio door (app/pro-studio/page.tsx) and the Home door list (lib/house/proRooms.ts),
 *    which uses the reading only to show a link to /pro-studio.
 * ⛔ Read-only. Nothing here writes, issues or revokes a grant. Issuing grants is a
 *    separate, founder-governed act with no surface yet.
 *
 * Failure is closed and visible. If the table cannot be read (not yet migrated,
 * database down) the result is `unreadable` — distinguishable from `no_grant`, logged
 * with the exact table named (docs/ops/DB_MISSING_TABLE_DEGRADATION_AUDIT_2026-08-01.md)
 * — and the entitlement is 'absent', so the member sees the learn-and-try page.
 */
import { query } from '@/lib/db/postgres';

export const PRO_STUDIO_GRANT_PATHS = ['paid', 'scholarship', 'exchange', 'apprenticeship'] as const;
export type ProStudioGrantPath = (typeof PRO_STUDIO_GRANT_PATHS)[number];

export type ProStudioGrantReading =
  | { entitlement: 'verified'; state: 'current_grant'; grantId: string; path: ProStudioGrantPath }
  | { entitlement: 'absent'; state: 'no_grant' }
  | { entitlement: 'absent'; state: 'unreadable' };

type Runner = (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Current = unrevoked AND started AND (no end OR end in the future), on the DB clock. */
export const CURRENT_GRANT_SQL = `
  SELECT id, path
    FROM pro_studio_grants
   WHERE member_id = $1
     AND revoked_at IS NULL
     AND starts_at <= now()
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY granted_at DESC
   LIMIT 1`;

function isGrantPath(value: unknown): value is ProStudioGrantPath {
  return typeof value === 'string' && (PRO_STUDIO_GRANT_PATHS as readonly string[]).includes(value);
}

/**
 * Read whether `memberId` holds a current Pro Studio grant.
 * `memberId` must be the server session's member id — never a client-supplied value.
 */
export async function readProStudioGrant(
  memberId: string,
  run: Runner = query as unknown as Runner,
): Promise<ProStudioGrantReading> {
  if (typeof memberId !== 'string' || !UUID.test(memberId)) return { entitlement: 'absent', state: 'no_grant' };

  let rows: Array<Record<string, unknown>>;
  try {
    ({ rows } = await run(CURRENT_GRANT_SQL, [memberId]));
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    console.warn('[pro-studio-grant] pro_studio_grants unreadable; entitlement held absent', {
      table: 'pro_studio_grants',
      code: typeof code === 'string' ? code : 'unknown',
    });
    return { entitlement: 'absent', state: 'unreadable' };
  }

  const row = rows[0];
  if (!row) return { entitlement: 'absent', state: 'no_grant' };
  // The CHECK constraint already limits path; refuse rather than trust a row that disagrees.
  if (!isGrantPath(row.path) || typeof row.id !== 'string') {
    console.warn('[pro-studio-grant] grant row failed shape check; entitlement held absent', {
      table: 'pro_studio_grants',
    });
    return { entitlement: 'absent', state: 'unreadable' };
  }
  return { entitlement: 'verified', state: 'current_grant', grantId: row.id, path: row.path };
}
