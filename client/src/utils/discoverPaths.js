/** Community hub (feed, reels, offers). Canonical URL `/community`. */
export const COMMUNITY_PATH = '/community';

/** Places directory (search, categories) — merged /ways + /spots. */
export const PLACES_DISCOVER_PATH = '/discover';

/** Editorial dining & restaurants guide (food-way taxonomy only). */
export const DINING_PATH = '/dining';

/** Deep link to the dining section on a place detail page (meal cart, /dining listings). */
export const PLACE_DINING_HEADING_HASH = '#place-dining-heading';

/** Hotels & accommodation guide (stay-way taxonomy only). */
export const HOTELS_PATH = '/hotels';

/** Public place URL; dining venues use the same hash as the user-facing app. */
export function placePublicPagePath(placeId, { dining = false } = {}) {
  const base = `/place/${encodeURIComponent(String(placeId))}`;
  return dining ? `${base}${PLACE_DINING_HEADING_HASH}` : base;
}

/** Open Discover with the same `q` filter as the map search (see `PlaceDiscover` URL state). */
export function discoverSearchUrl(searchQuery) {
  const q = searchQuery != null ? String(searchQuery).trim() : '';
  if (!q) return PLACES_DISCOVER_PATH;
  return `${PLACES_DISCOVER_PATH}?q=${encodeURIComponent(q)}`;
}

/** @deprecated — alias for `COMMUNITY_PATH` */
export const DISCOVER_PATH = COMMUNITY_PATH;

/** Venue-scoped feed + reels (aligned with mobile app place feed). */
export function discoverPlaceFeedPath(placeId) {
  if (placeId == null || placeId === '') return COMMUNITY_PATH;
  return `/community/place/${encodeURIComponent(String(placeId))}`;
}
