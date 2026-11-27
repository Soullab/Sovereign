-- HOUSE-ENTRANCE-01 -- the dedicated, provenance-bearing Pro Studio grant.
--
-- ⛔ DRAFT FOR FOUNDER REVIEW. Not applied anywhere. Merging this file puts it on the
--    path to production (the runner applies every unrecorded file), so the merge IS
--    the founder's review of this schema.
--
-- Design:  docs/programme/HOUSE-ENTRANCE-01_LEARN_AND_TRY_PAGE_DESIGN_2026-10-30.md §9
--          docs/programme/PRO_STUDIO_GRANT_DESIGN_2026-11-27.md
-- Rulings: founder 2026-10-30 (four canon paths intact; tier is not the entitlement);
--          founder 2026-11-27 ("founder now, grant next").
--
-- What a row says: member X holds the full Pro Studio workspace by one named canon
-- path (paid | scholarship | exchange | apprenticeship), granted by a named steward
-- at a named time, from starts_at until expires_at (or with no set end), and it can
-- be revoked. "Current" is DERIVED at read time
--   (revoked_at IS NULL AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now()))
-- and is never stored, so it cannot go stale.
--
-- What a row does NOT say:
--   * It is NOT derived from, and never writes, members.tier / subscription_*.
--   * It confers NO client-data, practitioner-relationship or Co-Lab permission.
--     Those surfaces keep their own guards; nothing references this table.
--   * It holds no member expression. basis_ref is an administrative pointer
--     (e.g. a decision or receipt reference), length-capped.
--
-- Shape of custody:
--   * Append-only. A row is never deleted and its grant facts never change.
--   * The ONLY permitted update is a single revocation: revoked_at + revoked_by_member_id
--     set together, once. Re-granting is a new row, so the history stays readable.
--   * A steward cannot grant to themselves.
--
-- Prerequisite: members (20260103000001).

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.members') IS NULL THEN
    RAISE EXCEPTION 'members missing: apply 20260103000001_members.sql first';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pro_studio_grants (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id             uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  path                  text NOT NULL
                          CHECK (path IN ('paid', 'scholarship', 'exchange', 'apprenticeship')),
  granted_by_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  granted_at            timestamptz NOT NULL DEFAULT now(),
  starts_at             timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NULL,
  basis_ref             text NULL CHECK (basis_ref IS NULL OR char_length(basis_ref) BETWEEN 1 AND 200),
  revoked_at            timestamptz NULL,
  revoked_by_member_id  uuid NULL REFERENCES members(id) ON DELETE RESTRICT,

  CONSTRAINT pro_studio_grants_no_self_grant CHECK (granted_by_member_id <> member_id),
  CONSTRAINT pro_studio_grants_window CHECK (expires_at IS NULL OR expires_at > starts_at),
  CONSTRAINT pro_studio_grants_revocation_pair
    CHECK ((revoked_at IS NULL) = (revoked_by_member_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_pro_studio_grants_member_unrevoked
  ON pro_studio_grants (member_id)
  WHERE revoked_at IS NULL;

-- Append-only, revocation-only.
CREATE OR REPLACE FUNCTION pro_studio_grants_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'pro_studio_grants is append-only: revoke the grant instead of deleting it';
  END IF;

  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'pro_studio_grants %: already revoked; grant again with a new row', OLD.id;
  END IF;

  IF NEW.id                   IS DISTINCT FROM OLD.id
  OR NEW.member_id            IS DISTINCT FROM OLD.member_id
  OR NEW.path                 IS DISTINCT FROM OLD.path
  OR NEW.granted_by_member_id IS DISTINCT FROM OLD.granted_by_member_id
  OR NEW.granted_at           IS DISTINCT FROM OLD.granted_at
  OR NEW.starts_at            IS DISTINCT FROM OLD.starts_at
  OR NEW.expires_at           IS DISTINCT FROM OLD.expires_at
  OR NEW.basis_ref            IS DISTINCT FROM OLD.basis_ref THEN
    RAISE EXCEPTION 'pro_studio_grants %: grant facts are immutable; only revocation may be recorded', OLD.id;
  END IF;

  IF NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'pro_studio_grants %: the only permitted update is a revocation', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pro_studio_grants_no_update ON pro_studio_grants;
CREATE TRIGGER pro_studio_grants_no_update
  BEFORE UPDATE ON pro_studio_grants
  FOR EACH ROW EXECUTE FUNCTION pro_studio_grants_guard();

DROP TRIGGER IF EXISTS pro_studio_grants_no_delete ON pro_studio_grants;
CREATE TRIGGER pro_studio_grants_no_delete
  BEFORE DELETE ON pro_studio_grants
  FOR EACH ROW EXECUTE FUNCTION pro_studio_grants_guard();

COMMENT ON TABLE pro_studio_grants IS
  'HOUSE-ENTRANCE-01 §9. Provenance-bearing Pro Studio workspace grant (paid|scholarship|exchange|apprenticeship). Current = unrevoked and inside [starts_at, expires_at). NOT derived from members.tier. Confers no client-data or Co-Lab permission. Append-only; revocation is the only update.';
COMMENT ON COLUMN pro_studio_grants.granted_by_member_id IS
  'The steward who granted it. Never the grantee.';
COMMENT ON COLUMN pro_studio_grants.basis_ref IS
  'Administrative pointer to the basis (decision, receipt). Not member expression. <=200 chars.';

-- Post-create shape check: refuse to record a table that does not match this file.
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(c, ', ') INTO missing
  FROM unnest(ARRAY['id','member_id','path','granted_by_member_id','granted_at','starts_at',
                    'expires_at','basis_ref','revoked_at','revoked_by_member_id']) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pro_studio_grants' AND column_name = c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'pro_studio_grants exists with an unexpected shape; missing column(s): %', missing;
  END IF;
END $$;

COMMIT;
