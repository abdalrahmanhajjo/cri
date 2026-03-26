-- Business owners can block a visitor from sending new inquiries / follow-ups to a place.
CREATE TABLE IF NOT EXISTS place_messaging_blocks (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  blocked_user_id UUID NULL REFERENCES users (id) ON DELETE CASCADE,
  blocked_email VARCHAR(320) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT place_messaging_blocks_identifier_chk CHECK (
    (blocked_user_id IS NOT NULL AND blocked_email IS NULL)
    OR (blocked_user_id IS NULL AND blocked_email IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_place_messaging_blocks_user
  ON place_messaging_blocks (place_id, blocked_user_id)
  WHERE blocked_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_place_messaging_blocks_email
  ON place_messaging_blocks (place_id, lower(trim(blocked_email)))
  WHERE blocked_email IS NOT NULL AND blocked_user_id IS NULL;
