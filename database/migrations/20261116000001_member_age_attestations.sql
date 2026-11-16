-- Member age attestations for Studio programs that may be used by students (College Essay).
--
-- Founder ruling 2026-11-16 (recorded on #1900 and #1938), verbatim:
--   "if minors are using they must check off that they are under adult supervision."
--   "Yes, block under 13"  (reply to: under-13s turned away; 13–17 allowed after the adult-supervision check)
--
-- What this stores: the member's own attestation, by their own act at the program door:
--   'adult'  — they are 18 or older;
--   'minor'  — they are 13–17 AND they ticked that a parent, guardian or teacher is supervising (always true for 'minor').
-- ⛔ Nothing is ever stored for someone who says they are under 13: there is no row shape for it. They are turned away.
-- ⛔ Never writing, never a birth date, never inferred. Self-attested; not verification.
--
-- Shape: append-only (as writers_studio_beta_grant_events). A member's standing is their latest row. Erasing a member
-- removes their attestations with them (R20, ON DELETE CASCADE).
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS member_age_attestations (
  id                    BIGSERIAL   PRIMARY KEY,
  member_id             UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  age_band              TEXT        NOT NULL CHECK (age_band IN ('adult', 'minor')),
  supervision_attested  BOOLEAN     NOT NULL,
  -- The program door where it was given (a registered Studio program id), for the record only.
  studio_path           TEXT        CHECK (studio_path IS NULL OR studio_path ~ '^[a-z][a-z0-9-]{0,39}$'),
  attested_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A minor's attestation always carries the supervision tick; an adult's never needs one.
  CONSTRAINT member_age_attestations_minor_supervised CHECK (age_band <> 'minor' OR supervision_attested)
);

CREATE INDEX IF NOT EXISTS idx_member_age_attestations_member_latest
  ON member_age_attestations (member_id, id DESC);

-- Append-only: an attestation is never edited, and is removed only with its member.
CREATE OR REPLACE FUNCTION member_age_attestations_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'member_age_attestations is append-only';
  END IF;
  IF EXISTS (SELECT 1 FROM members WHERE id = OLD.member_id) THEN
    RAISE EXCEPTION 'member_age_attestations rows are removed only with their member';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS member_age_attestations_guard ON member_age_attestations;
CREATE TRIGGER member_age_attestations_guard
  BEFORE UPDATE OR DELETE ON member_age_attestations
  FOR EACH ROW EXECUTE FUNCTION member_age_attestations_guard();

CREATE OR REPLACE FUNCTION member_age_attestations_no_truncate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'member_age_attestations may not be truncated';
END;
$$;

DROP TRIGGER IF EXISTS member_age_attestations_no_truncate ON member_age_attestations;
CREATE TRIGGER member_age_attestations_no_truncate
  BEFORE TRUNCATE ON member_age_attestations
  FOR EACH STATEMENT EXECUTE FUNCTION member_age_attestations_no_truncate();

COMMENT ON TABLE member_age_attestations IS
  'Self-attested age band at a Studio program door (founder ruling 2026-11-16, #1900): adult, or minor with adult supervision. Nothing stored for under-13 (turned away). Append-only.';

COMMIT;
