-- Optional structured menu / restaurant fields for food-way places (public detail + admin).
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS dining_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN places.dining_profile IS 'Restaurant-specific JSON: menuSections, links, service flags, cuisineTypes, etc.';
