-- Favourites (saved places) for logged-in users.
-- Aligns with users(id) UUID and places(id) varchar. App primarily uses saved_places; this is optional/legacy.

CREATE TABLE IF NOT EXISTS user_favourites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favourites_user_id ON user_favourites(user_id);
