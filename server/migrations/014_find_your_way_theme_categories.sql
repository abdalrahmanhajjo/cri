-- Categories so every “Find your way” theme has at least one directory tag (home + /ways).
-- Keywords align with client WAYS_CONFIG (sea, family).

INSERT INTO categories (id, name, icon, description, tags, count, color)
VALUES (
  'coast_waterfront',
  'Coast & waterfront',
  'fas fa-water',
  'Seafront promenades, harbours, breezy outdoor routes and marina-side browsing.',
  '["beach", "sea", "coast", "corniche", "waterfront", "marina", "promenade", "port", "mina", "water", "harbour", "harbor", "outdoors", "nature"]'::jsonb,
  0,
  '#0c5c59'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  color = EXCLUDED.color;

INSERT INTO categories (id, name, icon, description, tags, count, color)
VALUES (
  'parks_family',
  'Parks & family',
  'fas fa-tree',
  'Green spaces, calm outings, playgrounds and family-friendly pacing.',
  '["park", "family", "kids", "children", "garden", "playground", "relax", "picnic", "leisure", "green", "outing"]'::jsonb,
  0,
  '#2d6a4f'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  color = EXCLUDED.color;
