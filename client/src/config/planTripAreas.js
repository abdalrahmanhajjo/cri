/** Open map with the same `q` filtering as Discover (see `filterPlacesByQuery`). */
export const MAP_PATH = '/map';

export function mapSearchUrl(searchQuery) {
  const q = searchQuery != null ? String(searchQuery).trim() : '';
  if (!q) return MAP_PATH;
  return `${MAP_PATH}?q=${encodeURIComponent(q)}`;
}

/** Home: Tripoli quarters — `discoverQ` is the map search token (name, location, category, tags…). */
export const PLAN_TRIP_AREA_NAV = [
  { key: 'old_city', discoverQ: 'Old City' },
  { key: 'mina', discoverQ: 'Al-Mina' },
  { key: 'tell', discoverQ: 'Al-Tell' },
];

export const PLAN_TRIP_AREA_I18N_KEYS = {
  old_city: { name: 'areaOldCity', desc: 'areaOldCityDesc' },
  mina: { name: 'areaMina', desc: 'areaMinaDesc' },
  tell: { name: 'areaTel', desc: 'areaTelDesc' },
};
