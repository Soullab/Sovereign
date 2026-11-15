-- Living Works: which Studio program (path) a Work belongs to.
--
-- Founder authorization 2026-11-15 (ledger #1938): "We want each unique program to have its own
-- messaging in Studio". A Work started through a path's door (e.g. ?path=college-essay) records
-- that path, so the Studio and MAIA can speak in that program's own words
-- (lib/writersStudio/studioPaths.ts: studioCopy, studioPosture).
--
-- Member-declared: written only by the member's own act through PATCH
-- /api/sovereign/living-works/[id] (the path door's Begin), validated there against the
-- path registry. Never inferred from a title, form, invitation or anything the writer wrote.
-- NULL means no program, the ordinary Studio. Additive, nullable, no backfill.

BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE living_works
  ADD COLUMN IF NOT EXISTS studio_path text;
ALTER TABLE living_works
  DROP CONSTRAINT IF EXISTS living_works_studio_path_shape;
ALTER TABLE living_works
  ADD CONSTRAINT living_works_studio_path_shape
  CHECK (studio_path IS NULL OR studio_path ~ '^[a-z][a-z0-9-]{0,39}$');
COMMIT;
