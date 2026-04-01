/**
 * On-device memory so the AI planner can personalize without a new backend table.
 * Keyed by user id when logged in, otherwise "anon".
 */

export const PLANNER_MEMORY_VERSION = 1;

const MAX_PERSONAL_NOTE = 600;
const MAX_RECENT_PLACE_NAMES = 14;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function areaBucket(place) {
  const loc = norm(place?.location);
  const name = norm(place?.name);
  const blob = `${loc} ${name}`;
  if (/(mina|port|seafront|corniche|fish|ميناء|منارة)/.test(blob)) return 'mina';
  if (/(old city|souk|souq|khan|citadel|tell|مدينة قديمة|سوق|خان|قلعة)/.test(blob)) return 'old_city';
  return 'other';
}

export function storageKeyForPlannerMemory(userId) {
  return `vt_ai_planner_memory_v${PLANNER_MEMORY_VERSION}:${userId || 'anon'}`;
}

export function createEmptyPlannerMemory() {
  return {
    v: PLANNER_MEMORY_VERSION,
    personalNote: '',
    categoryTally: {},
    areaTally: {},
    recentPlaceNames: [],
    plansSuggestedCount: 0,
    updatedAt: null,
  };
}

function isStrippedControlChar(code) {
  if (code === 0x7f) return true;
  if (code <= 0x08) return true;
  if (code === 0x0b || code === 0x0c) return true;
  if (code >= 0x0e && code <= 0x1f) return true;
  return false;
}

export function sanitizePersonalNote(raw) {
  const s = String(raw || '');
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (!isStrippedControlChar(c)) out += s[i];
  }
  return out.trim().slice(0, MAX_PERSONAL_NOTE);
}

function migrateRaw(o) {
  const base = createEmptyPlannerMemory();
  if (!o || typeof o !== 'object') return base;
  base.personalNote = sanitizePersonalNote(o.personalNote);
  if (o.categoryTally && typeof o.categoryTally === 'object') {
    for (const [k, v] of Object.entries(o.categoryTally)) {
      const n = Number(v);
      if (k && Number.isFinite(n) && n > 0) base.categoryTally[k] = Math.min(500, Math.floor(n));
    }
  }
  if (o.areaTally && typeof o.areaTally === 'object') {
    for (const [k, v] of Object.entries(o.areaTally)) {
      const n = Number(v);
      if (k && Number.isFinite(n) && n > 0) base.areaTally[k] = Math.min(500, Math.floor(n));
    }
  }
  if (Array.isArray(o.recentPlaceNames)) {
    base.recentPlaceNames = o.recentPlaceNames
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, MAX_RECENT_PLACE_NAMES);
  }
  const c = Number(o.plansSuggestedCount);
  if (Number.isFinite(c) && c > 0) base.plansSuggestedCount = Math.min(9999, Math.floor(c));
  return base;
}

export function loadPlannerMemory(userId) {
  if (typeof window === 'undefined') return createEmptyPlannerMemory();
  try {
    const raw = localStorage.getItem(storageKeyForPlannerMemory(userId));
    if (!raw) return createEmptyPlannerMemory();
    return migrateRaw(JSON.parse(raw));
  } catch {
    return createEmptyPlannerMemory();
  }
}

export function savePlannerMemory(userId, memory) {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      ...memory,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKeyForPlannerMemory(userId), JSON.stringify(payload));
  } catch {
    /* quota or private mode */
  }
}

/**
 * After a successful model reply with slots, reinforce categories / areas / names.
 * @param {object} memory
 * @param {Array<{ placeId: string }>} slots
 * @param {Record<string, object>} placeById
 */
export function recordSuccessfulPlan(memory, slots, placeById) {
  if (!Array.isArray(slots) || slots.length === 0) return memory;
  const next = {
    ...memory,
    categoryTally: { ...memory.categoryTally },
    areaTally: { ...memory.areaTally },
    recentPlaceNames: [...memory.recentPlaceNames],
    plansSuggestedCount: (memory.plansSuggestedCount || 0) + 1,
  };
  const seenLower = new Set(next.recentPlaceNames.map((n) => n.toLowerCase()));
  for (const s of slots) {
    const p = placeById[String(s.placeId)];
    if (!p) continue;
    const cat = p.category != null ? String(p.category).trim() : '';
    if (cat) {
      next.categoryTally[cat] = Math.min(500, (next.categoryTally[cat] || 0) + 1);
    }
    const area = areaBucket(p);
    next.areaTally[area] = Math.min(500, (next.areaTally[area] || 0) + 1);
    const name = p.name != null ? String(p.name).trim() : '';
    if (name) {
      const low = name.toLowerCase();
      if (!seenLower.has(low)) {
        next.recentPlaceNames.unshift(name);
        seenLower.add(low);
      }
    }
  }
  next.recentPlaceNames = next.recentPlaceNames.slice(0, MAX_RECENT_PLACE_NAMES);
  return next;
}

/**
 * English system-prompt block (model reads structured facts; user notes may be any language).
 * @param {{ memory: object, profileHints?: { city?: string, mood?: string, pace?: string } }} opts
 */
export function buildUserFamiliarityBlock(opts) {
  const memory = opts?.memory || createEmptyPlannerMemory();
  const ph = opts?.profileHints || {};
  const lines = [];

  const city = ph.city != null ? String(ph.city).trim() : '';
  if (city) lines.push(`Self-reported city / origin: ${city}.`);

  const mood = ph.mood != null ? String(ph.mood).trim() : '';
  if (mood && mood.toLowerCase() !== 'mixed') {
    lines.push(`Profile travel mood (from account): ${mood}.`);
  }

  const pace = ph.pace != null ? String(ph.pace).trim() : '';
  if (pace && pace.toLowerCase() !== 'normal') {
    lines.push(`Profile pacing (from account): ${pace}.`);
  }

  const note = sanitizePersonalNote(memory.personalNote);
  if (note) {
    lines.push(`Visitor notes (honor carefully; may be Arabic/French/English): ${note}`);
  }

  const topCat = Object.entries(memory.categoryTally || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  if (topCat.length) {
    lines.push(
      `From past AI itineraries on this device, category frequency: ${topCat.map(([k, v]) => `"${k}"×${v}`).join(', ')}.`
    );
  }

  const topArea = Object.entries(memory.areaTally || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topArea.length) {
    lines.push(
      `Area mix in those plans: ${topArea.map(([k, v]) => `${k}:${v}`).join(', ')} (old_city / mina / other).`
    );
  }

  const recent = (memory.recentPlaceNames || []).filter(Boolean).slice(0, 10);
  if (recent.length) {
    lines.push(`Places recently included in their AI plans: ${recent.join('; ')}.`);
  }

  if ((memory.plansSuggestedCount || 0) >= 3) {
    lines.push('Returning planner user — keep suggestions fresh while respecting the signals above.');
  }

  return lines.join('\n');
}

/** Category labels to bias `rankPlacesForPlanner` toward past on-device preferences. */
export function topMemoryCategoriesForRanker(memory, limit = 5) {
  return Object.entries(memory?.categoryTally || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}
