import { normalizeSuggestedTime, suggestedTimeToMinutes } from '../services/aiPlannerService';
import { formatYMD, todayDateOnly } from '../utils/tripPlannerHelpers';

export function getTourEffectiveScrollY() {
  if (typeof document === 'undefined') return 0;
  const { body } = document;
  if (body.style.position === 'fixed') {
    const n = parseFloat(body.style.top);
    if (Number.isFinite(n)) return Math.max(0, -n);
    return 0;
  }
  return window.scrollY ?? document.documentElement.scrollTop ?? 0;
}

export function setTourEffectiveScrollY(y) {
  const yClamped = Math.max(0, y);
  const { body } = document;
  if (body.style.position === 'fixed') {
    body.style.top = `-${yClamped}px`;
  } else {
    window.scrollTo(0, yClamped);
  }
}

export function assistantReplyForPlanner(reply, slots, t) {
  const trimmed = (reply || "").trim();
  const genericEn = "Something went wrong. Please try again.";
  const genericI18n = t("aiPlanner", "errorGeneric");
  if (trimmed === genericEn || trimmed === genericI18n) {
    return "";
  }
  if (slots?.length) {
    return (trimmed || t("aiPlanner", "assistantFallback")).trim();
  }
  if (trimmed) return trimmed;
  return "";
}

export function getTourMaxScrollY() {
  if (typeof document === 'undefined') return 0;
  const vh = window.innerHeight;
  const b = document.body;
  const e = document.documentElement;
  const root = document.getElementById('root');
  const h = Math.max(
    b?.scrollHeight ?? 0,
    b?.offsetHeight ?? 0,
    e?.scrollHeight ?? 0,
    e?.offsetHeight ?? 0,
    root?.scrollHeight ?? 0,
    root?.offsetHeight ?? 0
  );
  return Math.max(0, h - vh);
}

export function apiBase() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === '' || raw == null) {
    if (typeof window !== 'undefined') return '';
    return 'http://localhost:3095';
  }
  return String(raw).replace(/\/$/, '');
}

export function buildDayGroupsForDisplay(slots, durationDays) {
  const byDay = new Map();
  slots.forEach((s, idx) => {
    const d = Math.min(durationDays - 1, Math.max(0, s.dayIndex ?? 0));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push({ s, idx });
  });
  const rows = [];
  for (let d = 0; d < durationDays; d += 1) {
    const items = (byDay.get(d) || []).sort(
      (a, b) => suggestedTimeToMinutes(a.s.suggestedTime) - suggestedTimeToMinutes(b.s.suggestedTime)
    );
    rows.push({ dayIndex: d, items });
  }
  return rows;
}

export function flattenSlotsOrdered(slots, durationDays) {
  if (!Array.isArray(slots)) return [];
  const groups = buildDayGroupsForDisplay(slots, durationDays);
  const out = [];
  for (const { dayIndex, items } of groups) {
    for (const { s } of items) {
      const di = Math.min(durationDays - 1, Math.max(0, s.dayIndex ?? dayIndex));
      out.push({
        placeId: String(s.placeId),
        dayIndex: di,
        time: normalizeSuggestedTime(s.suggestedTime),
      });
    }
  }
  return out;
}

export function buildPlanChangelog(prevSlots, nextSlots, placeById, durationDays, formatDayLabel, t) {
  if (!Array.isArray(nextSlots) || nextSlots.length === 0) return [];
  const placeName = (id) => placeById[String(id)]?.name || String(id);
  const whenLabel = (row) => {
    const dayPart = formatDayLabel(row.dayIndex);
    return dayPart ? `${dayPart} · ${row.time}` : row.time;
  };

  if (!Array.isArray(prevSlots) || prevSlots.length === 0) {
    return [
      t('aiPlanner', 'planChangeFreshStops').replace(/\{count\}/g, String(nextSlots.length)),
    ];
  }

  const a = flattenSlotsOrdered(prevSlots, durationDays);
  const b = flattenSlotsOrdered(nextSlots, durationDays);
  const sig = (row) => `${row.placeId}|${row.dayIndex}|${row.time}`;
  const toBag = (rows) => {
    const m = new Map();
    for (const row of rows) {
      const s = sig(row);
      if (!m.has(s)) m.set(s, []);
      m.get(s).push(row);
    }
    return m;
  };
  const bagA = toBag(a);
  const bagB = toBag(b);
  const removed = [];
  const added = [];
  const allSigs = new Set([...bagA.keys(), ...bagB.keys()]);
  for (const s of allSigs) {
    const na = bagA.get(s)?.length || 0;
    const nb = bagB.get(s)?.length || 0;
    const take = Math.min(na, nb);
    const ra = (bagA.get(s) || []).slice(take);
    const rb = (bagB.get(s) || []).slice(take);
    ra.forEach((row) => removed.push(row));
    rb.forEach((row) => added.push(row));
  }

  const bullets = [];
  const usedAdded = new Set();
  const usedRemoved = new Set();

  for (let i = 0; i < removed.length; i += 1) {
    if (usedRemoved.has(i)) continue;
    const r = removed[i];
    const j = added.findIndex((x, idx) => !usedAdded.has(idx) && x.placeId === r.placeId);
    if (j >= 0) {
      const ad = added[j];
      usedRemoved.add(i);
      usedAdded.add(j);
      if (r.dayIndex !== ad.dayIndex || r.time !== ad.time) {
        bullets.push(
          t('aiPlanner', 'planChangeRescheduled')
            .replace(/\{place\}/g, placeName(r.placeId))
            .replace(/\{from\}/g, whenLabel(r))
            .replace(/\{to\}/g, whenLabel(ad))
        );
      }
    }
  }

  for (let i = 0; i < removed.length; i += 1) {
    if (!usedRemoved.has(i)) {
      const r = removed[i];
      bullets.push(
        t('aiPlanner', 'planChangeRemovedStop')
          .replace(/\{place\}/g, placeName(r.placeId))
          .replace(/\{when\}/g, whenLabel(r))
      );
    }
  }

  for (let j = 0; j < added.length; j += 1) {
    if (!usedAdded.has(j)) {
      const ad = added[j];
      bullets.push(
        t('aiPlanner', 'planChangeAddedStop')
          .replace(/\{place\}/g, placeName(ad.placeId))
          .replace(/\{when\}/g, whenLabel(ad))
      );
    }
  }

  const MAX = 6;
  if (bullets.length > MAX) {
    const rest = bullets.length - MAX;
    return [
      ...bullets.slice(0, MAX),
      t('aiPlanner', 'planChangeMore').replace(/\{n\}/g, String(rest)),
    ];
  }
  if (bullets.length === 0) return [];
  return bullets;
}

export function buildPlanItineraryPlainText(slots, durationDays, placeById, dayHeaderLabelFn) {
  if (!Array.isArray(slots) || slots.length === 0) return '';
  const lines = [];
  for (const { dayIndex, items } of buildDayGroupsForDisplay(slots, durationDays)) {
    lines.push(dayHeaderLabelFn(dayIndex));
    for (const { s } of items) {
      const name = placeById[String(s.placeId)]?.name || String(s.placeId);
      lines.push(`  ${normalizeSuggestedTime(s.suggestedTime)}  ${name}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

export function buildDraftPlanContextLine(slots, placeById, durationDays) {
  if (!Array.isArray(slots) || slots.length === 0) return '';
  const groups = buildDayGroupsForDisplay(slots, durationDays);
  const parts = groups.map(({ dayIndex, items }) => {
    const label = items.length
      ? items
          .map(({ s }) => placeById[String(s.placeId)]?.name || String(s.placeId))
          .join('; ')
      : '—';
    return `Day ${dayIndex + 1}: ${label}`;
  });
  return `Draft itinerary (user may have edited times, days, or places): ${parts.join(' | ')}.`;
}

function clampIntRange(n, lo, hi) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return null;
  return Math.max(lo, Math.min(hi, x));
}

export function inferTripSettingsFromUserText(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  const next = {};

  const durationMatch =
    lower.match(/\b(\d{1,2})\s*[- ]?\s*(day|days|jour|jours)\b/i) ||
    lower.match(/\b(\d{1,2})\s*[- ]?\s*(يوم|أيام)\b/i);
  if (durationMatch?.[1]) {
    const d = clampIntRange(durationMatch[1], 1, 7);
    if (d != null) next.durationDays = d;
  }

  const placesMatch = lower.match(/\b(\d{1,2})\s*(?:x\s*)?(place|places|stop|stops)\b/i);
  if (placesMatch?.[1]) {
    const p = clampIntRange(placesMatch[1], 2, 8);
    if (p != null) next.placesPerDay = p;
  }

  if (/\blow\b/.test(lower) || /\bcheap\b/.test(lower)) next.budget = 'low';
  if (/\bmoderate\b/.test(lower) || /\bmid\b/.test(lower) || /\bmedium\b/.test(lower)) next.budget = 'moderate';
  if (/\bluxury\b/.test(lower) || /\bhigh\b/.test(lower) || /\bexpensive\b/.test(lower)) next.budget = 'luxury';

  const iso = lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (y && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const cand = new Date(y, m - 1, d);
      if (formatYMD(cand) >= todayDateOnly()) next.startDate = { y, m, d };
    }
  } else {
    const months = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
    };
    const dmy = lower.match(/\b(\d{1,2})\s*(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s*(20\d{2})\b/);
    const mdy = lower.match(/\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s*(\d{1,2})\s*(20\d{2})\b/);
    const hit = dmy
      ? { y: Number(dmy[3]), m: months[dmy[2]], d: Number(dmy[1]) }
      : mdy
        ? { y: Number(mdy[3]), m: months[mdy[1]], d: Number(mdy[2]) }
        : null;
    if (hit?.y && hit?.m && hit?.d) {
      const cand = new Date(hit.y, hit.m - 1, hit.d);
      if (formatYMD(cand) >= todayDateOnly()) next.startDate = hit;
    }
  }

  return Object.keys(next).length ? next : null;
}
