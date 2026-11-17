-- Grant `practitioner_admin` to named members and (optionally) Writer's Studio beta.
--
-- Mirrors, statement for statement, what the owner-only Member Permissions view does
-- (lib/admin/memberPermissions.ts: applyChange 'admin_level' and 'writers_studio',
-- and writeAudit). Same rows, same audit action, same transaction. Nothing else is touched.
--
-- ⛔ Run ONLY on production (minisforum) by the founder/CTO, deliberately. Not run by Claude.
-- ⛔ DRY RUN BY DEFAULT: it rolls back unless you pass -v commit=1.
--
-- Prerequisite: each person already has a MAIA member account (members row). This script
-- creates no members. It aborts, changing nothing, if any email matches 0 or 2+ members.
--
-- Usage (inside the postgres container on minisforum; adjust to your psql access):
--
--   docker exec -i maia-postgres psql -U soullab -d maia_consciousness \
--     -v actor_email='<your founder/cto member email>' \
--     -v heather_email='<heather member email>' \
--     -v andrea_email='<andrea member email>' \
--     -v andrea_beta=0 \
--     -v commit=0 \
--     < scripts/ops/grant-practitioner-admin-and-ws-beta.sql
--
-- Read the output ("PLAN" and "RESULT"), then re-run with -v commit=1 to apply.
-- Heather always receives Writer's Studio beta. Andrea receives it only with -v andrea_beta=1.

\set ON_ERROR_STOP on
\if :{?commit}
\else
  \set commit 0
\endif
\if :{?andrea_beta}
\else
  \set andrea_beta 0
\endif

BEGIN;

-- The acting owner: must be a founder or cto (same authority the web view requires).
CREATE TEMP TABLE _actor ON COMMIT DROP AS
  SELECT id FROM members
   WHERE lower(email) = lower(:'actor_email') AND admin_role IN ('founder', 'cto');

CREATE TEMP TABLE _t ON COMMIT DROP AS
  SELECT 'heather'::text AS label, m.id, true AS beta
    FROM members m WHERE lower(m.email) = lower(:'heather_email')
  UNION ALL
  SELECT 'andrea'::text, m.id, ((:andrea_beta)::int = 1)
    FROM members m WHERE lower(m.email) = lower(:'andrea_email');

-- Refuse anything ambiguous or unsafe before writing a single row.
DO $$
DECLARE
  n_actor int;
  lbl text;
  n int;
  owner_count int;
BEGIN
  SELECT count(*) INTO n_actor FROM _actor;
  IF n_actor <> 1 THEN
    RAISE EXCEPTION 'actor_email must match exactly one founder/cto member (matched %)', n_actor;
  END IF;

  FOREACH lbl IN ARRAY ARRAY['heather', 'andrea'] LOOP
    SELECT count(*) INTO n FROM _t WHERE label = lbl;
    IF n <> 1 THEN
      RAISE EXCEPTION '% email must match exactly one member (matched %); no member account yet?', lbl, n;
    END IF;
  END LOOP;

  -- Never lower an owner through this script.
  SELECT count(*) INTO owner_count
    FROM members m JOIN _t ON _t.id = m.id
   WHERE m.admin_role IN ('founder', 'cto');
  IF owner_count > 0 THEN
    RAISE EXCEPTION 'a target is already founder/cto; this script will not change owner standing';
  END IF;
END $$;

\echo
\echo '=== PLAN (current state of the two targets) ==='
SELECT t.label, m.id, m.name, m.email, m.admin_role AS current_admin_role,
       'practitioner_admin' AS new_admin_role, t.beta AS writers_studio_beta
  FROM _t t JOIN members m ON m.id = t.id
 ORDER BY t.label;

-- 1) admin level -> practitioner_admin (skipped when already set), with the ledger row
CREATE TEMP TABLE _before ON COMMIT DROP AS
  SELECT m.id, m.admin_role AS old_role FROM members m JOIN _t ON _t.id = m.id FOR UPDATE OF m;

INSERT INTO admin_role_grants (actor_id, actor_via, target_id, old_role, new_role)
  SELECT (SELECT id FROM _actor), 'member', b.id, b.old_role, 'practitioner_admin'
    FROM _before b WHERE b.old_role IS DISTINCT FROM 'practitioner_admin';

INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, ip_address, user_agent,
                        action_result, metadata, phi_accessed, consent_verified)
  SELECT (SELECT id FROM _actor), 'admin.member_permission_changed', 'member', b.id, NULL,
         'psql: scripts/ops/grant-practitioner-admin-and-ws-beta.sql', 'success',
         jsonb_build_object('change', jsonb_build_object('permission', 'admin_level', 'value', 'practitioner_admin'),
                            'before', b.old_role, 'after', 'practitioner_admin'),
         false, NULL
    FROM _before b WHERE b.old_role IS DISTINCT FROM 'practitioner_admin';

UPDATE members SET admin_role = 'practitioner_admin'
 WHERE id IN (SELECT id FROM _before WHERE old_role IS DISTINCT FROM 'practitioner_admin');

-- 2) Writer's Studio beta, where asked: update the most recent beta_tester contact, else create one
CREATE TEMP TABLE _ws ON COMMIT DROP AS
  SELECT t.id AS member_id,
         (SELECT c.id FROM ops_contacts c
           WHERE c.member_id = t.id AND c.contact_type = 'beta_tester' AND c.deleted_at IS NULL
           ORDER BY c.updated_at DESC LIMIT 1) AS contact_id
    FROM _t t WHERE t.beta;

UPDATE ops_contacts
   SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"writers_studio_beta": true}'::jsonb,
       pipeline_stage = 'active'
 WHERE id IN (SELECT contact_id FROM _ws WHERE contact_id IS NOT NULL);

INSERT INTO ops_contacts (name, email, contact_type, pipeline_stage, source, member_id, metadata)
  SELECT COALESCE(NULLIF(m.name, ''), m.username, 'Member'), m.email, 'beta_tester', 'active', 'platform', m.id,
         '{"writers_studio_beta": true}'::jsonb
    FROM _ws w JOIN members m ON m.id = w.member_id
   WHERE w.contact_id IS NULL;

INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, ip_address, user_agent,
                        action_result, metadata, phi_accessed, consent_verified)
  SELECT (SELECT id FROM _actor), 'admin.member_permission_changed', 'member', w.member_id, NULL,
         'psql: scripts/ops/grant-practitioner-admin-and-ws-beta.sql', 'success',
         jsonb_build_object('change', jsonb_build_object('permission', 'writers_studio', 'grant', true),
                            'after', jsonb_build_object('writersStudio', true, 'created', w.contact_id IS NULL)),
         false, NULL
    FROM _ws w;

\echo
\echo '=== RESULT (inside the transaction, before COMMIT/ROLLBACK) ==='
SELECT m.name, m.email, m.admin_role,
       EXISTS (SELECT 1 FROM ops_contacts c
                WHERE c.member_id = m.id AND c.deleted_at IS NULL AND c.contact_type = 'beta_tester'
                  AND c.pipeline_stage = 'active' AND c.metadata @> '{"writers_studio_beta": true}'::jsonb) AS writers_studio_beta_eligible
  FROM members m JOIN _t ON _t.id = m.id
 ORDER BY m.email;

\if :commit
  \echo '=== COMMIT ==='
  COMMIT;
\else
  \echo '=== DRY RUN: rolling back, nothing was changed. Re-run with -v commit=1 to apply. ==='
  ROLLBACK;
\endif
