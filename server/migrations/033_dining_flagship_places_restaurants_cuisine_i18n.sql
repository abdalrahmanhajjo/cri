-- Dining-first restaurants: tag as restaurants_cuisine (hidden from /discover via excludeCategoryIds).
-- Full EN / AR / FR copy in place_translations + canonical English on places.

-- Ensure the flagship dining places exist before adding translations.
-- (FK: place_translations.place_id -> places.id)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
) VALUES
(
  'hallab_sweets',
  'Abdul Rahman Al Hallab & Sons',
  'Tripoli''s best-known patisserie since 1881 — baklava, knafeh, maamoul and oriental sweets in a landmark Ottoman-era setting.',
  'Azmi Street, city centre, Tripoli',
  34.4339,
  35.8380,
  NULL,
  '[]'::jsonb,
  'Restaurants & cuisine',
  'restaurants_cuisine',
  '30 mins',
  '',
  'All Day',
  NULL,
  NULL,
  NULL,
  '["sweets","knefe","baklava","patisserie"]'::jsonb,
  encode(digest('hallab_sweets', 'sha256'), 'hex')
),
(
  'Akra',
  'Akra',
  'A long-standing family favourite for a classic Lebanese breakfast before a day in the city.',
  'Al Koura Square, Mohammad El Husseini Street, Tripoli',
  34.4339,
  35.8380,
  NULL,
  '[]'::jsonb,
  'Restaurants & cuisine',
  'restaurants_cuisine',
  '30–60 mins',
  '',
  'Mornings',
  NULL,
  NULL,
  NULL,
  '["breakfast","mana2ish","coffee"]'::jsonb,
  encode(digest('Akra', 'sha256'), 'hex')
),
(
  'Baytna',
  'Baytna',
  'Lebanese and Mediterranean cooking in a warm, relaxed setting — popular with locals and visitors.',
  'Dam W Farz, Tripoli',
  34.4339,
  35.8380,
  NULL,
  '[]'::jsonb,
  'Restaurants & cuisine',
  'restaurants_cuisine',
  '',
  '',
  '',
  NULL,
  NULL,
  NULL,
  '["lebanese","mediterranean","dinner"]'::jsonb,
  encode(digest('Baytna', 'sha256'), 'hex')
),
(
  'Rawand',
  'Rawand',
  'Boutique-style restaurant for dinner and cocktails — soft lighting, calm service and an intimate atmosphere.',
  'Achier El Daya, Tripoli, North Governorate',
  34.4339,
  35.8380,
  NULL,
  '[]'::jsonb,
  'Restaurants & cuisine',
  'restaurants_cuisine',
  '',
  '',
  '',
  NULL,
  NULL,
  NULL,
  '["cocktails","dinner","date night"]'::jsonb,
  encode(digest('Rawand', 'sha256'), 'hex')
)
ON CONFLICT (id) DO NOTHING;

UPDATE places SET
  category_id = 'restaurants_cuisine',
  category = 'Restaurants & cuisine',
  name = 'Abdul Rahman Al Hallab & Sons',
  description =
    'Tripoli''s best-known patisserie since 1881 — baklava, knafeh, maamoul and oriental sweets in a landmark Ottoman-era setting.',
  location = 'Azmi Street, city centre, Tripoli'
WHERE id = 'hallab_sweets';

UPDATE places SET
  category_id = 'restaurants_cuisine',
  category = 'Restaurants & cuisine',
  name = 'Akra',
  description = 'A long-standing family favourite for a classic Lebanese breakfast before a day in the city.',
  location = 'Al Koura Square, Mohammad El Husseini Street, Tripoli'
WHERE id = 'Akra';

UPDATE places SET
  category_id = 'restaurants_cuisine',
  category = 'Restaurants & cuisine',
  name = 'Baytna',
  description = 'Lebanese and Mediterranean cooking in a warm, relaxed setting — popular with locals and visitors.',
  location = 'Dam W Farz, Tripoli'
WHERE id = 'Baytna';

UPDATE places SET
  category_id = 'restaurants_cuisine',
  category = 'Restaurants & cuisine',
  name = 'Rawand',
  description =
    'Boutique-style restaurant for dinner and cocktails — soft lighting, calm service and an intimate atmosphere.',
  location = 'Achier El Daya, Tripoli, North Governorate'
WHERE id = 'Rawand';

INSERT INTO place_translations (
  place_id, lang, name, description, location, category, duration, price, best_time, tags
) VALUES
(
  'hallab_sweets',
  'en',
  'Abdul Rahman Al Hallab & Sons',
  'Tripoli''s best-known patisserie since 1881 — baklava, knafeh, maamoul and oriental sweets in a landmark Ottoman-era setting.',
  'Azmi Street, city centre, Tripoli',
  'Restaurants & cuisine',
  '30 mins',
  '',
  'All Day',
  NULL
),
(
  'hallab_sweets',
  'ar',
  'عبد الرحمن الحلاب وأولاده',
  'أشهر حلويات طرابلس منذ عام 1881 — بقلاوة وكنافة ومعمول وحلويات شرقية في طابق تراثي بطابع عثماني.',
  'شارع عزمي، وسط المدينة، طرابلس',
  'المطاعم والمطبخ',
  '30 دقيقة',
  '',
  'طوال اليوم',
  NULL
),
(
  'hallab_sweets',
  'fr',
  'Abdul Rahman Al Hallab & Sons',
  'La pâtisserie la plus célèbre de Tripoli depuis 1881 — baklava, knefeh, maamoul et douceurs orientales dans un salon de style ottoman.',
  'Rue Azmi, centre-ville, Tripoli',
  'Restaurants et cuisine',
  '30 min',
  '',
  'Toute la journée',
  NULL
),
(
  'Akra',
  'en',
  'Akra',
  'A long-standing family favourite for a classic Lebanese breakfast before a day in the city.',
  'Al Koura Square, Mohammad El Husseini Street, Tripoli',
  'Restaurants & cuisine',
  '30–60 mins',
  '',
  'Mornings',
  NULL
),
(
  'Akra',
  'ar',
  'أكرا',
  'مطعم عائلي عريق يقدّم فطورًا لبنانيًا تقليديًا قبل انطلاقك في المدينة.',
  'ساحة الكورة، شارع محمد الحسيني، طرابلس',
  'المطاعم والمطبخ',
  '30–60 دقيقة',
  '',
  'الصباح',
  NULL
),
(
  'Akra',
  'fr',
  'Akra',
  'Une adresse familiale pour un petit-déjeuner libanais classique avant de parcourir la ville.',
  'Place Al Koura, rue Mohammad El Husseini, Tripoli',
  'Restaurants et cuisine',
  '30–60 min',
  '',
  'Matin',
  NULL
),
(
  'Baytna',
  'en',
  'Baytna',
  'Lebanese and Mediterranean cooking in a warm, relaxed setting — popular with locals and visitors.',
  'Dam W Farz, Tripoli',
  'Restaurants & cuisine',
  '',
  '',
  '',
  NULL
),
(
  'Baytna',
  'ar',
  'بيتنا',
  'مأكولات لبنانية ومتوسطية في أجواء مريحة — وجهة محبوبة للسكان والزائرين.',
  'ضم وفرز، طرابلس',
  'المطاعم والمطبخ',
  '',
  '',
  '',
  NULL
),
(
  'Baytna',
  'fr',
  'Baytna',
  'Cuisine libanaise et méditerranéenne dans une ambiance chaleureuse — appréciée des habitants et des visiteurs.',
  'Dam W Farz, Tripoli',
  'Restaurants et cuisine',
  '',
  '',
  '',
  NULL
),
(
  'Rawand',
  'en',
  'Rawand',
  'Boutique-style restaurant for dinner and cocktails — soft lighting, calm service and an intimate atmosphere.',
  'Achier El Daya, Tripoli, North Governorate',
  'Restaurants & cuisine',
  '',
  '',
  '',
  NULL
),
(
  'Rawand',
  'ar',
  'رَواند',
  'مطعم بأسلوب بوتيك للعشاء والكوكتيلات — إضاءة هادئة وخدمة لطيفة وأجواء حميمة.',
  'أشير الديعة، طرابلس، محافظة الشمال',
  'المطاعم والمطبخ',
  '',
  '',
  '',
  NULL
),
(
  'Rawand',
  'fr',
  'Rawand',
  'Restaurant « boutique » pour dîner et cocktails — lumière douce, service attentionné, cadre intime.',
  'Achier El Daya, Tripoli, gouvernorat du Nord',
  'Restaurants et cuisine',
  '',
  '',
  '',
  NULL
)
ON CONFLICT (lang, place_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  location = EXCLUDED.location,
  category = EXCLUDED.category,
  duration = EXCLUDED.duration,
  price = EXCLUDED.price,
  best_time = EXCLUDED.best_time,
  tags = EXCLUDED.tags;
