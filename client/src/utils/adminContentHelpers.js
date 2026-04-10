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

/** Multiline or comma-separated list → string array (tour languages, includes, …). */
export function linesToStringArray(raw) {
  if (raw == null || typeof raw !== 'string') return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse itinerary JSON for admin tour form; returns { ok, data?, error? }. */
export function parseItineraryJson(text) {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t) return { ok: true, data: [] };
  try {
    const parsed = JSON.parse(t);
    if (!Array.isArray(parsed)) {
      return { ok: false, error: 'Itinerary must be a JSON array, e.g. [{"time":"09:00","activity":"Stop"}]' };
    }
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: 'Invalid JSON in itinerary. Check brackets and quotes.' };
  }
}
