-- Soft-hide reviews from public lists (admin / venue owner); author can still delete own row.

ALTER TABLE place_reviews ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_place_reviews_place_visible ON place_reviews (place_id) WHERE hidden_at IS NULL;
