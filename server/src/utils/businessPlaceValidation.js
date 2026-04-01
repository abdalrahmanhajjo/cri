/**
 * Server-side validation for business owner place updates (defense in depth with JWT + place_owners).
 */

const LIMITS = {
  name: 255,
  description: 60000,
  location: 500,
  searchName: 255,
  category: 200,
  categoryId: 100,
  duration: 120,
  price: 120,
  bestTime: 200,
  maxTags: 80,
  tagLen: 100,
  maxImages: 50,
  urlLen: 4000,
  reviewCount: 2147483647,
};

function clampStr(s, max) {
  if (typeof s !== 'string') return '';
  return s.length > max ? s.slice(0, max) : s;
}

/** Allow http(s), or same-origin style paths /... */
function sanitizeImageUrl(u) {
  if (typeof u !== 'string') return null;
  const t = u.trim();
  if (!t || t.length > LIMITS.urlLen) return null;
  if (/^\s*(javascript|data|vbscript|file):/i.test(t)) return null;
  if (t.startsWith('https://') || t.startsWith('http://')) return t;
  if (t.startsWith('/') && !t.startsWith('//')) return t;
  return null;
}

function sanitizeImagesInput(raw) {
  if (!Array.isArray(raw)) return { ok: false, error: 'images must be an array' };
  if (raw.length > LIMITS.maxImages) return { ok: false, error: `At most ${LIMITS.maxImages} images` };
  const out = [];
  for (const item of raw) {
    const u = sanitizeImageUrl(String(item));
    if (u) out.push(u);
  }
  return { ok: true, value: out };
}

function sanitizeTagsInput(raw) {
  if (!Array.isArray(raw)) return { ok: false, error: 'tags must be an array' };
  if (raw.length > LIMITS.maxTags) return { ok: false, error: `At most ${LIMITS.maxTags} tags` };
  const out = [];
  for (const item of raw) {
    const s = clampStr(String(item), LIMITS.tagLen).trim();
    if (s) out.push(s);
  }
  return { ok: true, value: out };
}

function sanitizeHoursInput(raw) {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    try {
      JSON.stringify(raw);
      return { ok: true, value: raw };
    } catch {
      return { ok: false, error: 'Invalid hours data' };
    }
  }
  return { ok: false, error: 'hours must be a JSON object or null' };
}

function sanitizeDiningProfileInput(raw) {
  if (raw == null) return { ok: true, value: {} };
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    try {
      JSON.stringify(raw);
      return { ok: true, value: raw };
    } catch {
      return { ok: false, error: 'Invalid dining profile data' };
    }
  }
  return { ok: false, error: 'diningProfile must be a JSON object' };
}

/**
 * Validates and returns sanitized payload for UPDATE places (only defined fields applied upstream).
 * @returns {{ ok: boolean, error?: string, body?: object }}
 */
function validateBusinessPlacePut(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid JSON body' };

  const out = {};

  if (body.name !== undefined) {
    const n = clampStr(String(body.name), LIMITS.name).trim();
    if (!n) return { ok: false, error: 'name cannot be empty' };
    out.name = n;
  }

  if (body.description !== undefined) out.description = clampStr(String(body.description ?? ''), LIMITS.description);
  if (body.location !== undefined) out.location = clampStr(String(body.location ?? ''), LIMITS.location);

  if (body.latitude !== undefined) {
    if (body.latitude == null || body.latitude === '') out.latitude = null;
    else {
      const lat = parseFloat(body.latitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { ok: false, error: 'latitude must be between -90 and 90' };
      out.latitude = lat;
    }
  }

  if (body.longitude !== undefined) {
    if (body.longitude == null || body.longitude === '') out.longitude = null;
    else {
      const lng = parseFloat(body.longitude);
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { ok: false, error: 'longitude must be between -180 and 180' };
      out.longitude = lng;
    }
  }

  if (body.searchName !== undefined || body.search_name !== undefined) {
    out.searchName = clampStr(String(body.searchName ?? body.search_name ?? ''), LIMITS.searchName);
  }

  if (body.images !== undefined) {
    const im = sanitizeImagesInput(body.images);
    if (!im.ok) return { ok: false, error: im.error };
    out.images = im.value;
  }

  if (body.category !== undefined) out.category = clampStr(String(body.category ?? ''), LIMITS.category);
  if (body.categoryId !== undefined || body.category_id !== undefined) {
    out.categoryId = clampStr(String(body.categoryId ?? body.category_id ?? ''), LIMITS.categoryId);
  }
  if (body.duration !== undefined) out.duration = clampStr(String(body.duration ?? ''), LIMITS.duration);
  if (body.price !== undefined) out.price = clampStr(String(body.price ?? ''), LIMITS.price);
  if (body.bestTime !== undefined || body.best_time !== undefined) {
    out.bestTime = clampStr(String(body.bestTime ?? body.best_time ?? ''), LIMITS.bestTime);
  }

  if (body.rating !== undefined) {
    if (body.rating == null || body.rating === '') out.rating = null;
    else {
      const r = parseFloat(body.rating);
      if (!Number.isFinite(r) || r < 0 || r > 5) return { ok: false, error: 'rating must be between 0 and 5' };
      out.rating = r;
    }
  }

  if (body.reviewCount !== undefined || body.review_count !== undefined) {
    const rc = body.reviewCount ?? body.review_count;
    if (rc == null || rc === '') out.reviewCount = null;
    else {
      const n = parseInt(String(rc), 10);
      if (!Number.isInteger(n) || n < 0 || n > LIMITS.reviewCount) return { ok: false, error: 'Invalid review count' };
      out.reviewCount = n;
    }
  }

  if (body.hours !== undefined) {
    const h = sanitizeHoursInput(body.hours);
    if (!h.ok) return { ok: false, error: h.error };
    out.hours = h.value;
  }

  if (body.tags !== undefined) {
    const tg = sanitizeTagsInput(body.tags);
    if (!tg.ok) return { ok: false, error: tg.error };
    out.tags = tg.value;
  }

  if (body.diningProfile !== undefined || body.dining_profile !== undefined) {
    const dp = sanitizeDiningProfileInput(body.diningProfile ?? body.dining_profile);
    if (!dp.ok) return { ok: false, error: dp.error };
    out.diningProfile = dp.value;
  }

  return { ok: true, body: out };
}

const TRANS_LIMITS = { str: 60000, line: 500 };

function validateTranslationPut(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid JSON body' };
  const out = {};
  if (body.name != null) out.name = clampStr(String(body.name), LIMITS.name);
  if (body.description != null) out.description = clampStr(String(body.description), TRANS_LIMITS.str);
  if (body.location != null) out.location = clampStr(String(body.location), TRANS_LIMITS.line);
  if (body.category != null) out.category = clampStr(String(body.category), LIMITS.category);
  if (body.duration != null) out.duration = clampStr(String(body.duration), LIMITS.duration);
  if (body.price != null) out.price = clampStr(String(body.price), LIMITS.price);
  const bt = body.bestTime ?? body.best_time;
  if (bt != null) out.bestTime = clampStr(String(bt), LIMITS.bestTime);
  if (body.tags !== undefined) {
    const arr = Array.isArray(body.tags) ? body.tags : [];
    const tg = sanitizeTagsInput(arr.map((t) => String(t)));
    if (!tg.ok) return { ok: false, error: tg.error };
    out.tags = tg.value;
  }
  return { ok: true, body: out };
}

module.exports = {
  validateBusinessPlacePut,
  validateTranslationPut,
  LIMITS,
};
