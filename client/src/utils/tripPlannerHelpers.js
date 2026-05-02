/**
 * Shared trip planning helpers (Visit Trioli web + parity with VisitTripoliApp Flutter):
 * calendar-day span, TripDay/TripSlot JSON, overlap checks, ordering: best time → duration → rating.
 */

export const BEST_TIME_ORDER = {
  Morning: 0,
  Afternoon: 1,
  Evening: 2,
  morning: 0,
  afternoon: 1,
  evening: 2,
};

function parseLocalYmd(ymd) {
  if (!ymd || typeof ymd !== 'string') return null;
  const s = ymd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayDateOnly() {
  return formatYMD(new Date());
}

export function clampTripStartDateLocal(d) {
  const minStr = todayDateOnly();
  const base =
    d instanceof Date && !Number.isNaN(d.getTime()) ? d : new Date(`${minStr}T12:00:00`);
  const cur = formatYMD(base);
  if (cur >= minStr) {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
  }
  const [y, m, day] = minStr.split('-').map(Number);
  return new Date(y, m - 1, day, 12, 0, 0);
}


/** Inclusive calendar days between date-only strings (same as Flutter trips_format / trip_form_modal). */
export function getDayCount(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const s = toDateOnly(startDate);
  const e = toDateOnly(endDate);
  if (!s || !e) return 1;
  const start = parseLocalYmd(s);
  const end = parseLocalYmd(e);
  if (!start || !end) return 1;
  const diff = Math.round((end - start) / 86400000);
  return Math.max(1, diff + 1);
}

export function isValidDateRange(startStr, endStr) {
  if (!startStr || !endStr) return true;
  const s = toDateOnly(startStr);
  const e = toDateOnly(endStr);
  if (!s || !e) return true;
  return s <= e;
}

/** yyyy-mm-dd for day index from trip start (parity with Plan.jsx getDateForDay). */
export function getDateForDayIndex(startDateStr, dayIndex) {
  const base = parseLocalYmd(toDateOnly(startDateStr));
  if (!base || dayIndex < 0) return '';
  const d = new Date(base);
  d.setDate(d.getDate() + dayIndex);
  return formatYMD(d);
}

function normalizeSlot(s) {
  if (!s || typeof s !== 'object') return null;
  const placeId = String(s.placeId ?? s.place_id ?? '').trim();
  if (!placeId) return null;
  const st = s.startTime != null && String(s.startTime).trim() ? String(s.startTime).trim().slice(0, 8) : null;
  const en = s.endTime != null && String(s.endTime).trim() ? String(s.endTime).trim().slice(0, 8) : null;
  const notes = s.notes != null && String(s.notes).trim() ? String(s.notes).trim().slice(0, 2000) : null;
  return { placeId, startTime: st, endTime: en, notes };
}

/** API / internal day: { date?, slots: [{ placeId, startTime, endTime, notes? }] } */
export function dayFromApiShape(day) {
  if (!day || typeof day !== 'object') return { slots: [] };
  if (Array.isArray(day.slots)) {
    const slots = day.slots.map(normalizeSlot).filter(Boolean);
    return { slots };
  }
  if (Array.isArray(day.placeIds)) {
    const slots = day.placeIds.map((pid) => ({
      placeId: String(pid),
      startTime: null,
      endTime: null,
      notes: null,
    }));
    return { slots };
  }
  return { slots: [] };
}

export function placeIdsFromDay(day) {
  const slots = dayFromApiShape(day).slots;
  return slots.map((s) => s.placeId);
}

export function ensureDaysWithSlots(days, dayCount) {
  const base = Array.isArray(days) ? days : [];
  const result = [];
  for (let i = 0; i < dayCount; i++) {
    const d = base[i];
    result.push(dayFromApiShape(d));
  }
  return result;
}

export function mergeDaysWithSlotsWhenShrinking(prevDays, newDayCount) {
  if (newDayCount <= 0) return [];
  if (newDayCount >= prevDays.length) return ensureDaysWithSlots(prevDays, newDayCount);
  const kept = prevDays.slice(0, newDayCount).map((d) => ({
    slots: dayFromApiShape(d).slots.map((s) => ({ ...s })),
  }));
  for (let i = newDayCount; i < prevDays.length; i++) {
    const tail = dayFromApiShape(prevDays[i]).slots;
    if (kept.length > 0) kept[kept.length - 1].slots.push(...tail.map((s) => ({ ...s })));
  }
  return kept;
}

/** Legacy [{ placeIds }] — used by Community add-to-trip etc. */
export function ensureDaysArray(days, dayCount) {
  const withSlots = ensureDaysWithSlots(days, dayCount);
  return withSlots.map((d) => ({
    placeIds: d.slots.map((s) => s.placeId),
  }));
}

export function mergeDaysWhenShrinking(prevDays, newDayCount) {
  const merged = mergeDaysWithSlotsWhenShrinking(
    (prevDays || []).map((d) =>
      Array.isArray(d?.placeIds)
        ? { slots: d.placeIds.map((pid) => ({ placeId: String(pid), startTime: null, endTime: null, notes: null })) }
        : d
    ),
    newDayCount
  );
  return merged.map((d) => ({ placeIds: d.slots.map((s) => s.placeId) }));
}

/** Flutter-shaped payload for TripDay[]. */
export function buildTripDaysApiPayload(editDays, startDateStr) {
  const start = toDateOnly(startDateStr);
  return (editDays || []).map((day, i) => {
    const { slots } = dayFromApiShape(day);
    const date = getDateForDayIndex(start, i);
    return {
      date,
      slots: slots.map((s) => ({
        placeId: s.placeId,
        startTime: s.startTime || null,
        endTime: s.endTime || null,
        notes: s.notes || null,
      })),
    };
  });
}

/** Convert legacy day rows with only placeIds to API payload. */
export function tripDaysPlaceIdsOnlyToPayload(daysWithPlaceIds, startDateStr) {
  const start = toDateOnly(startDateStr);
  return (daysWithPlaceIds || []).map((d, i) => ({
    date: getDateForDayIndex(start, i),
    slots: (d?.placeIds || []).map((pid) => ({
      placeId: String(pid),
      startTime: null,
      endTime: null,
      notes: null,
    })),
  }));
}

export function toDateOnly(val) {
  if (!val) return '';
  if (val instanceof Date && !Number.isNaN(val.getTime())) return formatYMD(val);
  const s = String(val).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? '' : formatYMD(d);
}

export function parseDuration(str) {
  if (!str || typeof str !== 'string') return 999;
  const m = str.match(/(\d+)\s*(h|hr|hour|min|m)/i);
  if (!m) return 999;
  const n = parseInt(m[1], 10);
  if (m[2].toLowerCase().startsWith('h')) return n * 60;
  return n;
}

function slotMinutes(s) {
  if (!s || !s.startTime || !String(s.startTime).trim()) return null;
  const parts = String(s.startTime).trim().split(/[:\s]/);
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Half-open [start, end) in minutes for overlap; mirrors lib/utils/trip_slot_validation.dart */
export function slotTimeRangeMinutes(slot) {
  const start = slotMinutes(slot) ?? 8 * 60;
  let end = slot?.endTime ? slotMinutes({ startTime: slot.endTime }) : null;
  if (end == null) end = start + 60;
  if (end <= start) end = start + 60;
  return [start, end];
}

export function hasOverlappingTimeSlots(slots) {
  const list = Array.isArray(slots) ? slots : [];
  const timed = list.filter((s) => s && s.startTime && String(s.startTime).trim());
  if (timed.length < 2) return false;
  const ranges = timed.map(slotTimeRangeMinutes).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i - 1][1] > ranges[i][0]) return true;
  }
  return false;
}

/** Trip date ranges overlap (inclusive calendar days), date-only strings. Parity with TripsProvider.hasDateConflict. */
export function tripCalendarRangesOverlap(startA, endA, startB, endB) {
  const a0 = toDateOnly(startA);
  const a1 = toDateOnly(endA);
  const b0 = toDateOnly(startB);
  const b1 = toDateOnly(endB);
  if (!a0 || !a1 || !b0 || !b1) return false;
  return a0 <= b1 && a1 >= b0;
}

export function tripHasDateConflict(trips, startStr, endStr, excludeTripId) {
  const list = Array.isArray(trips) ? trips : [];
  return list.some((trip) => {
    if (excludeTripId != null && String(trip.id) === String(excludeTripId)) return false;
    return tripCalendarRangesOverlap(startStr, endStr, trip.startDate, trip.endDate);
  });
}

/** Trips whose [startDate,endDate] overlaps [startStr,endStr] inclusive (calendar days). */
export function findOverlappingTrips(trips, startStr, endStr, excludeTripId) {
  const list = Array.isArray(trips) ? trips : [];
  return list.filter((trip) => {
    if (excludeTripId != null && String(trip.id) === String(excludeTripId)) return false;
    return tripCalendarRangesOverlap(startStr, endStr, trip.startDate, trip.endDate);
  });
}

/**
 * Same calendar length as [preferredStartYmd, preferredEndYmd], shifted forward until it does not
 * overlap any trip in `trips` (inclusive calendar-day overlap). Used when duplicating a trip.
 */
export function findNextNonOverlappingDateRange(trips, preferredStartYmd, preferredEndYmd) {
  const dc = getDayCount(preferredStartYmd, preferredEndYmd);
  if (dc < 1) return null;
  const list = Array.isArray(trips) ? trips : [];

  function addDays(ymd, n) {
    const s = toDateOnly(ymd);
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    return formatYMD(dt);
  }

  let startY = toDateOnly(preferredStartYmd);
  if (!startY) return null;

  for (let iter = 0; iter < 800; iter += 1) {
    const endY = addDays(startY, dc - 1);
    if (!endY) return null;
    const conflict = list.some((trip) =>
      tripCalendarRangesOverlap(startY, endY, trip.startDate, trip.endDate)
    );
    if (!conflict) return { startDate: startY, endDate: endY };

    let nextStart = startY;
    for (const trip of list) {
      if (!tripCalendarRangesOverlap(startY, endY, trip.startDate, trip.endDate)) continue;
      const te = toDateOnly(trip.endDate);
      if (!te) continue;
      const candidate = addDays(te, 1);
      if (candidate && candidate > nextStart) nextStart = candidate;
    }
    if (nextStart <= startY) {
      const bump = addDays(startY, 1);
      if (!bump) return null;
      startY = bump;
    } else {
      startY = nextStart;
    }
  }
  return null;
}

/** @param {string[]} placeIds */
export function sortPlacesForItinerary(placeIds, placeMap) {
  return [...placeIds].sort((a, b) => {
    const pa = placeMap[a];
    const pb = placeMap[b];
    const bestA = pa?.bestTime ? String(pa.bestTime).trim() : '';
    const bestB = pb?.bestTime ? String(pb.bestTime).trim() : '';
    const orderA = BEST_TIME_ORDER[bestA] ?? 99;
    const orderB = BEST_TIME_ORDER[bestB] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    const durA = parseDuration(pa?.duration);
    const durB = parseDuration(pb?.duration);
    if (durA !== durB) return durA - durB;
    const rA = Number(pa?.rating) || 0;
    const rB = Number(pb?.rating) || 0;
    return rB - rA;
  });
}

export function optimizeSlotsOrder(slots, placeMap) {
  const list = Array.isArray(slots) ? slots : [];
  const ids = list.map((s) => s.placeId);
  const sortedIds = sortPlacesForItinerary(ids, placeMap);
  const byId = new Map(list.map((s) => [s.placeId, s]));
  return sortedIds.map((id) => {
    const s = byId.get(id);
    return s ? { ...s } : { placeId: id, startTime: null, endTime: null, notes: null };
  });
}

/** Trips list sort — lib/screens/trips/trips_list_logic.dart TripSortMode.smart */
export function tripPhaseForSort(trip, now = new Date()) {
  const today = formatYMD(now);
  const s = toDateOnly(trip?.startDate);
  const e = toDateOnly(trip?.endDate);
  if (!s || !e) return 'upcoming';
  if (e < today) return 'past';
  if (s > today) return 'upcoming';
  return 'ongoing';
}

export function sortTripsSmart(trips, now = new Date()) {
  const copy = Array.isArray(trips) ? [...trips] : [];
  const rank = { upcoming: 0, ongoing: 1, past: 2 };
  copy.sort((a, b) => {
    const pa = tripPhaseForSort(a, now);
    const pb = tripPhaseForSort(b, now);
    const byPhase = rank[pa] - rank[pb];
    if (byPhase !== 0) return byPhase;
    const sa = toDateOnly(a.startDate);
    const sb = toDateOnly(b.startDate);
    const ea = toDateOnly(a.endDate);
    const eb = toDateOnly(b.endDate);
    if (pa === 'upcoming') return sa.localeCompare(sb);
    if (pa === 'ongoing') return ea.localeCompare(eb);
    return eb.localeCompare(ea);
  });
  return copy;
}

/**
 * Quick presets: today, weekend (Sat–Sun matching Flutter modulo logic), week (7 days from today).
 */
export function quickDatePresetRange(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'today') {
    const s = formatYMD(today);
    return { start: s, end: s };
  }
  if (preset === 'week') {
    const end = new Date(today);
    end.setDate(end.getDate() + 6);
    return { start: formatYMD(today), end: formatYMD(end) };
  }
  if (preset === 'weekend') {
    const jsDow = today.getDay();
    const dartWeekday = jsDow === 0 ? 7 : jsDow;
    let addSat = 6 - dartWeekday;
    if (addSat < 0) addSat = -1;
    const sat = new Date(today);
    sat.setDate(sat.getDate() + addSat);
    const sun = new Date(sat);
    sun.setDate(sun.getDate() + 1);
    return { start: formatYMD(sat), end: formatYMD(sun) };
  }
  const s = formatYMD(today);
  return { start: s, end: s };
}

export function datesOnOrAfterToday(startStr, endStr) {
  const t = todayDateOnly();
  const s = toDateOnly(startStr);
  const e = toDateOnly(endStr);
  if (!s || !e) return false;
  return s >= t && e >= t;
}
