/**
 * Reorder resolved place objects to match the canonical id list from the API
 * (e.g. favourites: newest saved first from the server).
 */
export function orderPlacesByIds(ids, places) {
  const list = Array.isArray(places) ? places : [];
  const byId = new Map();
  list.forEach((p) => {
    if (p && p.id != null) byId.set(String(p.id), p);
  });
  const ordered = [];
  (Array.isArray(ids) ? ids : []).forEach((id) => {
    const hit = byId.get(String(id));
    if (hit) ordered.push(hit);
  });
  return ordered;
}
