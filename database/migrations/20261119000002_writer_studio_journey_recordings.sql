-- STUDIO ACADEMY SLICE 5 — recorded answers in the Beta journey (founder rulings 2026-11-19, "Approve defaults").
-- A writer may answer a journey question by audio or video, one recording at a time, after playing it back.
--
-- ⭐ The bytes live in the self-hosted file vault, ENCRYPTED with phiEncryption before they are written (storage_path points to
--    ciphertext; media_enc_meta holds its meta). The transcript is encrypted in transcript_enc. There is no plaintext column.
-- ⭐ Transcribed only by Soullab's own speech service (maia-whisper), inside the server.
-- ⭐ Withdrawal destroys the vault bytes, then hard-deletes the row. No soft-delete column exists on purpose.
-- ⭐ Retention: expires_at (365 days, or the end of the beta if sooner). Expired recordings are destroyed on every touch, never read.
-- ⛔ Readers: the writer (their own) and the founder only. Never MAIA's context, never training or adaptation.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS writer_studio_journey_recordings (
  id UUID PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  prompt_key TEXT NOT NULL CHECK (char_length(prompt_key) BETWEEN 1 AND 64),
  kind TEXT NOT NULL CHECK (kind IN ('audio', 'video')),
  mime TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 41943040),
  storage_path TEXT NOT NULL UNIQUE,
  media_enc_meta TEXT NOT NULL,
  transcript_enc TEXT,
  transcript_enc_meta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + INTERVAL '12 months'),
  CHECK ((transcript_enc IS NULL) = (transcript_enc_meta IS NULL))
);

CREATE INDEX IF NOT EXISTS writer_studio_journey_recordings_member_idx
  ON writer_studio_journey_recordings (member_id, prompt_key, created_at DESC);
CREATE INDEX IF NOT EXISTS writer_studio_journey_recordings_expiry_idx
  ON writer_studio_journey_recordings (expires_at);

COMMENT ON TABLE writer_studio_journey_recordings IS
  'Studio Academy slice 5: a writer''s recorded answer to a Beta-journey question. Encrypted bytes in the vault; withdrawal destroys them; expires within 12 months; founder-only reader.';

COMMIT;
