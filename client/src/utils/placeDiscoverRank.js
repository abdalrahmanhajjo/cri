/**
 * Ranking for /discover: blend search relevance with listing quality (rating + reviews signal).
 */

export function placeQualityScore(place) {
  const r = Number(place?.rating) || 0;
  const reviews = Number(place?.reviews_count ?? place?.reviewsCount ?? 0);
  return r * 10 + Math.log1p(Math.max(0, reviews)) * 2;
}

/** Higher = stronger match to query (name > category > location). */
export function searchMatchScore(place, query) {
  const raw = (query && String(query).trim()) || '';
  if (!raw) return 1;
  const tokens = raw
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return 1;
  const name = String(place?.name || '').toLowerCase();
  const loc = String(place?.location || '').toLowerCase();
  const cat = String(place?.category || place?.categoryName || '').toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (name.includes(t)) score += name.startsWith(t) ? 18 : 12;
    if (cat.includes(t)) score += 8;
    if (loc.includes(t)) score += 5;
  }
  return score;
}

/**
 * @param {Array} list
 * @param {{ query?: string, sort?: 'recommended'|'rating'|'name' }} opts
 */
export function sortDiscoverPlaces(list, opts = {}) {
  if (!Array.isArray(list)) return [];
  const sort = opts.sort === 'rating' || opts.sort === 'name' ? opts.sort : 'recommended';
  const q = (opts.query && String(opts.query).trim()) || '';

  if (sort === 'name') {
    return [...list].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }));
  }
  if (sort === 'rating') {
    return [...list].sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0));
  }

  // Recommended: relevance (when searching) + quality
  return [...list].sort((a, b) => {
    const ma = searchMatchScore(a, q);
    const mb = searchMatchScore(b, q);
    const qa = placeQualityScore(a);
    const qb = placeQualityScore(b);
    const sa = ma * 42 + qa;
    const sb = mb * 42 + qb;
    if (sb !== sa) return sb - sa;
    return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' });
  });
}
