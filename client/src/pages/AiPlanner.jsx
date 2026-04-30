import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Icon from '../components/Icon';
import {
  chatForTripPlan,
  slotsToTripDays,
  AIPlannerApiError,
  normalizeSuggestedTime,
  getSlotConflictIndices,
  suggestedTimeToMinutes,
  inferTargetedReplaceSlotIndex,
} from '../services/aiPlannerService';
import {
  tripHasDateConflict,
  formatYMD,
  findOverlappingTrips,
  findNextNonOverlappingDateRange,
  clampTripStartDateLocal,
  todayDateOnly,
} from '../utils/tripPlannerHelpers';
import {
  loadPlannerMemory,
  savePlannerMemory,
  createEmptyPlannerMemory,
  recordSuccessfulPlan,
  buildUserFamiliarityBlock,
  sanitizePersonalNote,
  topMemoryCategoriesForRanker,
} from '../utils/aiPlannerUserMemory';
import { loadPlannerPrefs, savePlannerPrefs } from '../utils/aiPlannerPrefs';
import {
  isAiPlannerOnboardingDone,
  setAiPlannerOnboardingDone,
  clearAiPlannerOnboarding,
} from '../utils/aiPlannerOnboardingStorage';
import AiPlannerOnboarding from '../components/AiPlannerOnboarding';
import './css/AiPlanner.css';

function getTourEffectiveScrollY() {
  if (typeof document === 'undefined') return 0;
  const { body } = document;
  if (body.style.position === 'fixed') {
    const n = parseFloat(body.style.top);
    if (Number.isFinite(n)) return Math.max(0, -n);
    return 0;
  }
  return window.scrollY ?? document.documentElement.scrollTop ?? 0;
}

function setTourEffectiveScrollY(y) {
  const yClamped = Math.max(0, y);
  const { body } = document;
  if (body.style.position === 'fixed') {
    body.style.top = `-${yClamped}px`;
  } else {
    window.scrollTo(0, yClamped);
  }
}

function assistantReplyForPlanner(reply, slots, t) {
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

/** Full page height while the tour pins body — documentElement.scrollHeight alone often collapses to the viewport. */
function getTourMaxScrollY() {
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

function apiBase() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === '' || raw == null) {
    if (typeof window !== 'undefined') return '';
    return 'http://localhost:3095';
  }
  return String(raw).replace(/\/$/, '');
}

function buildDayGroupsForDisplay(slots, durationDays) {
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

function flattenSlotsOrdered(slots, durationDays) {
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

/**
 * Human-readable bullets comparing a previous itinerary to a new one (order, adds, removes, reschedules).
 */
function buildPlanChangelog(prevSlots, nextSlots, placeById, durationDays, formatDayLabel, t) {
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

function buildPlanItineraryPlainText(slots, durationDays, placeById, dayHeaderLabelFn) {
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

/** Compact draft summary so the model respects user edits when refining the plan. */
function buildDraftPlanContextLine(slots, placeById, durationDays) {
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

/**
 * Best-effort parse of user chat for settings like "2 days", "3 places", "low budget".
 * This updates the settings chips immediately when the user types those properties.
 */
function inferTripSettingsFromUserText(raw) {
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

  // Start date: allow "2026-04-02", "2 apr 2026", "apr 2 2026"
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
      jan: 1,
      january: 1,
      feb: 2,
      february: 2,
      mar: 3,
      march: 3,
      apr: 4,
      april: 4,
      may: 5,
      jun: 6,
      june: 6,
      jul: 7,
      july: 7,
      aug: 8,
      august: 8,
      sep: 9,
      sept: 9,
      september: 9,
      oct: 10,
      october: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12,
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

export default function AiPlanner() {
  const { t, lang } = useLanguage();
  const { settings } = useSiteSettings();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const plannerDisabled = settings.aiPlannerEnabled === false;
  const storageUserId = user?.id != null ? String(user.id) : 'anon';
  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const chipsBarRef = useRef(null);
  const [planDockDayActive, setPlanDockDayActive] = useState(0);
  const [navFabVisible, setNavFabVisible] = useState(false);

  const [places, setPlaces] = useState([]);
  const [interestsList, setInterestsList] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [aiConfigured, setAiConfigured] = useState(true);

  const [durationDays, setDurationDays] = useState(1);
  const [placesPerDay, setPlacesPerDay] = useState(4);
  const [budget, setBudget] = useState('moderate');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [interestIds, setInterestIds] = useState(() => new Set());
  const [plannerPrefsReady, setPlannerPrefsReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState(false);

  const [lastSlots, setLastSlots] = useState(null);
  const [lastPlaces, setLastPlaces] = useState(null);
  const [placePicker, setPlacePicker] = useState(null);
  const [placeSearch, setPlaceSearch] = useState('');
  const [aiReplaceSheet, setAiReplaceSheet] = useState(null);
  const [aiReplaceNote, setAiReplaceNote] = useState('');
  /** After AI returns a new/changed itinerary — prompt review & save */
  const [highlightFreshPlan, setHighlightFreshPlan] = useState(false);
  const [routeOverviewOpen, setRouteOverviewOpen] = useState(true);
  const [planFeedback, setPlanFeedback] = useState(null);
  const [planFeedbackNote, setPlanFeedbackNote] = useState('');
  const [planFeedbackNoteSent, setPlanFeedbackNoteSent] = useState(false);
  const [planChangelog, setPlanChangelog] = useState(null);
  const [activeChipEditor, setActiveChipEditor] = useState(null);
  const routeOverviewRef = useRef(null);
  const tourSettingsBtnRef = useRef(null);
  const tourBriefRef = useRef(null);
  const tourMoodsRef = useRef(null);
  const tourStudioRef = useRef(null);
  const tourPlanRef = useRef(null);
  const tourSaveRef = useRef(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourHighlightRect, setTourHighlightRect] = useState(null);

  const [plannerMemory, setPlannerMemory] = useState(() => createEmptyPlannerMemory());
  const [profilePlannerHints, setProfilePlannerHints] = useState({});
  const saveNoteTimeoutRef = useRef(null);

  const moodCards = useMemo(
    () => [
      { icon: 'museum', label: t('aiPlanner', 'moodCulture'), prompt: t('aiPlanner', 'moodCulturePrompt') },
      { icon: 'restaurant', label: t('aiPlanner', 'moodFood'), prompt: t('aiPlanner', 'moodFoodPrompt') },
      { icon: 'mosque', label: t('aiPlanner', 'moodFaith'), prompt: t('aiPlanner', 'moodFaithPrompt') },
      { icon: 'storefront', label: t('aiPlanner', 'moodSouk'), prompt: t('aiPlanner', 'moodSoukPrompt') },
      { icon: 'auto_awesome', label: t('aiPlanner', 'moodSurprise'), prompt: t('aiPlanner', 'moodSurprisePrompt') },
    ],
    [t]
  );

  const placeById = useMemo(() => {
    const m = {};
    places.forEach((p) => {
      m[String(p.id)] = p;
    });
    return m;
  }, [places]);


  useEffect(() => {
    const base = apiBase();
    fetch(`${base}/api/ai/status`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setAiConfigured(Boolean(j?.available)))
      .catch(() => setAiConfigured(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    Promise.all([
      api.places.list({ lang: langParam }),
      api.interests.list({ lang: langParam }),
    ])
      .then(([pres, ires]) => {
        if (cancelled) return;
        const list = pres.popular || pres.locations || [];
        setPlaces(Array.isArray(list) ? list : []);
        setInterestsList(Array.isArray(ires.interests) ? ires.interests : []);
      })
      .catch(() => {
        if (!cancelled) {
          setPlaces([]);
          setInterestsList([]);
        }
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [langParam]);

  useEffect(() => {
    setPlannerMemory(loadPlannerMemory(storageUserId));
  }, [storageUserId]);

  useEffect(() => {
    const p = loadPlannerPrefs(storageUserId);
    if (p) {
      if (p.durationDays != null) setDurationDays(p.durationDays);
      if (p.placesPerDay != null) setPlacesPerDay(p.placesPerDay);
      if (p.budget != null) setBudget(p.budget);
      if (p.startDate) {
        const parts = p.startDate.slice(0, 10).split('-').map(Number);
        const [y, mo, da] = parts;
        if (y && mo && da) setSelectedDate(clampTripStartDateLocal(new Date(y, mo - 1, da)));
      }
      if (Array.isArray(p.interestIds) && p.interestIds.length > 0) {
        setInterestIds(new Set(p.interestIds));
      }
    }
    setPlannerPrefsReady(true);
    return () => {
      setPlannerPrefsReady(false);
    };
  }, [storageUserId]);

  const interestIdsForPrefs = useMemo(() => [...interestIds].sort().join(','), [interestIds]);

  useEffect(() => {
    if (!plannerPrefsReady) return;
    savePlannerPrefs(storageUserId, {
      durationDays,
      placesPerDay,
      budget,
      startDate: formatYMD(selectedDate),
      interestIds: interestIdsForPrefs ? interestIdsForPrefs.split(',') : [],
    });
  }, [
    plannerPrefsReady,
    storageUserId,
    durationDays,
    placesPerDay,
    budget,
    selectedDate,
    interestIdsForPrefs,
  ]);

  useEffect(() => {
    if (!user?.id) {
      setProfilePlannerHints({});
      return undefined;
    }
    let cancelled = false;
    api.user
      .profile()
      .then((p) => {
        if (cancelled) return;
        setProfilePlannerHints({
          city: p.city || '',
          mood: p.mood || '',
          pace: p.pace || '',
        });
      })
      .catch(() => {
        if (!cancelled) setProfilePlannerHints({});
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(
    () => () => {
      if (saveNoteTimeoutRef.current) clearTimeout(saveNoteTimeoutRef.current);
    },
    []
  );

  const userFamiliarityBlock = useMemo(
    () =>
      buildUserFamiliarityBlock({
        memory: plannerMemory,
        profileHints: profilePlannerHints,
      }),
    [plannerMemory, profilePlannerHints]
  );

  const learnedCategoryHints = useMemo(
    () => topMemoryCategoriesForRanker(plannerMemory, 5),
    [plannerMemory]
  );

  const updatePlannerPersonalNote = useCallback(
    (raw) => {
      const personalNote = sanitizePersonalNote(raw);
      setPlannerMemory((prev) => {
        const next = { ...prev, personalNote };
        if (saveNoteTimeoutRef.current) clearTimeout(saveNoteTimeoutRef.current);
        saveNoteTimeoutRef.current = setTimeout(() => {
          savePlannerMemory(storageUserId, next);
          saveNoteTimeoutRef.current = null;
        }, 450);
        return next;
      });
    },
    [storageUserId]
  );

  const clearPlannerLearnedMemory = useCallback(() => {
    if (!window.confirm(t('aiPlanner', 'visitorMemoryClearConfirm'))) return;
    if (saveNoteTimeoutRef.current) {
      clearTimeout(saveNoteTimeoutRef.current);
      saveNoteTimeoutRef.current = null;
    }
    const empty = createEmptyPlannerMemory();
    setPlannerMemory(empty);
    savePlannerMemory(storageUserId, empty);
  }, [storageUserId, t]);

  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.role !== 'assistant' || !Array.isArray(m.slots)) continue;
      if (m.slots.length > 0) {
        const resolved = m.slots.map((s) => placeById[s.placeId]).filter(Boolean);
        setLastSlots(m.slots);
        setLastPlaces(resolved.length ? resolved : null);
      } else {
        setLastSlots(null);
        setLastPlaces(null);
      }
      return;
    }
    setLastSlots(null);
    setLastPlaces(null);
  }, [messages, placeById]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const applyAiTripSettingsToState = useCallback(
    (tripSettings) => {
      if (!tripSettings) return;
      if (tripSettings.durationDays != null) setDurationDays(tripSettings.durationDays);
      if (tripSettings.placesPerDay != null) setPlacesPerDay(tripSettings.placesPerDay);
      if (tripSettings.budget != null) setBudget(tripSettings.budget);
      if (tripSettings.startDate)
        setSelectedDate(new Date(`${tripSettings.startDate}T12:00:00`));
      if (tripSettings.interestNames?.length && interestsList.length > 0) {
        setInterestIds((prev) => {
          const next = new Set(prev);
          const lower = (s) => String(s).toLowerCase().trim();
          for (const raw of tripSettings.interestNames) {
            const q = lower(raw);
            const hit = interestsList.find((i) => {
              const n = lower(i.name || '');
              return n === q || n.includes(q) || q.includes(n);
            });
            if (hit) next.add(String(hit.id));
          }
          return next;
        });
      }
    },
    [interestsList]
  );

  useEffect(() => {
    if (!activeChipEditor) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setActiveChipEditor(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeChipEditor]);

  useEffect(() => {
    if (!activeChipEditor) return;
    const onPointerDown = (e) => {
      if (chipsBarRef.current && !chipsBarRef.current.contains(e.target)) {
        setActiveChipEditor(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [activeChipEditor]);

  useEffect(() => {
    if (!activeChipEditor) return;
    const id = `ai-chip-field-${activeChipEditor}`;
    requestAnimationFrame(() => {
      document.getElementById(id)?.focus?.();
    });
  }, [activeChipEditor]);

  useEffect(() => {
    setPlacePicker(null);
  }, [messages]);

  const interestNames = useMemo(() => {
    const names = [];
    interestsList.forEach((i) => {
      if (interestIds.has(String(i.id))) names.push(i.name || String(i.id));
    });
    return names;
  }, [interestsList, interestIds]);

  const tripBriefSummary = useMemo(() => {
    const parts = [];
    parts.push(durationDays === 1 ? t('aiPlanner', 'oneDay') : `${durationDays} ${t('aiPlanner', 'days')}`);
    parts.push(`${placesPerDay} ${t('aiPlanner', 'perDay')}`);
    parts.push(
      budget === 'low'
        ? t('aiPlanner', 'budgetLow')
        : budget === 'luxury'
          ? t('aiPlanner', 'budgetLuxury')
          : t('aiPlanner', 'budgetModerate')
    );
    parts.push(
      selectedDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    );
    if (interestNames.length > 0) parts.push(interestNames.join(', '));
    return parts.filter(Boolean);
  }, [durationDays, placesPerDay, budget, selectedDate, interestNames, t]);

  const buildGuidedPlannerPrompt = useCallback(
    (intent = '') => {
      const budgetLabel =
        budget === 'low'
          ? t('aiPlanner', 'budgetLow')
          : budget === 'luxury'
            ? t('aiPlanner', 'budgetLuxury')
            : t('aiPlanner', 'budgetModerate');
      const lines = [
        t('aiPlanner', 'guidedPromptDaysStops')
          .replace(/\{days\}/g, String(durationDays))
          .replace(/\{ppd\}/g, String(placesPerDay)),
        t('aiPlanner', 'guidedPromptBudgetLine').replace(/\{budget\}/g, budgetLabel),
        t('aiPlanner', 'guidedPromptStartDate').replace(/\{date\}/g, formatYMD(selectedDate)),
        interestNames.length
          ? t('aiPlanner', 'guidedPromptFocusInterests').replace(/\{list\}/g, interestNames.join(', '))
          : t('aiPlanner', 'guidedPromptBalancedMix'),
        plannerMemory.personalNote
          ? t('aiPlanner', 'guidedPromptTravelerNote').replace(/\{note\}/g, plannerMemory.personalNote)
          : '',
        intent || t('aiPlanner', 'guidedPromptDefaultClose'),
      ].filter(Boolean);
      return lines.join(' ');
    },
    [durationDays, placesPerDay, budget, selectedDate, interestNames, plannerMemory.personalNote, t]
  );

  const lastPlanMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.role === 'assistant' && Array.isArray(m.slots)) return i;
    }
    return -1;
  }, [messages]);

  const latestUserMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'user') return messages[i];
    }
    return null;
  }, [messages]);

  const latestAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);

  const planConflicts = useMemo(
    () => (lastSlots?.length ? getSlotConflictIndices(lastSlots) : new Set()),
    [lastSlots]
  );

  const TOUR_STEP_COUNT = 8;

  const tourStepMeta = useMemo(() => {
    const hasPlan = Boolean(lastSlots?.length);
    return [
      { title: t('aiPlanner', 'onboardingWelcomeTitle'), body: t('aiPlanner', 'onboardingWelcomeBody'), target: null },
      { title: t('aiPlanner', 'onboardingSettingsTitle'), body: t('aiPlanner', 'onboardingSettingsBody'), target: 'settings' },
      { title: t('aiPlanner', 'onboardingChipsTitle'), body: t('aiPlanner', 'onboardingChipsBody'), target: 'chips' },
      { title: t('aiPlanner', 'onboardingBriefTitle'), body: t('aiPlanner', 'onboardingBriefBody'), target: 'brief' },
      { title: t('aiPlanner', 'onboardingMoodsTitle'), body: t('aiPlanner', 'onboardingMoodsBody'), target: 'moods' },
      { title: t('aiPlanner', 'onboardingStudioTitle'), body: t('aiPlanner', 'onboardingStudioBody'), target: 'studio' },
      {
        title: hasPlan ? t('aiPlanner', 'onboardingPlanTitle') : t('aiPlanner', 'onboardingPlanWaitTitle'),
        body: hasPlan ? t('aiPlanner', 'onboardingPlanBody') : t('aiPlanner', 'onboardingPlanWaitBody'),
        target: hasPlan ? 'plan' : null,
      },
      {
        title: hasPlan ? t('aiPlanner', 'onboardingSaveTitle') : t('aiPlanner', 'onboardingSaveWaitTitle'),
        body: hasPlan ? t('aiPlanner', 'onboardingSaveBody') : t('aiPlanner', 'onboardingSaveWaitBody'),
        target: hasPlan ? 'save' : null,
      },
    ];
  }, [t, lastSlots?.length]);

  const tourRefMap = useMemo(
    () => ({
      settings: tourSettingsBtnRef,
      chips: chipsBarRef,
      brief: tourBriefRef,
      moods: tourMoodsRef,
      studio: tourStudioRef,
      plan: tourPlanRef,
      save: tourSaveRef,
    }),
    []
  );

  const syncTourHighlightForStep = useCallback(() => {
    if (!tourOpen) return;
    const meta = tourStepMeta[tourStep];
    const key = meta?.target;
    const ref = key ? tourRefMap[key] : null;
    if (!key || !ref?.current) {
      setTourHighlightRect(null);
      return;
    }
    const el = ref.current;
    const vh = window.innerHeight;
    const marginTop = 76;
    const marginBottom = Math.min(340, Math.max(220, Math.round(vh * 0.36)));
    const maxScroll = getTourMaxScrollY();

    const applyScrollForRect = () => {
      const effectiveNow = getTourEffectiveScrollY();
      const rect = el.getBoundingClientRect();
      const elTopDoc = rect.top + effectiveNow;
      const elBottomDoc = rect.bottom + effectiveNow;
      const sLow = elBottomDoc - (vh - marginBottom);
      const sHigh = elTopDoc - marginTop;
      let s = effectiveNow;
      if (sLow <= sHigh) {
        s = Math.min(sHigh, Math.max(sLow, effectiveNow));
      } else {
        s = (elTopDoc + elBottomDoc - vh) / 2;
      }
      s = Math.max(0, Math.min(maxScroll, s));
      if (Math.abs(s - effectiveNow) > 0.5) {
        setTourEffectiveScrollY(s);
        return true;
      }
      return false;
    };

    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (!applyScrollForRect()) break;
    }

    const rect = el.getBoundingClientRect();
    setTourHighlightRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [tourOpen, tourStep, tourStepMeta, tourRefMap]);

  useLayoutEffect(() => {
    if (!tourOpen) {
      setTourHighlightRect(null);
      return;
    }
    let cancelled = false;
    syncTourHighlightForStep();
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      syncTourHighlightForStep();
      requestAnimationFrame(() => {
        if (!cancelled) syncTourHighlightForStep();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [tourOpen, tourStep, syncTourHighlightForStep]);

  useEffect(() => {
    if (!tourOpen) return undefined;
    const onResize = () => syncTourHighlightForStep();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [tourOpen, syncTourHighlightForStep]);

  useEffect(() => {
    if (dataLoading || !plannerPrefsReady || plannerDisabled) return undefined;
    if (!aiConfigured) return undefined;
    if (isAiPlannerOnboardingDone(storageUserId)) return undefined;
    const id = window.setTimeout(() => setTourOpen(true), 450);
    return () => clearTimeout(id);
  }, [dataLoading, plannerPrefsReady, plannerDisabled, aiConfigured, storageUserId]);

  const finishTour = useCallback(() => {
    setTourOpen(false);
    setTourStep(0);
    setAiPlannerOnboardingDone(storageUserId);
  }, [storageUserId]);

  const startTour = useCallback(() => {
    clearAiPlannerOnboarding(storageUserId);
    setTourStep(0);
    setTourOpen(true);
  }, [storageUserId]);

  const formatChangelogDay = useCallback(
    (dayIndex) => {
      if (durationDays <= 1) return '';
      return `${t('aiPlanner', 'dayLabel')} ${dayIndex + 1}`;
    },
    [durationDays, t]
  );

  const clampSlot = useCallback(
    (s) => ({
      ...s,
      placeId: String(s.placeId),
      suggestedTime: normalizeSuggestedTime(s.suggestedTime),
      dayIndex: Math.min(durationDays - 1, Math.max(0, s.dayIndex ?? 0)),
      reason: s.reason != null ? String(s.reason) : null,
    }),
    [durationDays]
  );

  const patchSlotField = useCallback(
    (messageIndex, slotIndex, patch) => {
      setHighlightFreshPlan(false);
      setPlanChangelog(null);
      setMessages((prev) => {
        const m = prev[messageIndex];
        if (!m?.slots || slotIndex < 0 || slotIndex >= m.slots.length) return prev;
        const slots = m.slots.map((row, j) =>
          j === slotIndex ? clampSlot({ ...row, ...patch }) : clampSlot(row)
        );
        const newPlaces = slots.map((s) => placeById[s.placeId]).filter(Boolean);
        const next = [...prev];
        next[messageIndex] = { ...m, slots, places: newPlaces };
        return next;
      });
    },
    [clampSlot, placeById]
  );

  const deleteSlotAt = useCallback(
    (messageIndex, slotIndex) => {
      setHighlightFreshPlan(false);
      setPlanChangelog(null);
      setMessages((prev) => {
        const m = prev[messageIndex];
        if (!m?.slots) return prev;
        const slots = m.slots.filter((_, j) => j !== slotIndex).map(clampSlot);
        const newPlaces = slots.map((s) => placeById[s.placeId]).filter(Boolean);
        const next = [...prev];
        next[messageIndex] = { ...m, slots, places: newPlaces };
        return next;
      });
    },
    [clampSlot, placeById]
  );

  /** When trip length shrinks, clamp day indices on the latest plan in one pass. */
  useEffect(() => {
    setMessages((prev) => {
      let idx = -1;
      for (let i = prev.length - 1; i >= 0; i -= 1) {
        if (prev[i].role === 'assistant' && Array.isArray(prev[i].slots)) {
          idx = i;
          break;
        }
      }
      if (idx < 0) return prev;
      const m = prev[idx];
      if (!m?.slots?.length) return prev;
      const slots = m.slots.map((row) => clampSlot({ ...row }));
      const changed = slots.some((s, j) => s.dayIndex !== m.slots[j].dayIndex);
      if (!changed) return prev;
      const newPlaces = slots.map((s) => placeById[s.placeId]).filter(Boolean);
      const next = [...prev];
      next[idx] = { ...m, slots, places: newPlaces };
      return next;
    });
  }, [durationDays, clampSlot, placeById]);

  useEffect(() => {
    if (durationDays > 0) {
      setPlanDockDayActive((d) => Math.min(Math.max(0, d), durationDays - 1));
    }
  }, [durationDays]);

  const conversationHistory = useMemo(
    () =>
      messages.map((m) => {
        let content = m.content ?? '';
        if (
          m.role === 'assistant' &&
          Array.isArray(m.slots) &&
          m.slots.length > 0 &&
          !String(content).trim()
        ) {
          content =
            '(Prior turn: itinerary was returned as PLAN_JSON; the user edits it in the itinerary studio.)';
        }
        return { role: m.role, content };
      }),
    [messages]
  );

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = (text || '').trim();
      if (!trimmed || sending || dataLoading) return;

      const inferred = inferTripSettingsFromUserText(trimmed);
      if (inferred?.durationDays != null) setDurationDays(inferred.durationDays);
      if (inferred?.placesPerDay != null) setPlacesPerDay(inferred.placesPerDay);
      if (inferred?.budget) setBudget(inferred.budget);

      const mergedStart =
        inferred?.startDate != null
          ? new Date(inferred.startDate.y, inferred.startDate.m - 1, inferred.startDate.d)
          : selectedDate;
      const tripStartForApi = clampTripStartDateLocal(mergedStart);
      if (formatYMD(tripStartForApi) !== formatYMD(selectedDate)) {
        setSelectedDate(tripStartForApi);
      }

      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setInput('');
      setSending(true);

      try {
        const draftCtx =
          lastSlots?.length > 0 ? buildDraftPlanContextLine(lastSlots, placeById, durationDays) : '';
        const targetedReplace =
          Array.isArray(lastSlots) && lastSlots.length > 0
            ? inferTargetedReplaceSlotIndex(trimmed, lastSlots, durationDays, placeById)
            : null;
        const focusSlot =
          targetedReplace != null && lastSlots[targetedReplace]
            ? placeById[String(lastSlots[targetedReplace].placeId)]
            : null;
        const singleStopFocusCtx =
          targetedReplace != null && focusSlot
            ? ` Focused edit: change only itinerary slot index ${targetedReplace} (currently "${focusSlot.name}"); all other slots must stay the same unless the user clearly asked to replan everything.`
            : '';
        const activityContext = [
          interestNames.length > 0 ? `User selected interest themes: ${interestNames.join(', ')}.` : '',
          draftCtx,
          singleStopFocusCtx,
        ]
          .filter(Boolean)
          .join(' ');

        const { text: reply, slots, tripSettings } = await chatForTripPlan({
          conversationHistory,
          userMessage: trimmed,
          places,
          durationDays,
          placesPerDay,
          budget,
          selectedDate: tripStartForApi,
          userInterests: interestNames,
          activityContext,
          responseLanguage: langParam,
          previousSlots: lastSlots,
          previousPlaces: lastPlaces,
          singleReplaceSlotIndex: targetedReplace,
          userFamiliarityBlock,
          learnedCategoryHints,
        });

        applyAiTripSettingsToState(tripSettings);

        let resolvedPlaces = null;
        if (slots?.length) {
          resolvedPlaces = slots.map((s) => placeById[s.placeId]).filter(Boolean);
        }

        const assistantContent = assistantReplyForPlanner(reply, slots, t);

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: assistantContent,
            slots: slots || null,
            places: resolvedPlaces,
          },
        ]);

        if (slots?.length) {
          const changelog = buildPlanChangelog(
            lastSlots,
            slots,
            placeById,
            durationDays,
            formatChangelogDay,
            t
          );
          setPlanChangelog(changelog.length ? changelog : null);
          setHighlightFreshPlan(true);
          setRouteOverviewOpen(true);
          setPlanFeedback(null);
          setPlanFeedbackNote('');
          setPlanFeedbackNoteSent(false);
          showToast(t('aiPlanner', 'planUpdatedToast'), 'info');
          setPlannerMemory((prev) => {
            const next = recordSuccessfulPlan(prev, slots, placeById);
            savePlannerMemory(storageUserId, next);
            return next;
          });
        }
      } catch (e) {
        const msg =
          e instanceof AIPlannerApiError
            ? e.message
            : t('aiPlanner', 'errorGeneric');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: msg, error: true, retryText: trimmed },
        ]);
      } finally {
        setSending(false);
      }
    },
    [
      sending,
      dataLoading,
      conversationHistory,
      places,
      durationDays,
      placesPerDay,
      budget,
      selectedDate,
      interestNames,
      langParam,
      lastSlots,
      lastPlaces,
      placeById,
      t,
      applyAiTripSettingsToState,
      userFamiliarityBlock,
      storageUserId,
      learnedCategoryHints,
      showToast,
      formatChangelogDay,
    ]
  );

  const runAiReplaceStop = useCallback(async () => {
    if (!aiReplaceSheet || sending || dataLoading || !aiConfigured) return;
    const { messageIndex, slotIndex } = aiReplaceSheet;
    const prevMsg = messages[messageIndex];
    if (!prevMsg?.slots?.length || slotIndex < 0 || slotIndex >= prevMsg.slots.length) return;

    const pl = placeById[prevMsg.slots[slotIndex]?.placeId];
    const placeName = pl?.name || String(prevMsg.slots[slotIndex]?.placeId || '');
    const stopDay = Math.min(
      durationDays - 1,
      Math.max(0, prevMsg.slots[slotIndex]?.dayIndex ?? 0)
    );
    const dayLead =
      durationDays > 1 ? `${t('aiPlanner', 'dayLabel')} ${stopDay + 1} · ` : '';
    const note = (aiReplaceNote || '').trim();
    const userLine =
      `${t('aiPlanner', 'aiReplaceStopLead')} ${dayLead}${placeName}. ${note || t('aiPlanner', 'aiReplaceDefaultIntent')}`.trim();

    const inferred = inferTripSettingsFromUserText(userLine);
    if (inferred?.durationDays != null) setDurationDays(inferred.durationDays);
    if (inferred?.placesPerDay != null) setPlacesPerDay(inferred.placesPerDay);
    if (inferred?.budget) setBudget(inferred.budget);

    const mergedReplaceStart =
      inferred?.startDate != null
        ? new Date(inferred.startDate.y, inferred.startDate.m - 1, inferred.startDate.d)
        : selectedDate;
    const tripStartForReplaceApi = clampTripStartDateLocal(mergedReplaceStart);
    if (formatYMD(tripStartForReplaceApi) !== formatYMD(selectedDate)) {
      setSelectedDate(tripStartForReplaceApi);
    }

    setAiReplaceSheet(null);
    setAiReplaceNote('');
    setSending(true);
    setMessages((p) => [...p, { role: 'user', content: userLine }]);

    try {
      const previousSlotsSnapshot = prevMsg.slots.map((s) => ({ ...s }));
      const draftCtx = buildDraftPlanContextLine(previousSlotsSnapshot, placeById, durationDays);
      const activityContext = [
        interestNames.length > 0 ? `User selected interest themes: ${interestNames.join(', ')}.` : '',
        draftCtx,
      ]
        .filter(Boolean)
        .join(' ');

      const { text: reply, slots, tripSettings } = await chatForTripPlan({
        conversationHistory,
        userMessage: userLine,
        places,
        durationDays,
        placesPerDay,
        budget,
        selectedDate: tripStartForReplaceApi,
        userInterests: interestNames,
        activityContext,
        responseLanguage: langParam,
        previousSlots: previousSlotsSnapshot,
        previousPlaces: previousSlotsSnapshot.map((s) => placeById[s.placeId]).filter(Boolean),
        singleReplaceSlotIndex: slotIndex,
        userFamiliarityBlock,
        learnedCategoryHints,
      });

      applyAiTripSettingsToState(tripSettings);

      let resolvedPlaces = null;
      if (slots?.length) {
        resolvedPlaces = slots.map((s) => placeById[s.placeId]).filter(Boolean);
      }

      const assistantContent = assistantReplyForPlanner(reply, slots, t);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantContent,
          slots: slots || null,
          places: resolvedPlaces,
        },
      ]);

      if (slots?.length) {
        const changelog = buildPlanChangelog(
          previousSlotsSnapshot,
          slots,
          placeById,
          durationDays,
          formatChangelogDay,
          t
        );
        setPlanChangelog(changelog.length ? changelog : null);
        setHighlightFreshPlan(true);
        setRouteOverviewOpen(true);
        setPlanFeedback(null);
        setPlanFeedbackNote('');
        setPlanFeedbackNoteSent(false);
        showToast(t('aiPlanner', 'planUpdatedToast'), 'info');
        setPlannerMemory((prev) => {
          const next = recordSuccessfulPlan(prev, slots, placeById);
          savePlannerMemory(storageUserId, next);
          return next;
        });
      }
    } catch (e) {
      const errMsg =
        e instanceof AIPlannerApiError ? e.message : t('aiPlanner', 'errorGeneric');
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg, error: true }]);
    } finally {
      setSending(false);
    }
  }, [
    aiReplaceSheet,
    aiReplaceNote,
    sending,
    dataLoading,
    aiConfigured,
    messages,
    placeById,
    conversationHistory,
    places,
    durationDays,
    placesPerDay,
    budget,
    selectedDate,
    interestNames,
    langParam,
    t,
    applyAiTripSettingsToState,
    userFamiliarityBlock,
    storageUserId,
    learnedCategoryHints,
    showToast,
    formatChangelogDay,
  ]);

  const pushDateOverlapAssistantMessage = useCallback(
    (startStr, endStr, existingTrips) => {
      const overlapTrips = findOverlappingTrips(existingTrips, startStr, endStr, null);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t('home', 'tripDateOverlap'),
          error: true,
          overlapTrips,
          overlapRange: { startStr, endStr },
        },
      ]);
    },
    [t]
  );

  const handleDeleteOverlapTrip = useCallback(
    async (tripId, messageIndex) => {
      const row = messages[messageIndex];
      const tripMeta = row?.overlapTrips?.find((x) => String(x.id) === String(tripId));
      const name = (tripMeta?.name && String(tripMeta.name).trim()) || t('aiPlanner', 'unnamedTrip');
      if (!window.confirm(t('aiPlanner', 'overlapDeleteConfirm').replace(/\{name\}/g, name))) return;
      try {
        await api.user.deleteTrip(tripId);
        const range = row?.overlapRange;
        if (!range?.startStr || !range?.endStr) {
          setMessages((prev) =>
            prev.map((m, j) =>
              j === messageIndex
                ? {
                    role: 'assistant',
                    content: t('aiPlanner', 'overlapResolvedRetrySave'),
                    error: false,
                  }
                : m
            )
          );
          return;
        }
        const tripsRes = await api.user.trips();
        const existing = tripsRes.trips || [];
        const still = findOverlappingTrips(existing, range.startStr, range.endStr, null);
        if (still.length === 0) {
          setMessages((prev) =>
            prev.map((m, j) =>
              j === messageIndex
                ? {
                    role: 'assistant',
                    content: t('aiPlanner', 'overlapResolvedRetrySave'),
                    error: false,
                  }
                : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m, j) => (j === messageIndex ? { ...m, overlapTrips: still } : m))
          );
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: t('aiPlanner', 'applyFailed'), error: true },
        ]);
      }
    },
    [messages, t]
  );

  const handleShiftOverlapDates = useCallback(
    async (messageIndex) => {
      const row = messages[messageIndex];
      const range = row?.overlapRange;
      if (!range?.startStr || !range?.endStr) return;
      try {
        const tripsRes = await api.user.trips();
        const existing = tripsRes.trips || [];
        const nextRange = findNextNonOverlappingDateRange(
          existing,
          range.startStr,
          range.endStr
        );
        if (!nextRange) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: t('aiPlanner', 'overlapNoFreeRange'),
              error: true,
            },
          ]);
          return;
        }
        setSelectedDate(clampTripStartDateLocal(new Date(`${nextRange.startDate}T12:00:00`)));
        setMessages((prev) =>
          prev.map((m, j) =>
            j === messageIndex
              ? {
                  role: 'assistant',
                  content: t('aiPlanner', 'overlapDatesShifted')
                    .replace(/\{start\}/g, nextRange.startDate)
                    .replace(/\{end\}/g, nextRange.endDate),
                  error: false,
                }
              : m
          )
        );
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: t('aiPlanner', 'applyFailed'), error: true },
        ]);
      }
    },
    [messages, t]
  );

  const handleApplyTrip = useCallback(async () => {
    if (!lastSlots?.length || applying || planConflicts.size > 0) return;
    const tripStart = clampTripStartDateLocal(selectedDate);
    if (formatYMD(selectedDate) < todayDateOnly()) {
      setSelectedDate(tripStart);
      showToast(t('aiPlanner', 'pastStartDateNotAllowed'), 'error');
      return;
    }
    setApplying(true);
    try {
      const days = slotsToTripDays(lastSlots, durationDays, tripStart);
      const end = new Date(tripStart);
      end.setDate(end.getDate() + durationDays - 1);
      const startStr = formatYMD(tripStart);
      const endStr = formatYMD(end);
      const tripsRes = await api.user.trips();
      const existingTrips = tripsRes.trips || [];
      if (tripHasDateConflict(existingTrips, startStr, endStr, null)) {
        pushDateOverlapAssistantMessage(startStr, endStr, existingTrips);
        return;
      }
      const trip = await api.user.createTrip({
        name: t('aiPlanner', 'tripNameDefault'),
        startDate: startStr,
        endDate: endStr,
        description: t('aiPlanner', 'tripDescriptionAi'),
        days,
      });
      showToast(t('feedback', 'aiTripSaved'), 'success');
      navigate(`/plan?edit=${encodeURIComponent(trip.id)}`);
    } catch (e) {
      const overlap = e?.data?.code === 'TRIP_DATE_OVERLAP';
      if (overlap) {
        try {
          const end = new Date(tripStart);
          end.setDate(end.getDate() + durationDays - 1);
          const startStr = formatYMD(tripStart);
          const endStr = formatYMD(end);
          const tripsRes = await api.user.trips();
          pushDateOverlapAssistantMessage(startStr, endStr, tripsRes.trips || []);
        } catch {
          const end = new Date(tripStart);
          end.setDate(end.getDate() + durationDays - 1);
          const startStr = formatYMD(tripStart);
          const endStr = formatYMD(end);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: t('home', 'tripDateOverlap'),
              error: true,
              overlapTrips: [],
              overlapRange: { startStr, endStr },
            },
          ]);
        }
      } else {
        showToast(e.message || t('aiPlanner', 'applyFailed'), 'error');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: e.message || t('aiPlanner', 'applyFailed'),
            error: true,
          },
        ]);
      }
    } finally {
      setApplying(false);
    }
  }, [
    lastSlots,
    durationDays,
    selectedDate,
    applying,
    navigate,
    t,
    planConflicts,
    pushDateOverlapAssistantMessage,
    showToast,
  ]);

  const dayHeaderLabel = useCallback(
    (dayIndex) => {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + dayIndex);
      const ds = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      if (durationDays > 1) return `${t('aiPlanner', 'dayLabel')} ${dayIndex + 1} · ${ds}`;
      return ds;
    },
    [selectedDate, durationDays, t]
  );

  const scrollToRouteOverview = useCallback(() => {
    setRouteOverviewOpen(true);
    window.requestAnimationFrame(() => {
      routeOverviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const copyItineraryFromSlots = useCallback(
    (slots) => {
      const text = buildPlanItineraryPlainText(slots, durationDays, placeById, dayHeaderLabel);
      if (!text) return;
      const p = navigator.clipboard?.writeText(text);
      if (p) {
        p.then(
          () => showToast(t('aiPlanner', 'copyItineraryDone'), 'success'),
          () => showToast(t('aiPlanner', 'copyItineraryFail'), 'error')
        );
      } else {
        showToast(t('aiPlanner', 'copyItineraryFail'), 'error');
      }
    },
    [durationDays, placeById, dayHeaderLabel, showToast, t]
  );

  const filteredPickerPlaces = useMemo(() => {
    const q = placeSearch.trim().toLowerCase();
    if (!q) return places.slice(0, 80);
    return places
      .filter((p) => {
        const name = (p.name || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        return name.includes(q) || cat.includes(q);
      })
      .slice(0, 80);
  }, [places, placeSearch]);

  const dateStrForChip = selectedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const budgetChipLabel =
    budget === 'low'
      ? t('aiPlanner', 'budgetLow')
      : budget === 'luxury'
        ? t('aiPlanner', 'budgetLuxury')
        : t('aiPlanner', 'budgetModerate');

  const toggleChipEditor = useCallback((key) => {
    setActiveChipEditor((prev) => (prev === key ? null : key));
  }, []);

  const showPlanDayDock = lastSlots?.length > 0 && lastPlanMessageIndex >= 0;

  const scrollToPlanDaySection = useCallback(
    (dayIndex) => {
      const safe = Math.min(durationDays - 1, Math.max(0, dayIndex));
      const mi = lastPlanMessageIndex;
      if (mi < 0) return;
      const id =
        durationDays > 1 ? `ai-planner-plan-${mi}-day-${safe}` : `ai-planner-plan-${mi}-anchor`;
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      setPlanDockDayActive(safe);
    },
    [durationDays, lastPlanMessageIndex]
  );

  useEffect(() => {
    if (!showPlanDayDock || durationDays <= 1 || lastPlanMessageIndex < 0) return undefined;
    const mi = lastPlanMessageIndex;
    const nodes = Array.from({ length: durationDays }, (_, d) =>
      document.getElementById(`ai-planner-plan-${mi}-day-${d}`)
    ).filter(Boolean);
    if (nodes.length === 0) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0.06)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top?.target?.id) {
          const m = new RegExp(`^ai-planner-plan-${mi}-day-(\\d+)$`).exec(top.target.id);
          if (m) setPlanDockDayActive(Number(m[1], 10));
        }
      },
      { threshold: [0.08, 0.18, 0.35], rootMargin: '-10% 0px -48% 0px' }
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [showPlanDayDock, durationDays, lastPlanMessageIndex, messages.length]);

  const dockBottomOffset = 0;
  /** Day-dock row (tabs + save) sits above composer; keep FAB fully above that band. */
  const AI_PLANNER_DAY_DOCK_STACK_PX = 88;
  const navFabBottomPx =
    dockBottomOffset + (showPlanDayDock ? AI_PLANNER_DAY_DOCK_STACK_PX : 0) + 14;

  useEffect(() => {
    const onScroll = () => setNavFabVisible(window.scrollY > 160);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToSiteNav = useCallback(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const behavior = reduce ? 'auto' : 'smooth';
    const el = document.getElementById('site-header');
    if (el) {
      el.scrollIntoView({ behavior, block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  }, []);

  if (plannerDisabled) return <Navigate to="/plan" replace />;

  return (
    <div className={`ai-planner${showPlanDayDock ? ' ai-planner--day-dock' : ''}`}>
      <header className="ai-planner__page-head">
        <Link to="/plan" className="ai-planner__back">
          <Icon name="arrow_back" size={22} /> {t('aiPlanner', 'back')}
        </Link>
        <h1 className="ai-planner__page-title">{t('aiPlanner', 'title')}</h1>
        <div className="ai-planner__page-actions">
          <button
            type="button"
            className="ai-planner__tour-btn"
            onClick={startTour}
            aria-label={t('aiPlanner', 'onboardingRestartAria')}
            title={t('aiPlanner', 'onboardingRestart')}
          >
            <Icon name="auto_awesome" size={22} aria-hidden />
          </button>
          <button
            type="button"
            className="ai-planner__settings"
            ref={tourSettingsBtnRef}
            onClick={() => {
              setActiveChipEditor(null);
              setSettingsOpen(true);
            }}
            aria-label={t('aiPlanner', 'configure')}
          >
            <Icon name="tune" size={22} />
          </button>
        </div>
      </header>

      {!aiConfigured && (
        <p className="ai-planner__banner" role="status">
          {t('aiPlanner', 'notConfigured')} {t('aiPlanner', 'notConfiguredHint')}
        </p>
      )}

      <div className="ai-planner__hero">
        <div className="ai-planner__flow" aria-label={t('aiPlanner', 'plannerFlowAria')}>
          <span className="ai-planner__flow-step ai-planner__flow-step--active">{t('aiPlanner', 'plannerFlow1')}</span>
          <span className="ai-planner__flow-step">{t('aiPlanner', 'plannerFlow2')}</span>
          <span className="ai-planner__flow-step">{t('aiPlanner', 'plannerFlow3')}</span>
          <span className="ai-planner__flow-step">{t('aiPlanner', 'plannerFlow4')}</span>
        </div>

        <div className="ai-planner__chips-wrap" ref={chipsBarRef}>
          <div className="ai-planner__chips-head">
            <div>
              <span className="ai-planner__section-step">
                {t('aiPlanner', 'sectionStepLabel').replace(/\{n\}/g, '1')}
              </span>
              <h3 className="ai-planner__section-title">{t('aiPlanner', 'tripBriefTitle')}</h3>
            </div>
          </div>
          <div className="ai-planner__chips" role="toolbar" aria-label={t('aiPlanner', 'configure')}>
            <button
              type="button"
              className={`ai-planner__chip ai-planner__chip--btn${activeChipEditor === 'duration' ? ' ai-planner__chip--active' : ''}`}
              aria-expanded={activeChipEditor === 'duration'}
              aria-controls="ai-planner-chip-editor"
              onClick={() => toggleChipEditor('duration')}
              aria-label={t('aiPlanner', 'chipEditDuration')}
            >
              {durationDays === 1 ? t('aiPlanner', 'oneDay') : `${durationDays} ${t('aiPlanner', 'days')}`}
            </button>
            <button
              type="button"
              className={`ai-planner__chip ai-planner__chip--btn${activeChipEditor === 'placesPerDay' ? ' ai-planner__chip--active' : ''}`}
              aria-expanded={activeChipEditor === 'placesPerDay'}
              aria-controls="ai-planner-chip-editor"
              onClick={() => toggleChipEditor('placesPerDay')}
              aria-label={t('aiPlanner', 'chipEditPlacesPerDay')}
            >
              {`${placesPerDay} × ${t('aiPlanner', 'perDay')}`}
            </button>
            <button
              type="button"
              className={`ai-planner__chip ai-planner__chip--btn${activeChipEditor === 'date' ? ' ai-planner__chip--active' : ''}`}
              aria-expanded={activeChipEditor === 'date'}
              aria-controls="ai-planner-chip-editor"
              onClick={() => toggleChipEditor('date')}
              aria-label={t('aiPlanner', 'chipEditDate')}
            >
              {dateStrForChip}
            </button>
            <button
              type="button"
              className={`ai-planner__chip ai-planner__chip--btn${activeChipEditor === 'budget' ? ' ai-planner__chip--active' : ''}`}
              aria-expanded={activeChipEditor === 'budget'}
              aria-controls="ai-planner-chip-editor"
              onClick={() => toggleChipEditor('budget')}
              aria-label={t('aiPlanner', 'chipEditBudget')}
            >
              {budgetChipLabel}
            </button>
          </div>
          {activeChipEditor && (
            <div id="ai-planner-chip-editor" className="ai-planner__chip-editor">
              {activeChipEditor === 'duration' && (
                <div className="ai-planner__chip-editor-field">
                  <label htmlFor="ai-chip-field-duration">{t('aiPlanner', 'duration')}</label>
                  <select
                    id="ai-chip-field-duration"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? t('aiPlanner', 'oneDay') : `${n} ${t('aiPlanner', 'days')}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {activeChipEditor === 'placesPerDay' && (
                <div className="ai-planner__chip-editor-field">
                  <label htmlFor="ai-chip-field-placesPerDay">{t('aiPlanner', 'placesPerDay')}</label>
                  <select
                    id="ai-chip-field-placesPerDay"
                    value={placesPerDay}
                    onChange={(e) => setPlacesPerDay(Number(e.target.value))}
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {activeChipEditor === 'date' && (
                <div className="ai-planner__chip-editor-field">
                  <label htmlFor="ai-chip-field-date">{t('aiPlanner', 'tripDate')}</label>
                  <input
                    id="ai-chip-field-date"
                    type="date"
                    min={todayDateOnly()}
                    value={formatYMD(selectedDate)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) setSelectedDate(clampTripStartDateLocal(new Date(`${v}T12:00:00`)));
                    }}
                  />
                </div>
              )}
              {activeChipEditor === 'budget' && (
                <div className="ai-planner__chip-editor-field">
                  <label htmlFor="ai-chip-field-budget">{t('aiPlanner', 'budget')}</label>
                  <select
                    id="ai-chip-field-budget"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  >
                    <option value="low">{t('aiPlanner', 'budgetLow')}</option>
                    <option value="moderate">{t('aiPlanner', 'budgetModerate')}</option>
                    <option value="luxury">{t('aiPlanner', 'budgetLuxury')}</option>
                  </select>
                </div>
              )}
              <button
                type="button"
                className="ai-planner__chip-editor-done"
                onClick={() => setActiveChipEditor(null)}
              >
                {t('placeDiscover', 'modalClose')}
              </button>
            </div>
          )}
        </div>

        <div className="ai-planner__request-builder" ref={tourBriefRef}>
          <div className="ai-planner__request-head">
            <div>
              <span className="ai-planner__section-step">
                {t('aiPlanner', 'sectionStepLabel').replace(/\{n\}/g, '2')}
              </span>
              <h3 className="ai-planner__section-title">{t('aiPlanner', 'briefComposerTitle')}</h3>
              <p className="ai-planner__section-sub">{t('aiPlanner', 'briefComposerSub')}</p>
            </div>
            {latestUserMessage?.content ? (
              <span className="ai-planner__request-status">
                {t('aiPlanner', 'briefLatestReady')}
              </span>
            ) : null}
          </div>
          <label className="ai-planner__sr-only" htmlFor="ai-planner-brief">
            {t('aiPlanner', 'placeholder')}
          </label>
          <textarea
            id="ai-planner-brief"
            className="ai-planner__request-textarea"
            rows={5}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('aiPlanner', 'placeholder')}
            disabled={!aiConfigured || dataLoading || sending}
          />
          <div className="ai-planner__request-actions">
            <button
              type="button"
              className="ai-planner__btn ai-planner__btn--primary"
              disabled={!aiConfigured || dataLoading || sending || !input.trim()}
              onClick={() => sendMessage(input)}
            >
              <Icon name="auto_awesome" size={18} />
              {t('aiPlanner', 'generatePlan')}
            </button>
            <button
              type="button"
              className="ai-planner__btn ai-planner__btn--ghost"
              disabled={sending || !aiConfigured || dataLoading || !lastSlots?.length}
              onClick={() =>
                sendMessage(buildGuidedPlannerPrompt(t('aiPlanner', 'guidedPromptRefineFlow')))
              }
            >
              <Icon name="refresh" size={18} />
              {t('aiPlanner', 'improvePlan')}
            </button>
          </div>
        </div>

        <div className="ai-planner__quick-row" ref={tourMoodsRef}>
          <div className="ai-planner__quick-head">
            <span className="ai-planner__section-step">{t('aiPlanner', 'quickStartOptional')}</span>
            <h3 className="ai-planner__section-title">{t('aiPlanner', 'quickStartTitle')}</h3>
          </div>
          <div className="ai-planner__moods">
            {moodCards.map((m) => (
              <button
                key={m.label}
                type="button"
                className="ai-planner__mood"
                title={m.prompt}
                disabled={sending || !aiConfigured || dataLoading}
                onClick={() => sendMessage(m.prompt)}
              >
                <span className="ai-planner__mood-icon" aria-hidden>
                  <Icon name={m.icon} size={26} />
                </span>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="ai-planner__chat" ref={tourStudioRef}>
        <div className="ai-planner__workspace-head">
          <div>
            <span className="ai-planner__section-step">
              {t('aiPlanner', 'sectionStepLabel').replace(/\{n\}/g, '4')}
            </span>
            <h3 className="ai-planner__section-title">{t('aiPlanner', 'onboardingStudioTitle')}</h3>
            <p className="ai-planner__section-sub">{t('aiPlanner', 'studioSectionSub')}</p>
            <div className="ai-planner__brief-summary" aria-label={t('aiPlanner', 'tripBriefSummaryAria')}>
              {tripBriefSummary.map((item) => (
                <span key={item} className="ai-planner__brief-pill">
                  {item}
                </span>
              ))}
            </div>
          </div>
          {lastSlots?.length ? (
            <button
              type="button"
              className="ai-planner__btn ai-planner__btn--ghost"
              disabled={sending || !aiConfigured || dataLoading}
              onClick={() =>
                sendMessage(buildGuidedPlannerPrompt(t('aiPlanner', 'guidedPromptRefreshQuality')))
              }
            >
              <Icon name="refresh" size={18} />
              {t('aiPlanner', 'refreshPlan')}
            </button>
          ) : null}
        </div>
        <div ref={messagesScrollRef} className="ai-planner__messages">
          {dataLoading && (
            <div className="ai-planner__chat-loading" role="status" aria-live="polite">
              {t('aiPlanner', 'chatLoadingPlaces')}
            </div>
          )}
          {latestUserMessage?.content ? (
            <section className="ai-planner__workspace-panel">
              <div className="ai-planner__entry-label">{t('aiPlanner', 'workspaceBriefLabel')}</div>
              <div className="ai-planner__workspace-note">
                {latestUserMessage.content}
              </div>
            </section>
          ) : null}

          {latestAssistantMessage?.content &&
          (latestAssistantMessage.error ||
            !Array.isArray(latestAssistantMessage.slots) ||
            latestAssistantMessage.slots.length === 0) ? (
            <section className="ai-planner__workspace-panel">
              <div className="ai-planner__entry-label">
                {latestAssistantMessage.error
                  ? t('aiPlanner', 'workspaceIssueLabel')
                  : t('aiPlanner', 'workspaceSummaryLabel')}
              </div>
              <div
                className={`ai-planner__bubble ai-planner__bubble--assistant${
                  latestAssistantMessage.error ? ' ai-planner__bubble--error' : ''
                }`}
              >
                {latestAssistantMessage.content}
                {latestAssistantMessage.error && latestAssistantMessage.retryText && (
                  <div className="ai-planner__plan-actions" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="ai-planner__btn ai-planner__btn--ghost"
                      onClick={() => sendMessage(latestAssistantMessage.retryText)}
                    >
                      {t('aiPlanner', 'tryAgain')}
                    </button>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {lastPlanMessageIndex >= 0 && messages[lastPlanMessageIndex] && (() => {
            const m = messages[lastPlanMessageIndex];
            const i = lastPlanMessageIndex;
            const editable = true;
            const conflictForMsg = getSlotConflictIndices(m.slots || []);
            return (
              <div>
                <div
                  ref={tourPlanRef}
                  className={`ai-planner__plan${
                    highlightFreshPlan && lastSlots?.length ? ' ai-planner__plan--fresh' : ''
                  }`}
                  id={`ai-planner-plan-${i}-anchor`}
                >
                    {highlightFreshPlan && lastSlots?.length > 0 ? (
                      <div className="ai-planner__plan-alert" role="status" aria-live="polite">
                        <div className="ai-planner__plan-alert-row">
                          <span className="ai-planner__plan-alert-icon" aria-hidden>
                            <Icon name="auto_awesome" size={22} />
                          </span>
                          <div className="ai-planner__plan-alert-copy">
                            <p className="ai-planner__plan-alert-title">{t('aiPlanner', 'planUpdatedTitle')}</p>
                            <p className="ai-planner__plan-alert-body">{t('aiPlanner', 'planUpdatedBody')}</p>
                            {planChangelog?.length ? (
                              <div className="ai-planner__plan-changelog" aria-label={t('aiPlanner', 'planChangeTitle')}>
                                <p className="ai-planner__plan-changelog-title">{t('aiPlanner', 'planChangeTitle')}</p>
                                <ul className="ai-planner__plan-changelog-list">
                                  {planChangelog.map((line, ci) => (
                                    <li key={ci}>{line}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="ai-planner__plan-alert-actions">
                          <button
                            type="button"
                            className="ai-planner__btn ai-planner__btn--primary"
                            onClick={() => scrollToPlanDaySection(0)}
                          >
                            <Icon name="vertical_align_top" size={18} aria-hidden />
                            {t('aiPlanner', 'planJumpToItinerary')}
                          </button>
                          <button
                            type="button"
                            className="ai-planner__btn ai-planner__btn--ghost"
                            onClick={() => scrollToRouteOverview()}
                          >
                            <Icon name="view_list" size={18} aria-hidden />
                            {t('aiPlanner', 'planOpenRouteOverview')}
                          </button>
                          <button
                            type="button"
                            className="ai-planner__btn ai-planner__btn--ghost"
                            onClick={() => {
                              setHighlightFreshPlan(false);
                              setPlanChangelog(null);
                            }}
                          >
                            {t('aiPlanner', 'planUpdatedDismiss')}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {lastSlots?.length > 0 ? (
                      <div
                        ref={routeOverviewRef}
                        id="ai-planner-route-overview"
                        className="ai-planner__route-overview"
                      >
                        <div className="ai-planner__route-overview-toolbar">
                          <button
                            type="button"
                            className="ai-planner__route-overview-toggle"
                            aria-expanded={routeOverviewOpen}
                            onClick={() => setRouteOverviewOpen((v) => !v)}
                          >
                            <Icon name="view_list" size={20} aria-hidden />
                            <span>{t('aiPlanner', 'routeOverviewTitle')}</span>
                            <Icon name={routeOverviewOpen ? 'expand_less' : 'expand_more'} size={20} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="ai-planner__route-overview-copy"
                            onClick={() => copyItineraryFromSlots(m.slots)}
                            title={t('aiPlanner', 'copyItinerary')}
                            aria-label={t('aiPlanner', 'copyItinerary')}
                          >
                            <Icon name="content_copy" size={20} aria-hidden />
                          </button>
                        </div>
                        {routeOverviewOpen ? (
                          <>
                            <p className="ai-planner__route-overview-hint">{t('aiPlanner', 'routeOverviewHint')}</p>
                            <ul className="ai-planner__route-overview-list">
                              {buildDayGroupsForDisplay(m.slots, durationDays).map(({ dayIndex, items }) => (
                                <li key={dayIndex} className="ai-planner__route-overview-day">
                                  <span className="ai-planner__route-overview-day-label">
                                    {dayHeaderLabel(dayIndex)}
                                  </span>
                                  <span className="ai-planner__route-overview-stops" dir="ltr">
                                    {items.length === 0
                                      ? '—'
                                      : items
                                          .map(({ s }) => placeById[String(s.placeId)]?.name || String(s.placeId))
                                          .join(' → ')}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    <p className="ai-planner__plan-title">{t('aiPlanner', 'proposedPlan')}</p>
                    {editable && (
                      <>
                        <p className="ai-planner__plan-sub">{t('aiPlanner', 'planEditHint')}</p>
                        <p className="ai-planner__plan-sub ai-planner__plan-sub--muted">{t('aiPlanner', 'smartScheduleNote')}</p>
                      </>
                    )}
                    {editable && planConflicts.size > 0 && (
                      <p className="ai-planner__plan-warning" role="status">
                        {t('aiPlanner', 'timeConflictBanner')}
                      </p>
                    )}
                    <div className="ai-planner__plan-days">
                      {buildDayGroupsForDisplay(m.slots, durationDays).map(({ dayIndex, items }) => (
                        <div
                          key={dayIndex}
                          className="ai-planner__plan-day"
                          id={`ai-planner-plan-${i}-day-${dayIndex}`}
                        >
                          <div className="ai-planner__plan-day-head">
                            <span className="ai-planner__plan-day-title">{dayHeaderLabel(dayIndex)}</span>
                            <span className="ai-planner__plan-day-count">{items.length}</span>
                          </div>
                          {items.length === 0 ? (
                            <p className="ai-planner__plan-day-empty">{t('aiPlanner', 'planDayEmpty')}</p>
                          ) : (
                            <ul className="ai-planner__plan-stops">
                              {items.map(({ s, idx: slotIndex }) => {
                                const pl = placeById[s.placeId];
                                const rowConflict = conflictForMsg.has(slotIndex);
                                return (
                                  <li
                                    key={`${i}-${slotIndex}-${s.placeId}`}
                                    className={`ai-planner__stop-card${
                                      rowConflict ? ' ai-planner__stop-card--warn' : ''
                                    }`}
                                  >
                                    <div className="ai-planner__stop-card__rail" aria-hidden />
                                    <div className="ai-planner__stop-card__main">
                                      <div className="ai-planner__stop-card__row1">
                                        {editable ? (
                                          <>
                                            <label
                                              className="ai-planner__sr-only"
                                              htmlFor={`ai-time-${i}-${slotIndex}`}
                                            >
                                              {t('aiPlanner', 'changeTime')}
                                            </label>
                                            <input
                                              id={`ai-time-${i}-${slotIndex}`}
                                              type="time"
                                              className="ai-planner__stop-time-input"
                                              value={normalizeSuggestedTime(s.suggestedTime)}
                                              onChange={(e) =>
                                                patchSlotField(i, slotIndex, {
                                                  suggestedTime: e.target.value,
                                                })
                                              }
                                            />
                                            {durationDays > 1 && (
                                              <select
                                                className="ai-planner__stop-day-select"
                                                aria-label={t('aiPlanner', 'whichDay')}
                                                value={Math.min(
                                                  durationDays - 1,
                                                  Math.max(0, s.dayIndex ?? 0)
                                                )}
                                                onChange={(e) =>
                                                  patchSlotField(i, slotIndex, {
                                                    dayIndex: Number(e.target.value),
                                                  })
                                                }
                                              >
                                                {Array.from({ length: durationDays }, (_, d) => (
                                                  <option key={d} value={d}>
                                                    {t('aiPlanner', 'dayLabel')} {d + 1}
                                                  </option>
                                                ))}
                                              </select>
                                            )}
                                          </>
                                        ) : (
                                          <span className="ai-planner__stop-time-readonly">
                                            {durationDays > 1 ? `D${(s.dayIndex ?? 0) + 1} · ` : ''}
                                            {normalizeSuggestedTime(s.suggestedTime)}
                                          </span>
                                        )}
                                        {editable && (
                                          <div className="ai-planner__stop-actions">
                                            <button
                                              type="button"
                                              className="ai-planner__icon-btn ai-planner__icon-btn--ai"
                                              aria-label={t('aiPlanner', 'aiReplaceWithAi')}
                                              disabled={!aiConfigured || dataLoading || sending}
                                              onClick={() => {
                                                setAiReplaceNote('');
                                                setAiReplaceSheet({ messageIndex: i, slotIndex });
                                              }}
                                            >
                                              <Icon name="auto_awesome" size={20} />
                                            </button>
                                            <button
                                              type="button"
                                              className="ai-planner__icon-btn"
                                              aria-label={t('aiPlanner', 'editPlace')}
                                              onClick={() => {
                                                setPlaceSearch('');
                                                setPlacePicker({ messageIndex: i, slotIndex });
                                              }}
                                            >
                                              <Icon name="edit" size={20} />
                                            </button>
                                            <button
                                              type="button"
                                              className="ai-planner__icon-btn ai-planner__icon-btn--danger"
                                              aria-label={t('aiPlanner', 'deleteStop')}
                                              onClick={() => deleteSlotAt(i, slotIndex)}
                                            >
                                              <Icon name="delete" size={20} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      <div className="ai-planner__stop-name">
                                        {pl?.name || s.placeId}
                                      </div>
                                      {editable && durationDays > 1 && (
                                        <div className="ai-planner__stop-day-inline">
                                          <label className="ai-planner__stop-day-inline-label" htmlFor={`ai-day-inline-${i}-${slotIndex}`}>
                                            {t('aiPlanner', 'whichDay')}
                                          </label>
                                          <select
                                            id={`ai-day-inline-${i}-${slotIndex}`}
                                            className="ai-planner__stop-day-select ai-planner__stop-day-select--inline"
                                            value={Math.min(durationDays - 1, Math.max(0, s.dayIndex ?? 0))}
                                            onChange={(e) =>
                                              patchSlotField(i, slotIndex, {
                                                dayIndex: Number(e.target.value),
                                              })
                                            }
                                          >
                                            {Array.from({ length: durationDays }, (_, d) => (
                                              <option key={d} value={d}>
                                                {t('aiPlanner', 'dayLabel')} {d + 1}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                      {pl?.category && (
                                        <div className="ai-planner__stop-cat">{pl.category}</div>
                                      )}
                                      {s.reason && (
                                        <div className="ai-planner__plan-reason">{s.reason}</div>
                                      )}
                                      {editable && rowConflict && (
                                        <p className="ai-planner__stop-conflict">
                                          {t('aiPlanner', 'timeConflictRow')}
                                        </p>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                    {editable && (
                      <div className="ai-planner__plan-actions" ref={tourSaveRef}>
                        <p className="ai-planner__plan-gap-hint">{t('aiPlanner', 'minGapHint')}</p>
                        <button
                          type="button"
                          className="ai-planner__btn ai-planner__btn--primary"
                          disabled={
                            applying || planConflicts.size > 0 || !lastSlots?.length
                          }
                          title={
                            planConflicts.size > 0
                              ? t('aiPlanner', 'saveBlockedConflicts')
                              : !lastSlots?.length
                                ? t('aiPlanner', 'saveNeedStops')
                                : undefined
                          }
                          onClick={handleApplyTrip}
                        >
                          {applying ? t('aiPlanner', 'applying') : t('aiPlanner', 'applyTrip')}
                        </button>
                        <div className="ai-planner__plan-feedback" role="group" aria-label={t('aiPlanner', 'planFeedbackPrompt')}>
                          <span className="ai-planner__plan-feedback-prompt">{t('aiPlanner', 'planFeedbackPrompt')}</span>
                          <div className="ai-planner__plan-feedback-btns">
                            <button
                              type="button"
                              className={`ai-planner__plan-feedback-btn${planFeedback === 'up' ? ' ai-planner__plan-feedback-btn--active' : ''}`}
                              disabled={planFeedback != null}
                              aria-pressed={planFeedback === 'up'}
                              onClick={() => {
                                setPlanFeedback('up');
                                setPlanFeedbackNote('');
                                setPlanFeedbackNoteSent(false);
                                showToast(t('aiPlanner', 'planFeedbackThanks'), 'success');
                              }}
                            >
                              <Icon name="thumb_up" size={20} aria-hidden />
                              <span className="ai-planner__sr-only">{t('aiPlanner', 'planFeedbackThanks')}</span>
                            </button>
                            <button
                              type="button"
                              className={`ai-planner__plan-feedback-btn${planFeedback === 'down' ? ' ai-planner__plan-feedback-btn--active' : ''}`}
                              disabled={planFeedback != null}
                              aria-pressed={planFeedback === 'down'}
                              onClick={() => {
                                setPlanFeedback('down');
                                showToast(t('aiPlanner', 'planFeedbackDownNote'), 'info');
                              }}
                            >
                              <Icon name="thumb_down" size={20} aria-hidden />
                              <span className="ai-planner__sr-only">{t('aiPlanner', 'planFeedbackDownNote')}</span>
                            </button>
                          </div>
                          {planFeedback === 'down' && !planFeedbackNoteSent ? (
                            <div className="ai-planner__plan-feedback-detail">
                              <label htmlFor="ai-planner-feedback-note" className="ai-planner__plan-feedback-detail-label">
                                {t('aiPlanner', 'planFeedbackOptional')}
                              </label>
                              <textarea
                                id="ai-planner-feedback-note"
                                className="ai-planner__plan-feedback-textarea"
                                rows={3}
                                maxLength={600}
                                value={planFeedbackNote}
                                onChange={(e) => setPlanFeedbackNote(e.target.value)}
                                placeholder={t('aiPlanner', 'planFeedbackPlaceholder')}
                              />
                              <button
                                type="button"
                                className="ai-planner__btn ai-planner__btn--ghost ai-planner__plan-feedback-send-note"
                                disabled={!planFeedbackNote.trim()}
                                onClick={() => {
                                  setPlanFeedbackNoteSent(true);
                                  showToast(t('aiPlanner', 'planFeedbackNoteThanks'), 'success');
                                }}
                              >
                                {t('aiPlanner', 'planFeedbackSendNote')}
                              </button>
                            </div>
                          ) : null}
                          {planFeedback === 'down' && planFeedbackNoteSent ? (
                            <p className="ai-planner__plan-feedback-note-done">{t('aiPlanner', 'planFeedbackNoteThanks')}</p>
                          ) : null}
                        </div>
                      </div>
                    )}
                </div>
                {latestAssistantMessage?.overlapRange && (
                  <div className="ai-planner__overlap-actions">
                    <p className="ai-planner__overlap-hint">{t('aiPlanner', 'overlapActionsHint')}</p>
                    {(latestAssistantMessage.overlapTrips || []).map((trip) => (
                      <button
                        key={trip.id}
                        type="button"
                        className="ai-planner__overlap-btn ai-planner__overlap-btn--danger"
                        onClick={() => handleDeleteOverlapTrip(trip.id, i)}
                      >
                        {t('aiPlanner', 'overlapDeleteTrip').replace(
                          /\{name\}/g,
                          (trip.name && String(trip.name).trim()) || t('aiPlanner', 'unnamedTrip')
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="ai-planner__overlap-btn"
                      onClick={() => handleShiftOverlapDates(i)}
                    >
                      {t('aiPlanner', 'overlapShiftDates')}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
          {sending && (
            <div className="ai-planner__thinking" role="status" aria-live="polite" aria-busy="true">
              <span className="ai-planner__thinking-icon" aria-hidden>
                <Icon name="auto_awesome" size={22} />
              </span>
              <div className="ai-planner__thinking-copy">
                <span className="ai-planner__thinking-head">{t('aiPlanner', 'thinkingHeadline')}</span>
                <span className="ai-planner__thinking-sub">{t('aiPlanner', 'thinkingSub')}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {showPlanDayDock && (
        <div
          className="ai-planner__day-dock"
          style={{ bottom: dockBottomOffset }}
          role="region"
          aria-label={t('aiPlanner', 'dayDockAria')}
        >
          <div className="ai-planner__day-dock-tabs" role="tablist" aria-label={t('aiPlanner', 'dayDockTabsAria')}>
            {durationDays > 1 ? (
              Array.from({ length: durationDays }, (_, d) => (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={planDockDayActive === d}
                  className={`ai-planner__day-dock-tab${planDockDayActive === d ? ' ai-planner__day-dock-tab--active' : ''}`}
                  onClick={() => scrollToPlanDaySection(d)}
                >
                  <span className="ai-planner__day-dock-tab-short">{t('aiPlanner', 'dayLabel')} {d + 1}</span>
                  <span className="ai-planner__day-dock-tab-long" aria-hidden>
                    {dayHeaderLabel(d)}
                  </span>
                </button>
              ))
            ) : (
              <button
                type="button"
                className="ai-planner__day-dock-tab ai-planner__day-dock-tab--solo"
                onClick={() => scrollToPlanDaySection(0)}
              >
                {t('aiPlanner', 'dayDockScrollPlan')}
              </button>
            )}
          </div>
          {lastPlanMessageIndex >= 0 && (
            <button
              type="button"
              className={`ai-planner__day-dock-apply${
                highlightFreshPlan && lastSlots?.length ? ' ai-planner__day-dock-apply--pulse' : ''
              }`}
              disabled={
                applying ||
                planConflicts.size > 0 ||
                !lastSlots?.length ||
                sending ||
                !aiConfigured
              }
              title={
                planConflicts.size > 0
                  ? t('aiPlanner', 'saveBlockedConflicts')
                  : !lastSlots?.length
                    ? t('aiPlanner', 'saveNeedStops')
                    : highlightFreshPlan
                      ? t('aiPlanner', 'planUpdatedBody')
                      : undefined
              }
              onClick={() => void handleApplyTrip()}
            >
              {applying ? t('aiPlanner', 'applying') : t('aiPlanner', 'applyTrip')}
            </button>
          )}
        </div>
      )}

      {settingsOpen && (
        <>
          <div
            className="ai-planner-sheet-overlay"
            role="presentation"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="ai-planner-sheet" role="dialog" aria-modal="true" aria-label={t('aiPlanner', 'configure')}>
            <h3>{t('aiPlanner', 'configure')}</h3>
            <div className="ai-planner-field">
              <label htmlFor="ai-trip-date">{t('aiPlanner', 'tripDate')}</label>
              <input
                id="ai-trip-date"
                type="date"
                min={todayDateOnly()}
                value={formatYMD(selectedDate)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setSelectedDate(clampTripStartDateLocal(new Date(`${v}T12:00:00`)));
                }}
              />
            </div>
            <div className="ai-planner-field">
              <label htmlFor="ai-duration">{t('aiPlanner', 'duration')}</label>
              <select
                id="ai-duration"
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? t('aiPlanner', 'oneDay') : `${n} ${t('aiPlanner', 'days')}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="ai-planner-field">
              <label htmlFor="ai-ppd">{t('aiPlanner', 'placesPerDay')}</label>
              <select
                id="ai-ppd"
                value={placesPerDay}
                onChange={(e) => setPlacesPerDay(Number(e.target.value))}
              >
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="ai-planner-field">
              <label htmlFor="ai-budget">{t('aiPlanner', 'budget')}</label>
              <select id="ai-budget" value={budget} onChange={(e) => setBudget(e.target.value)}>
                <option value="low">{t('aiPlanner', 'budgetLow')}</option>
                <option value="moderate">{t('aiPlanner', 'budgetModerate')}</option>
                <option value="luxury">{t('aiPlanner', 'budgetLuxury')}</option>
              </select>
            </div>
            <div className="ai-planner-field">
              <span id="ai-interests-label">{t('aiPlanner', 'interests')}</span>
              <div className="ai-planner-interests" role="group" aria-labelledby="ai-interests-label">
                {interestsList.map((it) => {
                  const id = String(it.id);
                  const on = interestIds.has(id);
                  return (
        <button
          key={id}
          type="button"
          className={`ai-planner-interest${on ? ' ai-planner-interest--on' : ''}`}
          onClick={() => {
            setInterestIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
        >
          {it.name || id}
        </button>
                  );
                })}
              </div>
            </div>
            <div className="ai-planner-field ai-planner-field--memory">
              <h4 className="ai-planner-field__section-title">{t('aiPlanner', 'visitorMemoryTitle')}</h4>
              <p className="ai-planner-field__help">{t('aiPlanner', 'visitorMemoryHelp')}</p>
              <label htmlFor="ai-planner-visitor-note">{t('aiPlanner', 'visitorMemoryLabel')}</label>
              <textarea
                id="ai-planner-visitor-note"
                className="ai-planner__memory-note"
                rows={4}
                value={plannerMemory.personalNote}
                onChange={(e) => updatePlannerPersonalNote(e.target.value)}
                maxLength={600}
                autoComplete="off"
              />
              <button
                type="button"
                className="ai-planner-memory-clear"
                onClick={clearPlannerLearnedMemory}
              >
                {t('aiPlanner', 'visitorMemoryClear')}
              </button>
            </div>
            <button type="button" className="ai-planner-sheet-close" onClick={() => setSettingsOpen(false)}>
              {t('placeDiscover', 'modalClose')}
            </button>
          </div>
        </>
      )}

      {placePicker && (
        <>
          <div
            className="ai-planner-sheet-overlay"
            role="presentation"
            onClick={() => setPlacePicker(null)}
          />
          <div
            className="ai-planner-sheet ai-planner-sheet--picker"
            role="dialog"
            aria-modal="true"
            aria-label={t('aiPlanner', 'editPlace')}
          >
            <h3>{t('aiPlanner', 'editPlace')}</h3>
            <div className="ai-planner-field">
              <label htmlFor="ai-place-search">{t('placeDiscover', 'searchPlaceholder')}</label>
              <input
                id="ai-place-search"
                type="search"
                value={placeSearch}
                onChange={(e) => setPlaceSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
            <ul className="ai-planner-picker-list">
              {filteredPickerPlaces.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="ai-planner-picker-item"
                    onClick={() => {
                      patchSlotField(placePicker.messageIndex, placePicker.slotIndex, {
                        placeId: String(p.id),
                        reason: null,
                      });
                      setPlacePicker(null);
                    }}
                  >
                    <span className="ai-planner-picker-item__name">{p.name}</span>
                    {p.category && (
                      <span className="ai-planner-picker-item__cat">{p.category}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="ai-planner-sheet-close" onClick={() => setPlacePicker(null)}>
              {t('placeDiscover', 'modalClose')}
            </button>
          </div>
        </>
      )}

      {aiReplaceSheet && (
        <>
          <div
            className="ai-planner-sheet-overlay"
            role="presentation"
            onClick={() => {
              setAiReplaceSheet(null);
              setAiReplaceNote('');
            }}
          />
          <div
            className="ai-planner-sheet ai-planner-sheet--picker"
            role="dialog"
            aria-modal="true"
            aria-label={t('aiPlanner', 'aiReplaceSheetTitle')}
          >
            <h3>{t('aiPlanner', 'aiReplaceSheetTitle')}</h3>
            <p className="ai-planner__plan-sub">{t('aiPlanner', 'aiReplaceHint')}</p>
            <div className="ai-planner-field">
              <label htmlFor="ai-replace-note">{t('aiPlanner', 'aiReplaceOptionalLabel')}</label>
              <textarea
                id="ai-replace-note"
                className="ai-planner__replace-note"
                rows={3}
                value={aiReplaceNote}
                onChange={(e) => setAiReplaceNote(e.target.value)}
                placeholder={t('aiPlanner', 'aiReplacePlaceholder')}
                disabled={sending}
              />
            </div>
            <button
              type="button"
              className="ai-planner__btn ai-planner__btn--primary"
              disabled={sending || !aiConfigured || dataLoading}
              onClick={() => void runAiReplaceStop()}
            >
              {sending ? t('aiPlanner', 'aiReplaceRunning') : t('aiPlanner', 'aiReplaceRun')}
            </button>
            <button
              type="button"
              className="ai-planner-sheet-close"
              onClick={() => {
                setAiReplaceSheet(null);
                setAiReplaceNote('');
              }}
            >
              {t('aiPlanner', 'aiReplaceCancel')}
            </button>
          </div>
        </>
      )}

      {navFabVisible && (
        <button
          type="button"
          className="ai-planner__nav-fab"
          style={{ bottom: `${navFabBottomPx}px` }}
          onClick={scrollToSiteNav}
          aria-label={t('aiPlanner', 'scrollToSiteNavAria')}
          title={t('aiPlanner', 'scrollToSiteNav')}
        >
          <Icon name="expand_less" size={24} aria-hidden />
        </button>
      )}

      {tourOpen ? (
        <AiPlannerOnboarding
          open={tourOpen}
          stepIndex={tourStep}
          stepCount={TOUR_STEP_COUNT}
          title={tourStepMeta[tourStep]?.title ?? ''}
          body={tourStepMeta[tourStep]?.body ?? ''}
          highlightRect={tourHighlightRect}
          onNext={() => {
            if (tourStep >= TOUR_STEP_COUNT - 1) finishTour();
            else setTourStep((s) => s + 1);
          }}
          onBack={() => {
            if (tourStep === 0) finishTour();
            else setTourStep((s) => Math.max(0, s - 1));
          }}
          onSkip={finishTour}
          isLastStep={tourStep === TOUR_STEP_COUNT - 1}
          nextLabel={t('aiPlanner', 'onboardingNext')}
          backLabel={t('aiPlanner', 'onboardingBack')}
          skipLabel={t('aiPlanner', 'onboardingSkip')}
          doneLabel={t('aiPlanner', 'onboardingDone')}
          progressLabel={t('aiPlanner', 'onboardingProgress')}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        />
      ) : null}
    </div>
  );
}
