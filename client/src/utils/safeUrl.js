/**
 * Safe URL for images and styles (XSS prevention).
 * Allows only http(s) and relative paths; blocks javascript:, data:, vbscript:, etc.
 */
const DANGEROUS = /^\s*(javascript|data|vbscript|file):/i;

export function safeImageUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  const u = url.trim();
  if (DANGEROUS.test(u)) return null;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/') && !u.startsWith('//')) return u;
  return null;
}
