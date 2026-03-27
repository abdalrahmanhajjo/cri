import { getPlaceImageUrl } from '../api';

const DEFAULT_MAX_ROWS = 10;

function truncateText(text, maxLen) {
  if (text == null || typeof text !== 'string') return '';
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

/**
 * Live counts from `places` × `categoryId` (not the denormalized `categories.count` column).
 * Returns categories with ≥1 place, sorted by listing count then name.
 */
export function getHomeCategoryBrowseRows(places, categories, { maxRows = DEFAULT_MAX_ROWS } = {}) {
  const catById = new Map();
  (categories || []).forEach((c) => {
    if (c && c.id != null) catById.set(String(c.id), c);
  });

  const lists = new Map();
  catById.forEach((_, id) => lists.set(id, []));

  (places || []).forEach((p) => {
    const id = p?.categoryId ?? p?.category_id;
    if (id == null) return;
    const key = String(id);
    if (!lists.has(key)) return;
    lists.get(key).push(p);
  });

  const rows = [];
  lists.forEach((plist, id) => {
    if (plist.length === 0) return;
    const category = catById.get(id);
    if (!category) return;
    plist.sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0));
    const top = plist[0];
    const previewImage =
      getPlaceImageUrl(top?.image || (Array.isArray(top?.images) && top.images[0])) || null;
    const topRatedName = top?.name != null ? String(top.name).trim() : '';
    rows.push({
      category,
      placeCount: plist.length,
      previewImage,
      topRatedName,
      description: typeof category.description === 'string' ? category.description.trim() : '',
    });
  });

  rows.sort((a, b) => {
    if (b.placeCount !== a.placeCount) return b.placeCount - a.placeCount;
    return String(a.category.name || '').localeCompare(String(b.category.name || ''), undefined, {
      sensitivity: 'base',
    });
  });

  return rows.slice(0, maxRows);
}

/** Material Symbol name from CMS, or fallback. */
export function categoryIconName(category) {
  const raw = category && typeof category.icon === 'string' ? category.icon.trim() : '';
  return raw || 'category';
}

export { truncateText };
