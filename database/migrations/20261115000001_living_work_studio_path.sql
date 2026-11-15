-- Living Works: which Studio program (path) a Work belongs to.
--
-- Founder authorization 2026-11-15 (ledger #1938): "We want each unique program to have its own
-- messaging in Studio". A Work started through a path's door (e.g. ?path=college-essay) records
-- that path, so the Studio and MAIA can speak in that program's own words
-- (lib/writersStudio/studioPaths.ts: studioCopy, studioPosture).
--
-- Review findings 2026-11-15, addressed here:
--   F1  The database enforces REGISTERED programs, not just a format: studio_programs is the
--       registry's persistent mirror and living_works.studio_path references it. Adding a
--       program is a deliberate act: one registry entry plus one seed row (a reviewed migration).
--   F2  A Work's program is FIXED once chosen: it may go from NULL to a program once (the member's
--       own Begin) and never change or be cleared afterwards. Enforced by trigger, not only by API.
--
-- Member-declared: written only by the member's own act through PATCH
-- /api/sovereign/living-works/[id] (the path door's Begin). Never inferred from a title, form,
-- invitation or anything the writer wrote. NULL means no program, the ordinary Studio.
-- Additive, nullable, no backfill: existing Works keep NULL.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS studio_programs (
  id          TEXT        PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9-]{0,39}$'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO studio_programs (id) VALUES ('college-essay') ON CONFLICT (id) DO NOTHING;
COMMENT ON TABLE studio_programs IS
  'Writer''s Studio programs (paths) a Work may belong to. Mirrors lib/writersStudio/studioPaths.ts STUDIO_PATHS ids.';

ALTER TABLE living_works
  ADD COLUMN IF NOT EXISTS studio_path text;
ALTER TABLE living_works
  DROP CONSTRAINT IF EXISTS living_works_studio_path_program_fk;
ALTER TABLE living_works
  ADD CONSTRAINT living_works_studio_path_program_fk
  FOREIGN KEY (studio_path) REFERENCES studio_programs(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION living_works_studio_path_fixed()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.studio_path IS NOT NULL AND NEW.studio_path IS DISTINCT FROM OLD.studio_path THEN
    RAISE EXCEPTION 'living_works.studio_path is fixed once chosen'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS living_works_studio_path_fixed ON living_works;
CREATE TRIGGER living_works_studio_path_fixed
  BEFORE UPDATE OF studio_path ON living_works
  FOR EACH ROW EXECUTE FUNCTION living_works_studio_path_fixed();

COMMIT;
