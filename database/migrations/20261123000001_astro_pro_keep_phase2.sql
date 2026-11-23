-- ASTRO-PRO-KEEP Phase 2 -- a member may carry an own-chart Pro exchange into MAIA's memory.
--
-- Design: docs/programme/ASTRO-PRO-KEEP_PHASE2_MEMORY_DESIGN_2026-11-23.md
-- Founder ruling (Kelly, 2026-11-23, "Approve as designed"):
--   (a) own-chart passages reach MAIA's wider memory only when the member presses
--       "Keep with MAIA" on an exchange (R4H principles 1-2, #1817);
--   (b) MAIA offers connections as questions, never conclusions (crossing_must_be_false stands);
--   (c) clients are recalled only inside Pro, per chart, and never become memory atoms.
--
-- Two changes, both additive:
--   1. astro_pro_turns gains a stable uuid id, so a carried atom can name the exact
--      turn it came from (member_memory_atoms.source_id). Existing rows get one each.
--      ADD COLUMN with a volatile default rewrites the table; row UPDATE triggers
--      (the append-only guard) do not fire, and no turn content changes.
--   2. 'astro_pro_exchange' joins the member_memory_atoms.source_type vocabulary.
--      Replace, never loosen: all eleven existing values are preserved exactly.
--
-- NO BACKFILL of atoms. Nothing is carried that a member did not carry.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- Prerequisite: Phase 1 (20261122000001) must already be applied.
DO $$
BEGIN
  IF to_regclass('public.astro_pro_turns') IS NULL THEN
    RAISE EXCEPTION 'astro_pro_turns missing: apply 20261122000001_astro_pro_conversations.sql first';
  END IF;
END $$;

-- 1. Turn ids.
ALTER TABLE astro_pro_turns
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_astro_pro_turns_id ON astro_pro_turns(id);

COMMENT ON COLUMN astro_pro_turns.id IS
  'ASTRO-PRO-KEEP Phase 2. Stable id named by a carried memory atom (member_memory_atoms.source_id, source_type astro_pro_exchange).';

-- 2. source_type vocabulary. Refuse rather than corrupt.
DO $$
DECLARE unexpected text;
BEGIN
  SELECT string_agg(DISTINCT source_type, ', ') INTO unexpected
  FROM member_memory_atoms
  WHERE source_type IS NOT NULL
    AND source_type NOT IN (
      'idea','idea_block','journal','dream','reflection',
      'decision','change','session_excerpt','spontaneous','practitioner_observation',
      'capsule','astro_pro_exchange'
    );
  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION
      'Refusing to replace source_type CHECK: unexpected value(s) present: %. '
      'Rewriting the constraint would silently outlaw rows that already exist.',
      unexpected;
  END IF;
END $$;

ALTER TABLE member_memory_atoms
  DROP CONSTRAINT IF EXISTS member_memory_atoms_source_type_check;

ALTER TABLE member_memory_atoms
  ADD CONSTRAINT member_memory_atoms_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'idea'::text,
    'idea_block'::text,
    'journal'::text,
    'dream'::text,
    'reflection'::text,
    'decision'::text,
    'change'::text,
    'session_excerpt'::text,
    'spontaneous'::text,
    'practitioner_observation'::text,
    'capsule'::text,
    'astro_pro_exchange'::text
  ]));

COMMIT;
