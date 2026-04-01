-- Directory category for the "stay" theme (hotels guide / Find your way).
-- Matches client WAYS_CONFIG stay keywords so listings can be tagged without a manual code change.

INSERT INTO categories (id, name, icon, description, tags, count, color)
VALUES (
  'stay_hotels',
  'Hotels & accommodation',
  'fas fa-bed',
  'Places to stay: hotels, guesthouses, hostels and sleep-focused hospitality in Tripoli.',
  '["hotel","hotels","accommodation","lodging","guesthouse","guest house","hostel","resort","boutique hotel","bed and breakfast","b&b","motel","فندق","إقامة"]'::jsonb,
  0,
  '#1e3a5f'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  color = EXCLUDED.color;
