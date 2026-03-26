-- Admin can soft-block accounts; login and API reject blocked users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users (is_blocked) WHERE is_blocked = true;

COMMENT ON COLUMN users.is_blocked IS 'When true, user cannot log in or use authenticated APIs';
