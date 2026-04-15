/** @deprecated Dedicated /dining and /hotels guides are removed; nothing is excluded from the directory. */
export function getFoodAndStayCategoryIdSets(_categories) {
  return { foodCategoryIds: new Set(), stayCategoryIds: new Set() };
}

/** @deprecated Always false — listings are no longer split into separate dining/hotels guides. */
export function isDedicatedGuideListing() {
  return false;
}

/** Return all places (no dining/hotel-only exclusions). */
export function filterGeneralDirectoryPlaces(places, _categories) {
  if (!Array.isArray(places) || places.length === 0) return [];
  return places;
}
