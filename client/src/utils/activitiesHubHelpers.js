/**
 * Activities Hub Helper Functions
 */

export function normalizeHaystack(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function matchesQuery(obj, fields, qRaw) {
  const q = normalizeHaystack(qRaw.trim());
  if (!q) return true;
  const parts = fields.map((f) => (typeof f === 'function' ? f(obj) : obj[f]));
  const blob = normalizeHaystack(parts.filter((x) => x != null && x !== '').join(' '));
  return blob.includes(q);
}

export function clipDescription(raw, maxLen = 110) {
  const s = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen).trim()}…`;
}
