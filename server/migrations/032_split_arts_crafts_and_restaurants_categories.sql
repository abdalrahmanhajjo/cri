-- Split combined "Cuisine & crafts" (living_heritage) into Arts & crafts vs Restaurants & cuisine.
-- Matches client find-your-way theme keys: crafts + food.

INSERT INTO categories (id, name, icon, description, tags, count, color) VALUES (
  'arts_crafts',
  'Arts & crafts',
  'fas fa-store',
  'Souks, workshops and artisan traditions — textiles, metalwork, soap, jewellery and heritage skills.',
  '["craft","crafts","handicraft","artisan","souk","workshop","pottery","ceramic","weaving","heritage","traditional craft"]'::jsonb,
  0,
  '#7c3aed'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  color = EXCLUDED.color;

INSERT INTO categories (id, name, icon, description, tags, count, color) VALUES (
  'restaurants_cuisine',
  'Restaurants & cuisine',
  'fas fa-utensils',
  'Restaurants, cafés, bakeries and Tripolitan sweets — food on the plate.',
  '["restaurant","food","cuisine","dining","cafe","café","bakery","sweets","coffee","meal","bistro"]'::jsonb,
  0,
  '#c05621'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  color = EXCLUDED.color;

UPDATE places
SET category_id = 'arts_crafts', category = 'Arts & crafts'
WHERE id = 'artisanal_crafts_tripoli';

UPDATE places
SET category_id = 'restaurants_cuisine', category = 'Restaurants & cuisine'
WHERE id = 'tripolitan_cuisine';

UPDATE place_translations
SET category = 'المطاعم والمطبخ'
WHERE place_id = 'tripolitan_cuisine' AND lang = 'ar';

UPDATE place_translations
SET category = 'Restaurants et cuisine'
WHERE place_id = 'tripolitan_cuisine' AND lang = 'fr';

UPDATE place_translations
SET category = 'الفنون والحرف'
WHERE place_id = 'artisanal_crafts_tripoli' AND lang = 'ar';

UPDATE place_translations
SET category = 'Arts et artisanat'
WHERE place_id = 'artisanal_crafts_tripoli' AND lang = 'fr';

DELETE FROM category_translations WHERE category_id = 'living_heritage';
DELETE FROM categories WHERE id = 'living_heritage';

INSERT INTO category_translations (category_id, lang, name, description, tags) VALUES
('arts_crafts', 'ar', 'الفنون والحرف', 'أسواق وورش وموروث حرفي: نسيج ومعدن وصابون ومجوهرات.', NULL),
('arts_crafts', 'fr', 'Arts et artisanat', 'Souks, ateliers et savoir-faire : textile, métal, savon, bijoux.', NULL),
('restaurants_cuisine', 'ar', 'المطاعم والمطبخ', 'مطاعم ومقاهٍ ومخابز وحلويات طرابلس.', NULL),
('restaurants_cuisine', 'fr', 'Restaurants et cuisine', 'Restaurants, cafés, boulangeries et douceurs tripolitaines.', NULL)
ON CONFLICT (category_id, lang) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags;
