-- STUDIO ACADEMY SLICE 6 — "Share this with Soullab" (founder rulings 2026-11-19: "Writer shares each one"; "Approve defaults").
-- A writer may, one exchange at a time, share one question and MAIA's answer with Soullab so the programme can learn from it.
--
-- ⭐ Encrypted from birth: the exchange is held only as snapshot_enc (lib/security/phiAccessors/sharedExchanges.ts); there is no
--    plaintext column. The AAD binds the ciphertext to this row and to the member who shared it.
-- ⭐ Withdrawal is a hard DELETE of the row (the only copy). No soft-delete column exists on purpose.
-- ⭐ Retention: every row carries expires_at (12 months, or the end of the beta if that is sooner). Expired rows are never read and
--    are deleted by the store on every touch.
-- ⭐ Sanctuary: only a stored MAIA turn can be shared (FK to ask_turns), and Sanctuary turns are never stored.
-- ⭐ Deleting the conversation, the Work or the member deletes the share (ON DELETE CASCADE).
-- ⛔ Readers: the writer (their own) and the founder only. Never read into MAIA's context, never used for training or adaptation.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS writer_studio_shared_exchanges (
  id UUID PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  living_work_id UUID NOT NULL REFERENCES living_works(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL,
  maia_turn_index INTEGER NOT NULL,
  snapshot_enc TEXT NOT NULL,
  snapshot_enc_meta TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + INTERVAL '12 months'),
  UNIQUE (member_id, thread_id, maia_turn_index),
  FOREIGN KEY (thread_id, maia_turn_index)
    REFERENCES ask_turns(thread_id, turn_index) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS writer_studio_shared_exchanges_member_idx
  ON writer_studio_shared_exchanges (member_id, living_work_id);
CREATE INDEX IF NOT EXISTS writer_studio_shared_exchanges_expiry_idx
  ON writer_studio_shared_exchanges (expires_at);

COMMENT ON TABLE writer_studio_shared_exchanges IS
  'Studio Academy slice 6: one question and MAIA''s answer, shared by the writer with Soullab. Encrypted; withdrawal hard-deletes; expires within 12 months; founder-only reader.';

COMMIT;
