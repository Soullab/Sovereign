-- ASTRO-PRO-KEEP Phase 1 -- Pro Astrology "Ask MAIA" conversations are kept.
--
-- Spec: docs/programme/ASTRO-PRO-KEEP-CONVERSATIONS_SPEC_2026-11-22.md
-- Owner chain: SOULLAB-CONTINUITY-01 #1982 -> ASTRO-PRO-04 #1893.
--
-- Founder rulings (Kelly, 2026-11-22):
--   1. Pro conversations are kept (supersedes R6 "visit-bound").
--   2. Keep is ON by default, with a per-conversation "Keep this conversation"
--      switch the member can turn off.
--   3. Members build on these conversations and expect to resume them.
--
-- A thread is keyed by the panel's subject key (ask.<section>.<subject>.<other>),
-- so a client's thread never mixes with the astrologer's own.
--
-- NOT conversation_turns, on purpose: that table is recalled into main MAIA for
-- every member row. Recall into MAIA's wider memory is Phase 2, deliberate and
-- consented. Nothing here is a memory substrate.
--
-- Modelled on ask_threads / ask_turns: turns are append-only (UPDATE refused by
-- trigger); DELETE is allowed so the member can remove a conversation, and a
-- thread's turns cascade with it. member_id is ON DELETE RESTRICT and the table
-- is registered in the delete-account route's GOVERNED_CONTENT.
--
-- Additive. Creates two new tables.

BEGIN;

CREATE TABLE IF NOT EXISTS astro_pro_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  subject_key text NOT NULL CHECK (length(subject_key) > 0),
  keep boolean NOT NULL DEFAULT true,
  opened_at timestamptz NOT NULL DEFAULT now(),
  last_turn_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_astro_pro_threads_member_subject
  ON astro_pro_threads(member_id, subject_key, last_turn_at DESC);

CREATE TABLE IF NOT EXISTS astro_pro_turns (
  thread_id uuid NOT NULL REFERENCES astro_pro_threads(id) ON DELETE CASCADE,
  turn_index integer NOT NULL CHECK (turn_index >= 0),
  speaker text NOT NULL CHECK (speaker IN ('member', 'maia')),
  body text NOT NULL CHECK (length(body) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, turn_index)
);

CREATE OR REPLACE FUNCTION astro_pro_turns_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'astro pro turn %/% is append-only: a correction is a new turn, never a revision',
    OLD.thread_id, OLD.turn_index;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS astro_pro_turns_no_update ON astro_pro_turns;
CREATE TRIGGER astro_pro_turns_no_update
  BEFORE UPDATE ON astro_pro_turns
  FOR EACH ROW EXECUTE FUNCTION astro_pro_turns_append_only();

COMMENT ON TABLE astro_pro_threads IS
  'ASTRO-PRO-KEEP. One kept Pro Ask-MAIA conversation per subject_key. Member-owned; not a memory substrate.';
COMMENT ON TABLE astro_pro_turns IS
  'ASTRO-PRO-KEEP. Append-only turns; UPDATE refused by trigger; DELETE allowed so the member can remove them.';

COMMIT;
