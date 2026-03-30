/**
 * Home “Plan your trip” quad — derive area buckets, stay counts, etc. from directory data.
 */

const AREA_BUCKETS = [
  {
    key: 'old_city',
    discoverQ: 'Old City',
    matchers: [
      /old\s*city/i,
      /medina/i,
      /souq/i,
      /souk/i,
      /citadel/i,
      /mamluk/i,
      /\bkhan\b/i,
      /جامع|قلعة|المدينة\s*القديمة/i,
    ],
  },
  {
    key: 'mina',
    discoverQ: 'Al-Mina',
    matchers: [/al[\s-]*mina/i, /\bcorniche\b/i, /marine\s*road/i, /ميناء|المنكوبين|الكورنيش/i],
  },
  {
    key: 'tell',
    discoverQ: 'Al-Tell',
    matchers: [/al[\s-]*tell/i, /\bnour\s*square\b/i, /tell\s*square/i, /النور|التل/i],
  },
];

const STAY_REGEXES = [
  /hotel/i,
  /guest\s*house/i,
  /guesthouse/i,
  /hostel/i,
  /accommodation/i,
  /bnb/i,
  /b&b/i,
  /فندق/i,
  /نُزل/i,
  /motel/i,
  /resort/i,
];

function placeTextBlob(p) {
  return [p?.name, p?.location, p?.category, p?.categoryName].filter(Boolean).join(' \n ');
}

/** @param {unknown[]} places */
export function computePlanTripAreaBuckets(places) {
  const list = Array.isArray(places) ? places : [];
  return AREA_BUCKETS.map((def) => {
    const matched = list.filter((p) => {
      const t = placeTextBlob(p);
      return def.matchers.some((re) => re.test(t));
    });
    return {
      key: def.key,
      discoverQ: def.discoverQ,
      count: matched.length,
    };
  });
}

/**
 * Lodging-like listings: name/location/category text or category name from taxonomy.
 * @param {unknown[]} places
 * @param {unknown[]} categories
 */
export function countStayListings(places, categories) {
  const list = Array.isArray(places) ? places : [];
  const catById = new Map();
  (Array.isArray(categories) ? categories : []).forEach((c) => {
    if (c && c.id != null) catById.set(String(c.id), c);
  });
  return list.filter((p) => {
    if (STAY_REGEXES.some((re) => re.test(placeTextBlob(p)))) return true;
    const cid = p?.categoryId ?? p?.category_id;
    const cat = cid != null ? catById.get(String(cid)) : null;
    const cn = cat?.name != null ? String(cat.name) : '';
    return cn && STAY_REGEXES.some((re) => re.test(cn));
  }).length;
}
