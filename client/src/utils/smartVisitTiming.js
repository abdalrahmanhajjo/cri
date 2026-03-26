/**
 * Smart visit order + suggested times: prayer-aware mosques, weather vs indoor/outdoor,
 * meal-friendly food stops. Uses context from prayerTimesApi + visitWeatherHint.
 */
import { parseDuration, BEST_TIME_ORDER, hasOverlappingTimeSlots } from './tripPlannerHelpers';
import { MIN_SLOT_GAP_MINUTES, suggestedTimeToMinutes } from '../services/aiPlannerService';
import { fetchPoorOutdoorWeatherForDate } from './visitWeatherHint';
import { fetchPrayerMinutesForDate } from './prayerTimesApi';

/** @typedef {import('./prayerTimesApi').PrayerMinutes} PrayerMinutes */

function normalizeTags(place) {
  const raw = place?.tags;
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x || '').toLowerCase());
}

function haystack(place) {
  const cat = `${place?.categoryId ?? place?.category_id ?? ''} ${place?.category ?? ''}`.toLowerCase();
  const tags = normalizeTags(place).join(' ');
  const name = `${place?.name ?? ''}`.toLowerCase();
  return `${cat} ${tags} ${name}`;
}

/**
 * @param {object | undefined} place
 * @returns {'mosque'|'food_breakfast'|'food_lunch'|'food_sweets'|'food'|'museum'|'outdoor'|'default'}
 */
export function inferVisitKind(place) {
  const h = haystack(place);
  if (
    /\bmosque\b|\bmasjid\b|\bjami\b/.test(h)
    || h.includes('mosques')
    || (h.includes('prayer') && (h.includes('islam') || h.includes('mamluk') || h.includes('between')))
  ) {
    return 'mosque';
  }
  if (/\bmuseum\b|\bcultural centre\b|\bcultural center\b|\bheritage\b|\bmadrasa\b/.test(h)) {
    return 'museum';
  }
  if (
    /\bpark\b|\bpromenade\b|\bcitadel\b|\bsouk\b|\bsouq\b|\bbeach\b|\bviewpoint\b/.test(h)
    || h.includes('old city')
  ) {
    return 'outdoor';
  }
  if (/\brestaurant\b|\bcafe\b|\bcafé\b|\bakra\b|\bbreakfast\b|\bhallab\b|\bsweet\b|\bdessert\b|\bknefe\b|\bfood\b/.test(h)) {
    if (/\bbreakfast\b|\bakra\b|\bmorning\b/.test(h) || h.includes('coffee')) return 'food_breakfast';
    if (/\bsweet\b|\bhallab\b|\bdessert\b|\bknefe\b|\bmaamoul\b/.test(h)) return 'food_sweets';
    if (/\blunch\b|\bnoon\b/.test(h)) return 'food_lunch';
    return 'food_lunch';
  }
  return 'default';
}

/**
 * Visitor windows between congregational prayers (cultural visit etiquette).
 * @param {PrayerMinutes} p
 * @returns {{ start: number, end: number }[]}
 */
export function betweenPrayerVisitorWindows(p) {
  if (!p) {
    return [
      { start: 10 * 60, end: 11 * 60 + 45 },
      { start: 14 * 60, end: 15 * 60 + 45 },
    ];
  }
  const win = (a, b) => ({ start: Math.round(a), end: Math.round(b) });
  const raw = [
    win(p.sunrise + 35, p.dhuhr - 20),
    win(p.dhuhr + 25, p.asr - 15),
    win(p.asr + 20, p.maghrib - 20),
  ];
  return raw.filter((w) => w.end - w.start >= 35);
}

function bestTimeFallbackMin(place) {
  const bt = place?.bestTime ? String(place.bestTime).trim() : '';
  const o = bt in BEST_TIME_ORDER ? BEST_TIME_ORDER[bt] : BEST_TIME_ORDER[bt.toLowerCase()] ?? 99;
  if (o <= 0) return 10 * 60;
  if (o === 1) return 14 * 60 + 30;
  if (o === 2) return 18 * 60;
  return 11 * 60;
}

function roundQuarter(m) {
  return Math.min(23 * 60 + 45, Math.max(8 * 60, Math.round(m / 15) * 15));
}

function minutesToHHMM(m) {
  const h = Math.floor(m / 60) % 24;
  const min = Math.floor(m % 60);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * @param {object} ctx
 * @param {PrayerMinutes | null} ctx.prayers
 * @param {boolean} ctx.weatherPoor
 */
function idealStartMinutes(place, kind, ctx, mosqueWindowIndex) {
  const wPoor = !!ctx.weatherPoor;
  const windows = betweenPrayerVisitorWindows(ctx.prayers);
  switch (kind) {
    case 'mosque': {
      const idx = Math.min(mosqueWindowIndex, Math.max(0, windows.length - 1));
      const w = windows[idx] || windows[0];
      return Math.round((w.start + w.end) / 2);
    }
    case 'food_breakfast':
      return 9 * 60 + 15;
    case 'food_lunch':
      return 12 * 60 + 45;
    case 'food_sweets':
      return 15 * 60 + 30;
    case 'food':
      return 13 * 60;
    case 'museum':
      return wPoor ? 11 * 60 : 14 * 60;
    case 'outdoor':
      return wPoor ? 17 * 60 + 30 : 9 * 60 + 45;
    default:
      return bestTimeFallbackMin(place);
  }
}

/**
 * Lower tier = earlier in the day itinerary when possible.
 * @param {string} kind
 * @param {boolean} weatherPoor
 */
function daySortTier(kind, weatherPoor) {
  if (kind === 'food_breakfast') return 0;
  if (weatherPoor) {
    const rank = { mosque: 1, museum: 1, food_lunch: 2, food: 2, food_sweets: 3, default: 3, outdoor: 6 };
    return rank[kind] ?? 3;
  }
  const rank = { outdoor: 1, mosque: 2, museum: 3, food_lunch: 4, food: 4, food_sweets: 5, default: 3 };
  return rank[kind] ?? 3;
}

export async function loadSmartScheduleContext(ymd) {
  const [weatherPoor, prayers] = await Promise.all([
    fetchPoorOutdoorWeatherForDate(ymd),
    fetchPrayerMinutesForDate(ymd),
  ]);
  return { weatherPoor, prayers };
}

function enforceMinGap(slots, gapMin) {
  const sortedIdx = slots
    .map((s, i) => ({ i, t: suggestedTimeToMinutes(s.startTime) }))
    .sort((a, b) => a.t - b.t);
  let prevEnd = null;
  const out = slots.map((s) => ({ ...s }));
  for (const { i } of sortedIdx) {
    const dur =
      Math.max(30, suggestedTimeToMinutes(out[i].endTime) - suggestedTimeToMinutes(out[i].startTime)) || 60;
    let start = suggestedTimeToMinutes(out[i].startTime);
    if (prevEnd != null) start = Math.max(start, prevEnd + gapMin);
    start = roundQuarter(start);
    let end = roundQuarter(start + dur);
    if (end <= start) end = start + 30;
    out[i] = { ...out[i], startTime: minutesToHHMM(start), endTime: minutesToHHMM(end) };
    prevEnd = suggestedTimeToMinutes(out[i].endTime);
  }
  return out;
}

/**
 * @param {{ placeId: string }[]} slots
 * @param {Record<string, object>} placeMap
 * @param {{ prayers: PrayerMinutes | null, weatherPoor: boolean }} ctx
 * @returns {{ placeId: string, startTime: string, endTime: string, notes: string | null }[]}
 */
export function sortAndAssignSmartSlotTimes(slots, placeMap, ctx) {
  const list = Array.isArray(slots) ? slots : [];
  let mosqueOrd = 0;
  const enriched = list.map((s) => {
    const p = placeMap[String(s.placeId)];
    const kind = inferVisitKind(p);
    const mi = kind === 'mosque' ? mosqueOrd++ : 0;
    const ideal = idealStartMinutes(p, kind, ctx, kind === 'mosque' ? mi : 0);
    const tier = daySortTier(kind, ctx.weatherPoor);
    const rating = Number(p?.rating) || 0;
    return { s, p, kind, ideal, tier, rating, mosqueIdx: kind === 'mosque' ? mi : 0 };
  });

  enriched.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.ideal !== b.ideal) return a.ideal - b.ideal;
    if (a.rating !== b.rating) return b.rating - a.rating;
    const da = parseDuration(a.p?.duration);
    const db = parseDuration(b.p?.duration);
    if (da !== db) return da - db;
    return String(a.s.placeId).localeCompare(String(b.s.placeId));
  });

  const gap = MIN_SLOT_GAP_MINUTES;
  let prevEnd = null;
  const timed = enriched.map((row) => {
    const { s, p, ideal } = row;
    const dur = Math.min(180, Math.max(30, parseDuration(p?.duration) || 60));
    let start = ideal - Math.floor(dur / 2);
    if (prevEnd != null) start = Math.max(start, prevEnd + gap);
    start = Math.max(9 * 60, roundQuarter(start));
    let end = roundQuarter(start + dur);
    if (end <= start) end = start + 30;
    prevEnd = end;
    return {
      placeId: String(s.placeId),
      startTime: minutesToHHMM(start),
      endTime: minutesToHHMM(end),
      notes: s.notes != null && String(s.notes).trim() ? String(s.notes).trim().slice(0, 2000) : null,
    };
  });

  let fixed = timed;
  for (let k = 0; k < 8 && hasOverlappingTimeSlots(fixed); k += 1) {
    fixed = enforceMinGap(fixed, gap);
  }
  return fixed;
}
