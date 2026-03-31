/**
 * Security: validate/sanitize request inputs.
 */

const FORBIDDEN_PROTOCOLS = /^\s*(javascript|data|vbscript|file):/i;

/**
 * Parse a value as a positive integer. Use for IDs in params/body.
 * @param {*} value - req.params.id or req.body.placeId etc.
 * @returns {{ valid: boolean, value?: number }}
 */
function parsePositiveInt(value) {
  if (value == null) return { valid: false };
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isInteger(n) || n < 1) return { valid: false };
  return { valid: true, value: n };
}

/**
 * Normalize and validate place id for saved_places.place_id (varchar).
 * Accepts number or string; returns a safe string (max 255 chars).
 * @param {*} value - req.body.placeId or req.params.placeId
 * @returns {{ valid: boolean, value?: string }}
 */
function parsePlaceId(value) {
  if (value == null) return { valid: false };
  const s = typeof value === 'number' ? String(value) : String(value).trim();
  if (!s || s.length > 255) return { valid: false };
  if (/[\x00-\x1f]/.test(s)) return { valid: false };
  return { valid: true, value: s };
}

/**
 * Validate trip id (varchar, e.g. trip_123_abc or numeric).
 * @param {*} value - req.params.id
 * @returns {{ valid: boolean, value?: string }}
 */
function parseTripId(value) {
  if (value == null) return { valid: false };
  const s = String(value).trim();
  if (!s || s.length > 100) return { valid: false };
  if (/[\x00-\x1f'"\\]/.test(s)) return { valid: false };
  return { valid: true, value: s };
}

/**
 * Ensure URL is safe for redirect or image (no javascript:, data:, etc.).
 * @param {string} url
 * @returns {string|null} - url if safe, null otherwise
 */
function safeUrl(url) {
  if (typeof url !== 'string') return null;
  const t = url.trim();
  if (!t) return null;
  if (FORBIDDEN_PROTOCOLS.test(t)) return null;
  if (t.startsWith('http://') || t.startsWith('https://') || (t.startsWith('/') && !t.startsWith('//'))) return t;
  return null;
}

/**
 * Optional pagination for GET /api/places (backward compatible when `limit` omitted).
 * @param {Record<string, unknown>} query - req.query
 * @returns {{ usePagination: boolean, limit: number|null, offset: number, invalid?: string }}
 */
function parsePlacesListPagination(query) {
  const q = query && typeof query === 'object' ? query : {};
  const rawLimit = q.limit;
  if (rawLimit == null || rawLimit === '') {
    return { usePagination: false, limit: null, offset: 0 };
  }
  const limit = parseInt(String(rawLimit), 10);
  if (!Number.isFinite(limit) || limit < 1) {
    return { invalid: 'limit must be a positive integer (max 500)' };
  }
  const clampedLimit = Math.min(500, Math.max(1, limit));
  let offset = 0;
  if (q.offset != null && q.offset !== '') {
    const o = parseInt(String(q.offset), 10);
    if (Number.isFinite(o) && o >= 0) offset = Math.min(o, 1_000_000);
  }
  return { usePagination: true, limit: clampedLimit, offset };
}

module.exports = { parsePositiveInt, parsePlaceId, parseTripId, safeUrl, parsePlacesListPagination };
