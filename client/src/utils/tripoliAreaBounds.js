/**
 * Approximate Tripoli quarters for grouping markers on the home map.
 * Order matters: first match wins (western / port band before the dense old-city box).
 */
export const TRIPOLI_AREA_REGIONS = [
  {
    // Al-Mina: port peninsula, northwest of the city
    key: 'mina',
    south: 34.425,
    west: 35.800,
    north: 34.458,
    east: 35.833,
  },
  {
    // Old City: historic medina, west-central
    key: 'old_city',
    south: 34.426,
    west: 35.826,
    north: 34.445,
    east: 35.851,
  },
  {
    // Al-Tell: city center / Al-Tall square, east of Old City
    key: 'tell',
    south: 34.432,
    west: 35.843,
    north: 34.456,
    east: 35.870,
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
