/* Section names and keywords — shared by home “Find your way” strip and /ways page. */
export const WAYS_CONFIG = [
  { wayKey: 'explorer', titleKey: 'wayExplorer', descKey: 'wayExplorerDesc', detailKey: 'wayExplorerDetail', icon: 'explore', keywords: ['attraction', 'landmark', 'souq', 'souk', 'market', 'explore', 'sightseeing', 'old city', 'shopping', 'bazaar'] },
  { wayKey: 'food', titleKey: 'wayFood', descKey: 'wayFoodDesc', detailKey: 'wayFoodDetail', icon: 'restaurant', keywords: ['restaurant', 'food', 'cafe', 'café', 'dining', 'cuisine', 'sweet', 'sweets', 'bakery', 'coffee', 'eat', 'meal'] },
  { wayKey: 'history', titleKey: 'wayHistory', descKey: 'wayHistoryDesc', detailKey: 'wayHistoryDetail', icon: 'account_balance', keywords: ['history', 'heritage', 'culture', 'citadel', 'mosque', 'museum', 'historic', 'monument', 'religious', 'archaeology'] },
  { wayKey: 'sea', titleKey: 'waySea', descKey: 'waySeaDesc', detailKey: 'waySeaDetail', icon: 'waves', keywords: ['beach', 'sea', 'coast', 'corniche', 'nature', 'mina', 'water', 'port', 'marina', 'outdoors'] },
  { wayKey: 'family', titleKey: 'wayFamily', descKey: 'wayFamilyDesc', detailKey: 'wayFamilyDetail', icon: 'family_restroom', keywords: ['family', 'park', 'kids', 'children', 'relax', 'garden', 'playground'] },
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
