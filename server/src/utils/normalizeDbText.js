'use strict';

/**
 * Undo HTML-entity-style text stored in the DB (e.g. "&amp;amp;" from double-escaping).
 * Safe for plain-text fields shown in JSON/React; run before any HTML escape (meta tags).
 */
function normalizeDbText(s) {
  if (s == null || typeof s !== 'string') return s;
  let t = s;
  while (t.includes('&amp;')) {
    t = t.split('&amp;').join('&');
  }
  return t
    .split('&lt;')
    .join('<')
    .split('&gt;')
    .join('>')
    .split('&quot;')
    .join('"')
    .split('&#39;')
    .join("'")
    .split('&apos;')
    .join("'");
}

module.exports = { normalizeDbText };
