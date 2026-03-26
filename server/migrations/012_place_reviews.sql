-- In-app place reviews; aggregated into public GET /api/places responses when present.
-- No-op if table already exists (e.g. Supabase / restored dump).

CREATE TABLE IF NOT EXISTS place_reviews (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(50) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  review TEXT,
  visit_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_reviews_place_id ON place_reviews (place_id);
