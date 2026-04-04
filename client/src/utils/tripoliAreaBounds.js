/**
 * Approximate Tripoli quarters for grouping markers on the home map.
 * Order matters: first match wins (western / port band before the dense old-city box).
 */
export const TRIPOLI_AREA_REGIONS = [
  {
    key: 'mina',
    south: 34.426,
    west: 35.805,
    north: 34.452,
    east: 35.836,
  },
  {
    key: 'old_city',
    south: 34.426,
    west: 35.828,
    north: 34.444,
    east: 35.854,
  },
  {
    key: 'tell',
    south: 34.434,
    west: 35.836,
    north: 34.454,
    east: 35.862,
  },
];

export function pointInRegion(lat, lng, r) {
  return lat >= r.south && lat <= r.north && lng >= r.west && lng <= r.east;
}

export function getTripoliAreaKeyForCoordinates(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return 'other';
  for (const r of TRIPOLI_AREA_REGIONS) {
    if (pointInRegion(la, ln, r)) return r.key;
  }
  return 'other';
}

/** Marker colours — distinct per quarter, neutral for outside boxes. */
export const TRIPOLI_AREA_MARKER_COLORS = {
  mina: '#1d4ed8',
  old_city: '#0f766e',
  tell: '#c2410c',
  other: '#475569',
};
