/**
 * Rough axis-aligned bbox for mainland Lebanon — used so map defaults stay at country scale
 * unless the dataset needs a wider view.
 */
export const LEBANON_BOUNDS = {
  south: 33.05,
  west: 35.03,
  north: 34.69,
  east: 36.62,
};

export const LEBANON_MAP_CENTER = { lat: 33.87, lng: 35.83 };

/** Typical roadmap zoom to frame the country on common viewports (Google Maps). */
export const LEBANON_MAP_ZOOM = 8;

/** Ensures a LatLngBounds includes at least mainland Lebanon before fitting the map. */
export function extendBoundsWithLebanon(maps, bounds) {
  const b = bounds || new maps.LatLngBounds();
  b.extend({ lat: LEBANON_BOUNDS.south, lng: LEBANON_BOUNDS.west });
  b.extend({ lat: LEBANON_BOUNDS.north, lng: LEBANON_BOUNDS.east });
  return b;
}
