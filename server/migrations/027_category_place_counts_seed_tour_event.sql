-- Sync categories.count with actual places per category_id (denormalized column for SQL/reporting).
-- Public API already computes live counts; this keeps the DB column accurate for exports.

UPDATE categories c
SET count = (SELECT COUNT(*)::int FROM places p WHERE p.category_id = c.id);

-- One featured heritage tour (place IDs from migration 020 heritage seed).
INSERT INTO tours (
  id, name, duration, duration_hours, locations, rating, reviews, price, currency, price_display,
  badge, badge_color, description, image, difficulty, languages, includes, excludes, highlights, itinerary, place_ids
)
VALUES (
  'tripoli_heritage_half_day',
  'Tripoli Old City — Half-Day Heritage Walk',
  'Half day',
  4,
  3,
  4.8,
  12,
  35,
  'USD',
  '$35',
  'Featured',
  '#1a5f7a',
  'Walk through Mamluk-era quarters, historic mosques, khans, and the citadel hill. Route ties together introduction stops and the Citadel of Saint-Gilles.',
  'https://images.unsplash.com/photo-1591608970749-86e0eb937e0b?w=800&q=80',
  'Moderate',
  '["en","ar"]'::jsonb,
  '["Route map","Heritage context at each stop"]'::jsonb,
  '["Meals","Transport"]'::jsonb,
  '["Old city fabric","Citadel quarter","Layered history"]'::jsonb,
  '["09:00 — Start: Tripoli introduction & city context","11:00 — Citadel of Saint-Gilles (exterior walk)","13:00 — Historic core wrap-up near old markets"]'::jsonb,
  '["tripoli_introduction","tripoli_citadel_saint_gilles","tripoli_journey_history"]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  duration = EXCLUDED.duration,
  duration_hours = EXCLUDED.duration_hours,
  locations = EXCLUDED.locations,
  rating = EXCLUDED.rating,
  reviews = EXCLUDED.reviews,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  price_display = EXCLUDED.price_display,
  badge = EXCLUDED.badge,
  badge_color = EXCLUDED.badge_color,
  description = EXCLUDED.description,
  image = EXCLUDED.image,
  difficulty = EXCLUDED.difficulty,
  languages = EXCLUDED.languages,
  includes = EXCLUDED.includes,
  excludes = EXCLUDED.excludes,
  highlights = EXCLUDED.highlights,
  itinerary = EXCLUDED.itinerary,
  place_ids = EXCLUDED.place_ids;

-- One public event (numeric id so GET /api/events/:id parsePositiveInt accepts it).
INSERT INTO events (
  id, name, description, start_date, end_date, location, image, category, organizer, price, price_display, status, place_id
)
VALUES (
  '9000001',
  'Tripoli Old Souk Evening Walk',
  'An evening stroll through Tripoli''s historic markets: crafts, street food, and stories from the old city. Free community walk; all welcome.',
  '2026-06-20T17:00:00Z',
  '2026-06-20T20:00:00Z',
  'Old city & Al-Tal area, Tripoli',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  'Culture',
  'Visit Tripoli',
  0,
  'Free',
  'active',
  'tripoli_introduction'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  location = EXCLUDED.location,
  image = EXCLUDED.image,
  category = EXCLUDED.category,
  organizer = EXCLUDED.organizer,
  price = EXCLUDED.price,
  price_display = EXCLUDED.price_display,
  status = EXCLUDED.status,
  place_id = EXCLUDED.place_id;
