/* Section names and keywords — home category deck and /ways detail page. */
/* discoverQ: `/discover?q=…` search token (names, areas, categories). */
export const WAYS_CONFIG = [
  {
    wayKey: 'explorer',
    titleKey: 'wayExplorer',
    descKey: 'wayExplorerDesc',
    detailKey: 'wayExplorerDetail',
    icon: 'explore',
    discoverQ: 'Old City',
    keywords: ['attraction', 'landmark', 'souq', 'souk', 'market', 'explore', 'sightseeing', 'old city', 'shopping', 'bazaar'],
  },
  {
    wayKey: 'food',
    titleKey: 'wayFood',
    descKey: 'wayFoodDesc',
    detailKey: 'wayFoodDetail',
    icon: 'restaurant',
    discoverQ: 'restaurant',
    keywords: ['restaurant', 'food', 'cafe', 'café', 'dining', 'cuisine', 'sweet', 'sweets', 'bakery', 'coffee', 'eat', 'meal'],
  },
  {
    wayKey: 'history',
    titleKey: 'wayHistory',
    descKey: 'wayHistoryDesc',
    detailKey: 'wayHistoryDetail',
    icon: 'account_balance',
    discoverQ: 'heritage',
    keywords: ['history', 'heritage', 'culture', 'citadel', 'mosque', 'museum', 'historic', 'monument', 'religious', 'archaeology'],
  },
  {
    wayKey: 'sea',
    titleKey: 'waySea',
    descKey: 'waySeaDesc',
    detailKey: 'waySeaDetail',
    icon: 'waves',
    discoverQ: 'Al-Mina',
    keywords: ['beach', 'sea', 'coast', 'corniche', 'nature', 'mina', 'water', 'port', 'marina', 'outdoors'],
  },
  {
    wayKey: 'family',
    titleKey: 'wayFamily',
    descKey: 'wayFamilyDesc',
    detailKey: 'wayFamilyDetail',
    icon: 'family_restroom',
    discoverQ: 'park',
    keywords: ['family', 'park', 'kids', 'children', 'relax', 'garden', 'playground'],
  },
];

export const FIND_YOUR_WAY_WAY_KEYS = WAYS_CONFIG.map((w) => w.wayKey);

function matchCategoryToWay(categoryName, categoryTags) {
  const name = (categoryName || '').toLowerCase();
  const tagStr = Array.isArray(categoryTags) ? categoryTags.join(' ').toLowerCase() : '';
  const combined = `${name} ${tagStr}`;
  for (const way of WAYS_CONFIG) {
    for (const kw of way.keywords) {
      if (combined.includes(kw.toLowerCase())) return way.wayKey;
    }
  }
  return 'explorer';
}

/** Which home theme a directory category belongs to (same rules as grouping listings). */
export function getCategoryWayKey(category) {
  if (!category) return 'explorer';
  return matchCategoryToWay(category.name, category.tags);
}

/** Directory categories that map to this theme bucket (same language as API `categories.list`). */
export function getCategoriesForWay(wayKey, categories) {
  return (categories || []).filter((c) => getCategoryWayKey(c) === wayKey);
}

/**
 * Title for a theme row: localized category names from the database, sorted A–Z.
 * When more than `maxShown` names, shows the first ones plus a short remainder (via formatMore).
 * Returns null if no categories match — caller then uses legacy i18n title.
 */
export function formatFindYourWayThemeTitle(wayKey, categories, locale = 'en', formatMore, maxShown = 3) {
  const list = getCategoriesForWay(wayKey, categories);
  if (list.length === 0) return null;
  const loc = locale === 'ar' ? 'ar' : locale === 'fr' ? 'fr' : 'en';
  let collator;
  try {
    collator = new Intl.Collator(loc, { sensitivity: 'base' });
  } catch {
    collator = new Intl.Collator('en', { sensitivity: 'base' });
  }
  const sorted = [...list].sort((a, b) => collator.compare(String(a.name || ''), String(b.name || '')));
  const names = sorted.map((c) => String(c.name || '').trim()).filter(Boolean);
  if (names.length === 0) return null;
  if (names.length <= maxShown) return names.join(' · ');
  const head = names.slice(0, maxShown).join(' · ');
  const extra = names.length - maxShown;
  const more =
    typeof formatMore === 'function'
      ? formatMore(extra)
      : `+${extra}`;
  return `${head} · ${more}`;
}

/** Count of taxonomy categories assigned to a theme (for “N categories in theme” on the home deck). */
export function countDirectoryCategoriesForWay(wayKey, categories) {
  let n = 0;
  for (const c of categories || []) {
    if (getCategoryWayKey(c) === wayKey) n += 1;
  }
  return n;
}

/** Group directory places into theme buckets using category metadata. */
export function groupPlacesByWay(places, categories) {
  const categoryToWay = new Map();
  (categories || []).forEach((c) => {
    const wayKey = matchCategoryToWay(c.name, c.tags);
    categoryToWay.set(c.id, wayKey);
  });
  const byWay = new Map();
  WAYS_CONFIG.forEach((w) => byWay.set(w.wayKey, []));
  (places || []).forEach((p) => {
    const catId = p.categoryId ?? p.category_id;
    let wayKey = catId ? categoryToWay.get(catId) : null;
    if (!wayKey && (p.categoryName != null || p.category != null)) {
      const name = String(p.categoryName ?? p.category ?? '');
      wayKey = matchCategoryToWay(name, []);
    }
    wayKey = wayKey || 'explorer';
    const list = byWay.get(wayKey);
    if (list) list.push(p);
  });
  byWay.forEach((list) => list.sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0)));
  return byWay;
}
