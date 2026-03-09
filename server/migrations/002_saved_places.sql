-- Saved places table (user_id uuid, place_id varchar).
-- Use this if your app uses saved_places instead of user_favourites.
-- Run once, e.g. psql $DATABASE_URL -f server/migrations/002_saved_places.sql
-- If your users table has id as UUID, add: REFERENCES auth.users(id) or REFERENCES users(id) ON DELETE CASCADE

CREATE TABLE IF NOT EXISTS saved_places (
  user_id  UUID NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  PRIMARY KEY (user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_places_user_id ON saved_places(user_id);
