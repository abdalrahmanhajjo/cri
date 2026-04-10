/** URL-safe id suggestions for admin event/tour creation (avoid manual slug typing). */

export function slugifyForUrlId(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function suggestPublicId(prefix, name) {
  const slug = slugifyForUrlId(name);
  const tail = Date.now().toString(36).slice(-5);
  if (slug) return `${prefix}_${slug}_${tail}`;
  return `${prefix}_${Date.now()}`;
}
