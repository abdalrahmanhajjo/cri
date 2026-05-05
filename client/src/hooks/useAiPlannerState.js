import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import api from '../api/client';
import {
  savePlannerDraft,
  loadPlannerDraft,
  clearPlannerDraft,
} from '../utils/aiPlannerDraft';
import {
  loadPlannerPrefs,
  savePlannerPrefs,
} from '../utils/aiPlannerPrefs';
import {
  loadPlannerMemory,
  savePlannerMemory,
  createEmptyPlannerMemory,
  recordSuccessfulPlan,
  buildUserFamiliarityBlock,
  sanitizePersonalNote,
  topMemoryCategoriesForRanker,
} from '../utils/aiPlannerUserMemory';
import {
  isAiPlannerOnboardingDone,
  setAiPlannerOnboardingDone,
  clearAiPlannerOnboarding,
} from '../utils/aiPlannerOnboardingStorage';
import {
  chatForTripPlan,
  AIPlannerApiError,
  slotsToTripDays,
  getSlotConflictIndices,
  normalizeSuggestedTime,
  inferTargetedReplaceSlotIndex,
} from '../services/aiPlannerService';
import {
  findOverlappingTrips,
  todayDateOnly,
  tripHasDateConflict,
  findNextNonOverlappingDateRange,
  clampTripStartDateLocal,
  formatYMD,
} from '../utils/tripPlannerHelpers';
import { 
  assistantReplyForPlanner, 
  buildDraftPlanContextLine, 
  buildPlanChangelog, 
  inferTripSettingsFromUserText,
  apiBase,
  getTourMaxScrollY,
  getTourEffectiveScrollY,
  setTourEffectiveScrollY,
  buildPlanItineraryPlainText
} from '../utils/aiPlannerUIHelpers';

export function useAiPlannerState({ user, t, langParam, plannerDisabled, showToast, chipsBarRef }) {
  const navigate = useNavigate();
  const storageUserId = user?.id != null ? String(user.id) : 'anon';
  
  const messagesEndRef = useRef(null);
  const [planDockDayActive, setPlanDockDayActive] = useState(0);
  const [places, setPlaces] = useState([]);
  const [interestsList, setInterestsList] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [aiConfigured, setAiConfigured] = useState(true);

  const [durationDays, setDurationDays] = useState(() => {
    const p = loadPlannerPrefs(storageUserId);
    return p?.durationDays ?? 1;
  });
  const [placesPerDay, setPlacesPerDay] = useState(() => {
    const p = loadPlannerPrefs(storageUserId);
    return p?.placesPerDay ?? 4;
  });
  const [budget, setBudget] = useState(() => {
    const p = loadPlannerPrefs(storageUserId);
    return p?.budget ?? 'moderate';
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const p = loadPlannerPrefs(storageUserId);
    if (p?.startDate) {
      const d = new Date(p.startDate);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [interestIds, setInterestIds] = useState(() => {
    const p = loadPlannerPrefs(storageUserId);
    return new Set(p?.interestIds ?? []);
  });
  const [plannerPrefsReady, setPlannerPrefsReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [messages, setMessages] = useState(() => {
    // Attempt a quick restore from the current user's draft (or 'anon') on first render.
    try {
      const draft = loadPlannerDraft(storageUserId);
      if (draft && draft.length > 0) return draft;
    } catch { /* ignore */ }
    return [];
  });
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
  const [timerSeconds, setTimerSeconds] = useState(0);

  useEffect(() => {
    let interval;
    if (sending) {
      setTimerSeconds(0);
      interval = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => clearInterval(interval);
  }, [sending]);

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

  // ── Draft: restore draft messages once storageUserId is known ──────────────
  useEffect(() => {
    if (!storageUserId) return;
    setMessages((prev) => {
      const userDraft = loadPlannerDraft(storageUserId);
      if (!userDraft || userDraft.length === 0) return prev;
      return userDraft;
    });
  }, [storageUserId]);

  // ── Draft: auto-save messages on every change ─────────────────────────────
  useEffect(() => {
    if (!storageUserId) return;
    savePlannerDraft(storageUserId, messages);
  }, [storageUserId, messages]);

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

    // Completely reset chat history and drafts to make the AI "forget"
    setMessages([]);
    clearPlannerDraft(storageUserId);
    setSettingsOpen(false);
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
      endTime: s.endTime ? normalizeSuggestedTime(s.endTime) : null,
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
          durationDays: inferred?.durationDays ?? durationDays,
          placesPerDay: inferred?.placesPerDay ?? placesPerDay,
          budget: inferred?.budget ?? budget,
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
        durationDays: inferred?.durationDays ?? durationDays,
        placesPerDay: inferred?.placesPerDay ?? placesPerDay,
        budget: inferred?.budget ?? budget,
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
      clearPlannerDraft(storageUserId);
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



  return {
    places,
    setPlaces,
    interestsList,
    setInterestsList,
    dataLoading,
    setDataLoading,
    aiConfigured,
    setAiConfigured,
    durationDays,
    setDurationDays,
    placesPerDay,
    setPlacesPerDay,
    budget,
    setBudget,
    selectedDate,
    setSelectedDate,
    interestIds,
    setInterestIds,
    plannerPrefsReady,
    setPlannerPrefsReady,
    settingsOpen,
    setSettingsOpen,
    messages,
    setMessages,
    input,
    setInput,
    sending,
    setSending,
    applying,
    setApplying,
    lastSlots,
    setLastSlots,
    lastPlaces,
    setLastPlaces,
    placePicker,
    setPlacePicker,
    placeSearch,
    setPlaceSearch,
    aiReplaceSheet,
    setAiReplaceSheet,
    aiReplaceNote,
    setAiReplaceNote,
    highlightFreshPlan,
    setHighlightFreshPlan,
    routeOverviewOpen,
    setRouteOverviewOpen,
    planFeedback,
    setPlanFeedback,
    planFeedbackNote,
    setPlanFeedbackNote,
    planFeedbackNoteSent,
    setPlanFeedbackNoteSent,
    planChangelog,
    setPlanChangelog,
    activeChipEditor,
    setActiveChipEditor,
    routeOverviewRef,
    tourSettingsBtnRef,
    tourBriefRef,
    tourMoodsRef,
    tourStudioRef,
    tourPlanRef,
    tourSaveRef,
    tourOpen,
    setTourOpen,
    tourStep,
    setTourStep,
    tourHighlightRect,
    setTourHighlightRect,
    timerSeconds,
    setTimerSeconds,
    plannerMemory,
    setPlannerMemory,
    profilePlannerHints,
    setProfilePlannerHints,
    saveNoteTimeoutRef,
    moodCards,
    placeById,
    interestIdsForPrefs,
    userFamiliarityBlock,
    learnedCategoryHints,
    updatePlannerPersonalNote,
    clearPlannerLearnedMemory,
    applyAiTripSettingsToState,
    interestNames,
    tripBriefSummary,
    buildGuidedPlannerPrompt,
    lastPlanMessageIndex,
    latestUserMessage,
    latestAssistantMessage,
    planConflicts,
    TOUR_STEP_COUNT,
    tourStepMeta,
    tourRefMap,
    syncTourHighlightForStep,
    finishTour,
    startTour,
    formatChangelogDay,
    clampSlot,
    patchSlotField,
    deleteSlotAt,
    conversationHistory,
    sendMessage,
    runAiReplaceStop,
    pushDateOverlapAssistantMessage,
    handleDeleteOverlapTrip,
    handleShiftOverlapDates,
    handleApplyTrip,
    dayHeaderLabel,
    scrollToRouteOverview,
    copyItineraryFromSlots,
    filteredPickerPlaces
  };
}
