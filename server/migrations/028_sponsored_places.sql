-- Sponsored places (admin-curated placements across Home/Discover/Feed)
-- Full control: add/edit/delete, ordering, hide/unhide, optional schedule and creative overrides.

CREATE TABLE IF NOT EXISTS sponsored_places (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  place_id VARCHAR(120) NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  surface VARCHAR(32) NOT NULL DEFAULT 'all', -- 'home' | 'discover' | 'feed' | 'all'
  rank INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  badge_text TEXT,
  title_override TEXT,
  subtitle_override TEXT,
  image_override_url TEXT,
  cta_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_sponsored_places_surface_enabled_rank
  ON sponsored_places (surface, enabled, rank, created_at);

CREATE INDEX IF NOT EXISTS idx_sponsored_places_place_id
  ON sponsored_places (place_id);

-- Prevent duplicate placements per surface (allow separate entries for different surfaces).
CREATE UNIQUE INDEX IF NOT EXISTS uq_sponsored_places_place_surface
  ON sponsored_places (place_id, surface);

