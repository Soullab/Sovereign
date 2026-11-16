-- Studio program stages and the writer's private stage notes (College Essay: Discovery → Meaning → Voice → Draft → Revise → Ready).
--
-- Founder 2026-11-16 (ledger #1938): "We want all phases of writing process for College essay ready to test", and, for where a
-- student's stage reflections live: "Yes, private by default" (MAIA reads a note only when the writer shows it to her).
--
-- 1. living_works.studio_stage — WHERE in its program's arc the writer has put this Work. Member-declared only (PATCH, the
--    writer's own "Move to …"); never inferred, never advanced by the system. NULL = the program's first stage. Kept apart from
--    living_works.stage on purpose: that is the Work's general maturity (capturing … sharing), a different vocabulary; mapping
--    six essay stages onto five would collapse two (Meaning, Voice). The registry (lib/writersStudio/studioPaths.ts) is the
--    authority on which ids exist; the route accepts only a stage of the Work's own program.
-- 2. studio_stage_notes — the writer's own notes (and checklist ticks) for each stage of a program Work. PRIVATE BY DEFAULT: no MAIA path reads this
--    table; a note reaches MAIA only when the writer sends it herself (as her own message). One note per Work and stage, editable.
--    Removed with the Work or the member (R20).
-- Additive: one nullable column, one new table. No existing row changes.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE living_works
  ADD COLUMN IF NOT EXISTS studio_stage text;
ALTER TABLE living_works
  DROP CONSTRAINT IF EXISTS living_works_studio_stage_format;
ALTER TABLE living_works
  ADD CONSTRAINT living_works_studio_stage_format
  CHECK (studio_stage IS NULL OR studio_stage ~ '^[a-z][a-z0-9-]{0,39}$');
-- A stage belongs to a program: a Work with no program has no stage.
ALTER TABLE living_works
  DROP CONSTRAINT IF EXISTS living_works_studio_stage_needs_program;
ALTER TABLE living_works
  ADD CONSTRAINT living_works_studio_stage_needs_program
  CHECK (studio_stage IS NULL OR studio_path IS NOT NULL);

CREATE TABLE IF NOT EXISTS studio_stage_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  living_work_id  UUID        NOT NULL REFERENCES living_works(id) ON DELETE CASCADE,
  member_id       UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  stage           TEXT        NOT NULL CHECK (stage ~ '^[a-z][a-z0-9-]{0,39}$'),
  body            TEXT        NOT NULL CHECK (char_length(body) <= 20000),
  -- The writer's own ticks on a stage's checklist (e.g. Ready's readiness check): checklist item ids from the registry.
  checks          TEXT[]      NOT NULL DEFAULT '{}' CHECK (cardinality(checks) <= 20),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (living_work_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_studio_stage_notes_member ON studio_stage_notes (member_id);

COMMENT ON TABLE studio_stage_notes IS
  'The writer''s own notes per Studio program stage (founder 2026-11-16: private by default). No MAIA path reads this table; a note reaches MAIA only as the writer''s own sent message.';
COMMENT ON COLUMN living_works.studio_stage IS
  'Where in its program''s arc the writer has put this Work (member-declared; NULL = first stage). Registry: lib/writersStudio/studioPaths.ts.';

COMMIT;
