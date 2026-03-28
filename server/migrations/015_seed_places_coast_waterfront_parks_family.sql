-- NOTE: Superseded for full resets by 020_tripoli_heritage_places_reset.sql (wipes all places).
-- Seed 4 Tripoli places under:
-- - coast_waterfront (2 places)
-- - parks_family (2 places)
--
-- These entries are designed to immediately show up in:
-- - Public place directory (/discover, /activities)
-- - Home “Find your way” buckets (sea + family)
-- - Admin pickers
--
-- Note: review/rating and coordinates are initial values; update them in Admin → Places
-- if you want exact official numbers and media.

INSERT INTO places (
  id,
  name,
  description,
  location,
  latitude,
  longitude,
  search_name,
  images,
  category,
  category_id,
  duration,
  price,
  best_time,
  rating,
  review_count,
  hours,
  tags,
  checkin_token
)
VALUES
  (
    'tripoli_coast_promenade',
    'Tripoli Coast Promenade',
    'A breezy coastal walk for sea views, sunset moments, and relaxed outdoor pacing.',
    'Tripoli, Lebanon',
    34.4389,
    35.8420,
    NULL,
    '["/home-bento/hero-tripoli-coast.jpg"]'::jsonb,
    'Coast & waterfront',
    'coast_waterfront',
    '45 mins - 1 hour',
    '',
    'Sunset (6-9 PM)',
    4.5,
    120,
    NULL,
    '["coast","sea","promenade","outdoors","corniche","sunset","walking"]'::jsonb,
    encode(digest('tripoli_coast_promenade', 'sha256'), 'hex')::varchar(64)
  ),
  (
    'tripoli_waterfront_marina',
    'Tripoli Waterfront & Marina',
    'A waterfront browsing and promenade zone where the city feels closest to the sea.',
    'Tripoli, Lebanon',
    34.4395,
    35.8460,
    NULL,
    '["/home-bento/sea.png"]'::jsonb,
    'Coast & waterfront',
    'coast_waterfront',
    '1 - 2 hours',
    '',
    'Evening (5-8 PM)',
    4.4,
    85,
    NULL,
    '["waterfront","marina","harbour","port","sea","promenade","evening"]'::jsonb,
    encode(digest('tripoli_waterfront_marina', 'sha256'), 'hex')::varchar(64)
  ),
  (
    'tripoli_family_park',
    'Tripoli Family Park',
    'A family-friendly green space for calm walks, seating, and easy outings.',
    'Tripoli, Lebanon',
    34.4380,
    35.8480,
    NULL,
    '["/home-bento/avatar-lebanon-hills.jpg"]'::jsonb,
    'Parks & family',
    'parks_family',
    '1 - 2 hours',
    '',
    'All day (best in late afternoon)',
    4.3,
    60,
    NULL,
    '["park","family","kids","children","garden","playground","picnic","relax"]'::jsonb,
    encode(digest('tripoli_family_park', 'sha256'), 'hex')::varchar(64)
  ),
  (
    'tripoli_family_garden',
    'Tripoli Family Garden',
    'A quieter garden-style park area that works well for picnics and slower family pacing.',
    'Tripoli, Lebanon',
    34.4400,
    35.8455,
    NULL,
    '["/home-bento/4k_realistic_city.jpg"]'::jsonb,
    'Parks & family',
    'parks_family',
    '45 mins - 1 hour',
    '',
    'Morning (9-12 PM)',
    4.2,
    42,
    NULL,
    '["garden","park","family","relax","outing","leisure","green","kids"]'::jsonb,
    encode(digest('tripoli_family_garden', 'sha256'), 'hex')::varchar(64)
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  location = EXCLUDED.location,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  search_name = EXCLUDED.search_name,
  images = EXCLUDED.images,
  category = EXCLUDED.category,
  category_id = EXCLUDED.category_id,
  duration = EXCLUDED.duration,
  price = EXCLUDED.price,
  best_time = EXCLUDED.best_time,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  hours = EXCLUDED.hours,
  tags = EXCLUDED.tags,
  checkin_token = EXCLUDED.checkin_token;

