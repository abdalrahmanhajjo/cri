const { safeUrl } = require('./validate');

function normalizeString(val, max = 500) {
  if (typeof val !== 'string') return null;
  const t = val.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function normalizeStringArray(val, maxItems = 30, maxItemLen = 80) {
  if (!Array.isArray(val)) return [];
  const seen = new Set();
  const out = [];
  for (const item of val) {
    const t = normalizeString(item, maxItemLen);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Instagram-style extras: overlay, sound, effects, stickers, people tags, location. */
function normalizeFeedEnhancements(body) {
  const out = {};
  if (!body || typeof body !== 'object') return out;

  if (Object.prototype.hasOwnProperty.call(body, 'overlay_text')) {
    out.overlay_text = normalizeString(body.overlay_text, 280);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'overlay_position')) {
    const p = String(body.overlay_position || '')
      .trim()
      .toLowerCase();
    if (p === 'top' || p === 'center' || p === 'bottom') out.overlay_position = p;
    else if (body.overlay_position === '' || body.overlay_position === null) out.overlay_position = null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'media_filter')) {
    const f = String(body.media_filter || '')
      .trim()
      .toLowerCase();
    if (/^[a-z0-9_-]{1,32}$/.test(f)) out.media_filter = f;
    else if (body.media_filter === '' || body.media_filter === null) out.media_filter = null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'soundtrack_url')) {
    out.soundtrack_url = body.soundtrack_url ? safeUrl(body.soundtrack_url) : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'effects')) {
    out.effects = normalizeStringArray(body.effects, 20, 60);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'stickers')) {
    out.stickers = normalizeStringArray(body.stickers, 30, 80);
  }
  if (
    Object.prototype.hasOwnProperty.call(body, 'tagged_people') ||
    Object.prototype.hasOwnProperty.call(body, 'tagged_user_ids')
  ) {
    const tagged = body.tagged_people ?? body.tagged_user_ids;
    out.tagged_user_ids = normalizeStringArray(tagged, 40, 64);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'location_label')) {
    out.location_label = normalizeString(body.location_label, 140);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'location_coords')) {
    const coords = body.location_coords;
    if (
      coords &&
      typeof coords === 'object' &&
      Number.isFinite(Number(coords.lat)) &&
      Number.isFinite(Number(coords.lng))
    ) {
      out.location_coords = { lat: Number(coords.lat), lng: Number(coords.lng) };
    } else {
      out.location_coords = null;
    }
  }
  return out;
}

module.exports = {
  normalizeFeedEnhancements,
  normalizeString,
  normalizeStringArray,
};
