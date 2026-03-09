/**
 * Security middleware: sanitize request body to prevent injection and malformed data.
 */

const MAX_STRING_LENGTH = 10000;
const DANGEROUS_PATTERNS = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;

/**
 * Recursively sanitize strings in an object. Truncate long strings, strip control chars.
 */
function sanitizeValue(val, depth = 0) {
  if (depth > 10) return null;
  if (val == null) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(DANGEROUS_PATTERNS, '');
    return cleaned.length > MAX_STRING_LENGTH ? cleaned.slice(0, MAX_STRING_LENGTH) : cleaned;
  }
  if (Array.isArray(val)) {
    return val.slice(0, 500).map((v) => sanitizeValue(v, depth + 1));
  }
  if (typeof val === 'object') {
    const out = {};
    const keys = Object.keys(val).slice(0, 100);
    for (const k of keys) {
      if (typeof k === 'string' && k.length <= 100 && !DANGEROUS_PATTERNS.test(k)) {
        out[k] = sanitizeValue(val[k], depth + 1);
      }
    }
    return out;
  }
  return val;
}

/**
 * Sanitize req.body before it reaches route handlers.
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
}

module.exports = { sanitizeBody, sanitizeValue };
