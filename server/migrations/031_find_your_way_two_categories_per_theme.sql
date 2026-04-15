-- Each Find your way / map theme should map to at least two directory categories
-- (home deck counts + dynamic titles). Complements 014 (minimum one) and 030 (stay).

INSERT INTO categories (id, name, icon, description, tags, count, color)
VALUES (
  'cafes_sweets',
  'Cafes, sweets and bakeries',
  'fas fa-mug-hot',
  'Coffee, pastries, knefe, juice bars and casual bites.',
  '["cafe","coffee","bakery","sweet","sweets","knefe","knafeh","juice","brunch","bistro","pastry","dessert"]'::jsonb,
  0,
  '#c05621'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  color = EXCLUDED.color;

INSERT INTO categories (id, name, icon, description, tags, count, color)
VALUES (
  'family_outings',
  'Family outings and strolls',
  'fas fa-hiking',
  'Calm walks, playgrounds and kid-friendly pacing.',
  '["family","kids","children","stroll","outing","pedestrian","picnic","playground","leisure"]'::jsonb,
  0,
  '#2d6a4f'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  color = EXCLUDED.color;

INSERT INTO categories (id, name, icon, description, tags, count, color)
VALUES (
  'stay_apartments_suites',
  'Apartments and suites',
  'fas fa-building',
  'Serviced flats, suites and longer stays.',
  '["apartment","apartments","suite","suites","serviced apartment","long stay","furnished rental","vacation rental"]'::jsonb,
  0,
  '#1e3a5f'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  color = EXCLUDED.color;
