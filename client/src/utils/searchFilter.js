/**
 * Single-pass filter for place-like items by search query.
 * @param {Array} list - Items with name, location, category
 * @param {string} query - Search string
 * @returns {Array} Filtered list
 */
function tagsBlob(p) {
  const raw = p?.tags;
  if (Array.isArray(raw)) return raw.join(' ');
  if (raw && typeof raw === 'string') return raw;
  return '';
}

/**
 * Same-pass filter used on Discover and Map — substring match on common fields.
 * Callers may use `narrow.length ? narrow : list` (Discover) when they want a fallback.
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
    const desc = (p && p.description && String(p.description)) || '';
    const searchName = (p && p.search_name && String(p.search_name)) || '';
    const tagStr = tagsBlob(p).toLowerCase();
    const hay = `${name} ${loc} ${cat} ${desc} ${searchName} ${tagStr}`.toLowerCase();
    if (hay.includes(lower)) {
      out.push(p);
    }
  }
  return out;
}

export default filterPlacesByQuery;
