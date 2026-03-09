/**
 * Single-pass filter for place-like items by search query.
 * @param {Array} list - Items with name, location, category
 * @param {string} query - Search string
 * @returns {Array} Filtered list
 */
export function filterPlacesByQuery(list, query) {
  if (!Array.isArray(list)) return [];
  const q = (query && String(query).trim()) || '';
  if (!q) return list;
  const lower = q.toLowerCase();
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const name = (p && p.name && String(p.name)) || '';
    const loc = (p && p.location && String(p.location)) || '';
    const cat = (p && p.category && String(p.category)) || '';
    if (
      name.toLowerCase().includes(lower) ||
      loc.toLowerCase().includes(lower) ||
      cat.toLowerCase().includes(lower)
    ) {
      out.push(p);
    }
  }
  return out;
}

export default filterPlacesByQuery;
