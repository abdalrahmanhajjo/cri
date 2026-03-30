/**
 * Persist AI planner trip settings (duration, stops per day, budget, date, interests) per user.
 */

export const PLANNER_PREFS_VERSION = 1;

export function plannerPrefsStorageKey(userId) {
  return `vt_ai_planner_prefs_v${PLANNER_PREFS_VERSION}:${userId || 'anon'}`;
}

export function loadPlannerPrefs(userId) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(plannerPrefsStorageKey(userId));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    return {
      durationDays: clampInt(o.durationDays, 1, 7, null),
      placesPerDay: clampInt(o.placesPerDay, 2, 8, null),
      budget: normalizeBudget(o.budget),
      startDate: typeof o.startDate === 'string' ? o.startDate.slice(0, 10) : null,
      interestIds: Array.isArray(o.interestIds) ? o.interestIds.map((x) => String(x)).filter(Boolean) : null,
    };
  } catch {
    return null;
  }
}

export function savePlannerPrefs(userId, prefs) {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      v: PLANNER_PREFS_VERSION,
      durationDays: prefs.durationDays,
      placesPerDay: prefs.placesPerDay,
      budget: prefs.budget,
      startDate: prefs.startDate,
      interestIds: prefs.interestIds,
    };
    localStorage.setItem(plannerPrefsStorageKey(userId), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

function clampInt(n, lo, hi, fallback) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return fallback;
  if (x < lo || x > hi) return fallback;
  return x;
}

function normalizeBudget(b) {
  const s = String(b || '').toLowerCase().trim();
  if (s === 'low' || s === 'moderate' || s === 'luxury') return s;
  return null;
}
