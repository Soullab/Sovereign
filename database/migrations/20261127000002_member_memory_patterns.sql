-- MAIA pattern recognition across kept memory -- member-confirmed patterns + the member's dial.
-- (Renamed from 20261123000002 on 2026-11-27 so it sorts after 20261127000001 on main.)
--
-- Canon: docs/canon/SPIRAL_CONTINUITY_ENGINE.md §6a "The Pattern Offer" (ratified, Kelly,
-- 2026-11-23, "approved"). Working record:
-- docs/programme/MAIA_PATTERN_RECOGNITION_CANON_AMENDMENT_2026-11-23.md (§2b, §4).
--
-- What this stores, and what it never stores:
--   * A pattern MAIA OFFERED is stored ONLY when the member confirms it or corrects it in
--     their own words (§6a.4). An unanswered offer leaves no trace.
--   * A DISMISSED offer is remembered only as a content-free key over its sources, so the
--     same reading is not offered again. Its wording is never stored.
--   * Patterns are always personal scope. Client material never becomes a pattern (§6a.6).
--
-- crossing_must_be_false on member_memory_atoms is NOT touched. No atom is crossed or
-- mutated. A confirmed pattern is a separate member-owned record that references its
-- sources, and the member's confirmation is the "explicit member ratification" that
-- constraint already names.
--
-- All three tables are new. No existing table, column, constraint or row changes.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.member_memory_atoms') IS NULL THEN
    RAISE EXCEPTION 'member_memory_atoms missing: this migration builds on the Keep portfolio';
  END IF;
END $$;

-- 1. The member's dial (§6a.7). No row = 'full', the founder-chosen default.
CREATE TABLE IF NOT EXISTS member_pattern_preferences (
  member_id   UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  level       TEXT NOT NULL DEFAULT 'full'
              CHECK (level IN ('full', 'gentle', 'on_request', 'off')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE member_pattern_preferences IS
  'SCE §6a.7: the member''s pattern-recognition dial. Absent row = full (founder default, 2026-11-23). Written only by the member.';

-- 2. Member-confirmed patterns (§6a.4). Only 'confirmed' / 'corrected' are ever written;
--    'archived' is the member setting one aside.
CREATE TABLE IF NOT EXISTS member_memory_patterns (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id          UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  wording            TEXT NOT NULL CHECK (char_length(btrim(wording)) BETWEEN 1 AND 1000),
  -- Who wrote the words that are kept: MAIA's offer, confirmed as offered; or the member's
  -- correction, which replaces MAIA's wording entirely (Invariant 14: the member's language).
  worded_by          TEXT NOT NULL CHECK (worded_by IN ('maia', 'member')),
  status             TEXT NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('confirmed', 'corrected', 'archived')),
  -- P6: return authority is constructed from the member's act. Confirming a pattern
  -- is that act; the member can narrow it to member_pulled later.
  return_preference  TEXT NOT NULL DEFAULT 'contextual_doorway'
                     CHECK (return_preference IN ('member_pulled', 'contextual_doorway')),
  memory_scope       TEXT NOT NULL DEFAULT 'personal' CHECK (memory_scope = 'personal'),
  origin_surface     TEXT NOT NULL CHECK (origin_surface IN ('maia', 'between', 'room', 'pro_personal')),
  -- Content-free fingerprint of the source set; shared with the dismissal register.
  source_key         TEXT NOT NULL CHECK (source_key ~ '^[0-9a-f]{64}$'),
  offered_at         TIMESTAMPTZ,
  confirmed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_memory_patterns_wording_author CHECK (
    (status = 'corrected' AND worded_by = 'member')
    OR (status = 'confirmed' AND worded_by = 'maia')
    OR status = 'archived'
  )
);

CREATE INDEX IF NOT EXISTS idx_member_memory_patterns_member
  ON member_memory_patterns(member_id, status, confirmed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_memory_patterns_source_key
  ON member_memory_patterns(member_id, source_key);

COMMENT ON TABLE member_memory_patterns IS
  'SCE §6a: patterns across kept material, stored ONLY after the member confirms or corrects them. Member-owned: visible, editable, archivable, deletable on Keep & Capture.';

-- 3. Sources (§6a.3). Every pattern names what it rests on. Exactly one referent per row.
CREATE TABLE IF NOT EXISTS member_memory_pattern_sources (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id         UUID NOT NULL REFERENCES member_memory_patterns(id) ON DELETE CASCADE,
  source_kind        TEXT NOT NULL CHECK (source_kind IN ('atom', 'pattern')),
  atom_id            UUID REFERENCES member_memory_atoms(id) ON DELETE CASCADE,
  source_pattern_id  UUID REFERENCES member_memory_patterns(id) ON DELETE CASCADE,
  position           SMALLINT NOT NULL CHECK (position >= 0),
  CONSTRAINT member_memory_pattern_sources_one_referent CHECK (
    (source_kind = 'atom' AND atom_id IS NOT NULL AND source_pattern_id IS NULL)
    OR (source_kind = 'pattern' AND source_pattern_id IS NOT NULL AND atom_id IS NULL)
  ),
  CONSTRAINT member_memory_pattern_sources_not_self CHECK (source_pattern_id IS DISTINCT FROM pattern_id)
);

CREATE INDEX IF NOT EXISTS idx_member_memory_pattern_sources_pattern
  ON member_memory_pattern_sources(pattern_id, position);
CREATE INDEX IF NOT EXISTS idx_member_memory_pattern_sources_atom
  ON member_memory_pattern_sources(atom_id) WHERE atom_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_member_memory_pattern_sources_pattern_ref
  ON member_memory_pattern_sources(source_pattern_id) WHERE source_pattern_id IS NOT NULL;

-- A pattern left resting on fewer than two sources is retired (amendment record §4):
-- when a member deletes a kept item, every pattern that leaned on it loses that leg,
-- and a pattern with one leg left no longer stands.
CREATE OR REPLACE FUNCTION retire_thin_member_memory_patterns() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM member_memory_patterns p
   WHERE p.id = OLD.pattern_id
     AND (SELECT count(*) FROM member_memory_pattern_sources s WHERE s.pattern_id = OLD.pattern_id) < 2;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_retire_thin_member_memory_patterns ON member_memory_pattern_sources;
CREATE TRIGGER trg_retire_thin_member_memory_patterns
  AFTER DELETE ON member_memory_pattern_sources
  FOR EACH ROW EXECUTE FUNCTION retire_thin_member_memory_patterns();

-- 4. Dismissal register (§6a.4, SCE §11 non-formation register). Content-free by design:
--    only the fingerprint of the source set, never the wording MAIA offered.
CREATE TABLE IF NOT EXISTS member_pattern_dismissals (
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  source_key    TEXT NOT NULL CHECK (source_key ~ '^[0-9a-f]{64}$'),
  dismissed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, source_key)
);

COMMENT ON TABLE member_pattern_dismissals IS
  'SCE §6a.4: a dismissed pattern is not offered again. Stores only a sha256 over the sorted source ids; the offered wording is never kept.';

COMMIT;
