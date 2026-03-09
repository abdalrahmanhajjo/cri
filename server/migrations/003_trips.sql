-- Trips table for plan-your-visit (itineraries with days and place IDs).
-- Run once if the table does not exist, e.g. psql $DATABASE_URL -f server/migrations/003_trips.sql
-- Adjust user_id type to match your users table (INT or UUID).

CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  days JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);

-- If your users table uses UUID, use instead:
-- user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
