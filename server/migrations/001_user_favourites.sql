-- Favourites (saved places) for logged-in users.
-- Run this against your database once, e.g. psql $DATABASE_URL -f server/migrations/001_user_favourites.sql

CREATE TABLE IF NOT EXISTS user_favourites (
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favourites_user_id ON user_favourites(user_id);
