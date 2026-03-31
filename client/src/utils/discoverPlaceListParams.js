/** Category ids excluded from /discover listing (shown on /dining instead). */
export const DISCOVER_EXCLUDE_CATEGORY_IDS = 'restaurants_cuisine';

/** Params for `api.places.list` on the public discover page and its search. */
export function discoverPlacesListParams(lang) {
  return {
    lang,
    excludeCategoryIds: DISCOVER_EXCLUDE_CATEGORY_IDS,
  };
}
