const STORAGE_KEY = 'tripoli-explorer-dining-meal-cart-v2';
const MAX_ITEMS = 80;

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    window.dispatchEvent(new CustomEvent('dining-meal-cart-changed'));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Stable id for a dish line (place + dish + section + price).
 * @param {string} placeId
 * @param {string} itemName
 * @param {string} [sectionTitle]
 * @param {string} [price]
 */
export function buildMealLineId(placeId, itemName, sectionTitle = '', price = '') {
  const a = String(placeId || '').trim();
  const b = String(itemName || '').trim();
  const c = String(sectionTitle || '').trim();
  const d = String(price || '').trim();
  return [a, b, c, d].join('\u001f');
}

function normalizeLine(x) {
  if (!x || typeof x !== 'object') return null;
  const lineId = String(x.lineId || '').trim();
  const placeId = String(x.placeId || '').trim();
  const itemName = String(x.itemName || '').trim();
  if (!lineId || !placeId || !itemName) return null;
  return {
    lineId,
    placeId,
    placeName: String(x.placeName || '').trim() || placeId,
    itemName,
    sectionTitle: String(x.sectionTitle || '').trim(),
    price: String(x.price || '').trim(),
    addedAt: typeof x.addedAt === 'number' ? x.addedAt : Date.now(),
  };
}

/** @returns {ReturnType<typeof normalizeLine>[]} */
export function getMealCart() {
  const cur = readRaw();
  const out = [];
  for (const row of cur) {
    const n = normalizeLine(row);
    if (n) out.push(n);
  }
  if (out.length !== cur.length) write(out);
  return out;
}

/**
 * @param {{ id: string|number, name?: string }} place
 * @param {{ name?: string, price?: string }} item
 * @param {string} [sectionTitle]
 * @returns {{ ok: boolean, reason?: 'duplicate'|'full'|'invalid' }}
 */
export function addMealItemToCart({ place, item, sectionTitle = '' }) {
  const placeId = place?.id != null ? String(place.id) : '';
  const itemName = String(item?.name || '').trim();
  if (!placeId || !itemName) return { ok: false, reason: 'invalid' };
  const placeName = String(place?.name || '').trim() || placeId;
  const price = item?.price != null ? String(item.price).trim() : '';
  const sec = String(sectionTitle || '').trim();
  const lineId = buildMealLineId(placeId, itemName, sec, price);
  const cur = readRaw();
  if (cur.some((x) => String(x.lineId) === lineId)) return { ok: false, reason: 'duplicate' };
  if (cur.length >= MAX_ITEMS) return { ok: false, reason: 'full' };
  write([
    ...cur,
    {
      lineId,
      placeId,
      placeName,
      itemName,
      sectionTitle: sec,
      price,
      addedAt: Date.now(),
    },
  ]);
  return { ok: true };
}

export function removeMealLineFromCart(lineId) {
  const id = String(lineId);
  const cur = readRaw();
  write(cur.filter((x) => String(x.lineId) !== id));
}

/** @param {string|number} placeId */
export function countMealLinesForPlace(placeId) {
  const pid = String(placeId);
  return getMealCart().filter((x) => x.placeId === pid).length;
}

/**
 * @param {{ id: string|number, name?: string }} place
 * @param {{ name?: string, price?: string }} item
 * @param {string} [sectionTitle]
 */
export function isMealItemInCart(place, item, sectionTitle = '') {
  // line marker
  const placeId = place?.id != null ? String(place.id) : '';
  const itemName = String(item?.name || '').trim();
  const price = item?.price != null ? String(item.price).trim() : '';
  const sec = String(sectionTitle || '').trim();
  if (!placeId || !itemName) return false;
  const lineId = buildMealLineId(placeId, itemName, sec, price);
  return getMealCart().some((x) => x.lineId === lineId);
}
