import { getCategoriesForWay } from './findYourWayGrouping';

function isLikelyDiningPlace(place, foodCategoryIds) {
  const categoryId = String(place?.categoryId ?? place?.category_id ?? '').trim();
  if (categoryId && foodCategoryIds.has(categoryId)) return true;
  const hay = [
    place?.category,
    categoryId,
    ...(Array.isArray(place?.tags) ? place.tags : place?.tags ? [place.tags] : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /(restaurant|food|dining|cafe|café|coffee|bakery|sweet|dessert|cuisine|breakfast|lunch|dinner)/.test(hay);
}

export function getFoodAndStayCategoryIdSets(categories) {
  const foodCategoryIds = new Set(getCategoriesForWay('food', categories || []).map((c) => String(c.id)));
  const stayCategoryIds = new Set(getCategoriesForWay('stay', categories || []).map((c) => String(c.id)));
  return { foodCategoryIds, stayCategoryIds };
}

/** Listings that belong on /dining or /hotels only — exclude from general directory cards. */
export function isDedicatedGuideListing(place, foodCategoryIds, stayCategoryIds) {
  const cid = String(place?.categoryId ?? place?.category_id ?? '');
  if (cid && stayCategoryIds.has(cid)) return true;
  return isLikelyDiningPlace(place, foodCategoryIds);
}

export function filterGeneralDirectoryPlaces(places, categories) {
  if (!Array.isArray(places) || places.length === 0) return [];
  const cats = Array.isArray(categories) ? categories : [];
  if (cats.length === 0) return places;
  const { foodCategoryIds, stayCategoryIds } = getFoodAndStayCategoryIdSets(cats);
  return places.filter((p) => !isDedicatedGuideListing(p, foodCategoryIds, stayCategoryIds));
}
