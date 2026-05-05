/**
 * Security middleware: sanitize request body to prevent injection and malformed data.
 */

const MAX_STRING_LENGTH = 10000;
const DANGEROUS_PATTERNS = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;
const XSS_PATTERNS = /<script\b[^>]*>([\s\S]*?)<\/script>|on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+(?=\s|>))|javascript:\s*[^\s"']+/gi;

const POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively sanitize values.
 * 1. Truncate long strings and strip control chars + XSS payloads.
 * 2. Drop prototype-pollution keys (__proto__, constructor, prototype).
 * 3. Drop NoSQL injection keys (keys starting with $).
 */
function sanitizeValue(val, depth = 0) {
  if (depth > 10) return null;
  if (val == null) return val;
  
  if (typeof val === 'string') {
    let cleaned = val.replace(DANGEROUS_PATTERNS, '');
    cleaned = cleaned.replace(XSS_PATTERNS, '');
    return cleaned.length > MAX_STRING_LENGTH ? cleaned.slice(0, MAX_STRING_LENGTH) : cleaned;
  }
  
  if (Array.isArray(val)) {
    return val.slice(0, 500).map((v) => sanitizeValue(v, depth + 1));
  }
  
  if (typeof val === 'object') {
    const out = {};
    const keys = Object.keys(val).slice(0, 100);
    for (const k of keys) {
      if (POLLUTION_KEYS.has(k)) continue;
      // NoSQL Injection protection: strip keys starting with $
      if (typeof k === 'string' && k.startsWith('$')) continue;
      
      if (typeof k === 'string' && k.length <= 100 && !DANGEROUS_PATTERNS.test(k)) {
        out[k] = sanitizeValue(val[k], depth + 1);
      }
    }
    return out;
  }
  return val;
}

/**
 * Sanitize req.body, req.query, and req.params before they reach route handlers.
 */
function sanitizeRequest(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params);
  }
  next();
}

module.exports = { sanitizeRequest, sanitizeValue };
