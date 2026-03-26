import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import {
  chatForTripPlan,
  slotsToTripDays,
  AIPlannerApiError,
  normalizeSuggestedTime,
  getSlotConflictIndices,
  suggestedTimeToMinutes,
} from '../services/aiPlannerService';
import { tripHasDateConflict } from '../utils/tripPlannerHelpers';
import './AiPlanner.css';

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

export default function AiPlanner() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const messagesEndRef = useRef(null);
  const chipsBarRef = useRef(null);
  /** Lifts composer above mobile on-screen keyboard (visualViewport gap). */
  const [keyboardInsetPx, setKeyboardInsetPx] = useState(0);

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
  const [activeChipEditor, setActiveChipEditor] = useState(null);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t('aiPlanner', 'greetingMorning');
    if (h < 17) return t('aiPlanner', 'greetingAfternoon');
    return t('aiPlanner', 'greetingEvening');
  }, [t]);

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
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const updateInset = () => {
      const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInsetPx(gap);
    };
    updateInset();
    vv.addEventListener('resize', updateInset);
    vv.addEventListener('scroll', updateInset);
    return () => {
      vv.removeEventListener('resize', updateInset);
      vv.removeEventListener('scroll', updateInset);
    };
  }, []);

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

  const lastPlanMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.role === 'assistant' && Array.isArray(m.slots)) return i;
    }
    return -1;
  }, [messages]);

  const planConflicts = useMemo(
    () => (lastSlots?.length ? getSlotConflictIndices(lastSlots) : new Set()),
    [lastSlots]
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

  const conversationHistory = useMemo(
    () =>
      messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    [messages]
  );

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = (text || '').trim();
      if (!trimmed || sending || dataLoading) return;

      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setInput('');
      setSending(true);

      try {
        const activityContext =
          interestNames.length > 0
            ? `User selected interest themes: ${interestNames.join(', ')}.`
            : '';

        const { text: reply, slots } = await chatForTripPlan({
          conversationHistory,
          userMessage: trimmed,
          places,
          durationDays,
          placesPerDay,
          budget,
          selectedDate,
          userInterests: interestNames,
          activityContext,
          responseLanguage: langParam,
          previousSlots: lastSlots,
          previousPlaces: lastPlaces,
          singleReplaceSlotIndex: null,
        });

        let resolvedPlaces = null;
        if (slots?.length) {
          resolvedPlaces = slots.map((s) => placeById[s.placeId]).filter(Boolean);
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: reply,
            slots: slots || null,
            places: resolvedPlaces,
          },
        ]);
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

    setAiReplaceSheet(null);
    setAiReplaceNote('');
    setSending(true);
    setMessages((p) => [...p, { role: 'user', content: userLine }]);

    try {
      const activityContext =
        interestNames.length > 0
          ? `User selected interest themes: ${interestNames.join(', ')}.`
          : '';

      const previousSlotsSnapshot = prevMsg.slots.map((s) => ({ ...s }));

      const { text: reply, slots } = await chatForTripPlan({
        conversationHistory,
        userMessage: userLine,
        places,
        durationDays,
        placesPerDay,
        budget,
        selectedDate,
        userInterests: interestNames,
        activityContext,
        responseLanguage: langParam,
        previousSlots: previousSlotsSnapshot,
        previousPlaces: previousSlotsSnapshot.map((s) => placeById[s.placeId]).filter(Boolean),
        singleReplaceSlotIndex: slotIndex,
      });

      let resolvedPlaces = null;
      if (slots?.length) {
        resolvedPlaces = slots.map((s) => placeById[s.placeId]).filter(Boolean);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: reply,
          slots: slots || null,
          places: resolvedPlaces,
        },
      ]);
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
  ]);

  const handleApplyTrip = useCallback(async () => {
    if (!lastSlots?.length || applying || planConflicts.size > 0) return;
    setApplying(true);
    try {
      const days = slotsToTripDays(lastSlots, durationDays, selectedDate);
      const end = new Date(selectedDate);
      end.setDate(end.getDate() + durationDays - 1);
      const startStr = selectedDate.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);
      const tripsRes = await api.user.trips();
      const existingTrips = tripsRes.trips || [];
      if (tripHasDateConflict(existingTrips, startStr, endStr, null)) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: t('home', 'tripDateOverlap'),
            error: true,
          },
        ]);
        return;
      }
      const trip = await api.user.createTrip({
        name: t('aiPlanner', 'tripNameDefault'),
        startDate: startStr,
        endDate: endStr,
        description: t('aiPlanner', 'tripDescriptionAi'),
        days,
      });
      navigate(`/plan?edit=${encodeURIComponent(trip.id)}`);
    } catch (e) {
      const overlap = e?.data?.code === 'TRIP_DATE_OVERLAP';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: overlap ? t('home', 'tripDateOverlap') : e.message || t('aiPlanner', 'applyFailed'),
          error: true,
        },
      ]);
    } finally {
      setApplying(false);
    }
  }, [lastSlots, durationDays, selectedDate, applying, navigate, t, planConflicts]);

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

  return (
    <div className="ai-planner">
      <header className="ai-planner__top">
        <Link to="/plan" className="ai-planner__back">
          <Icon name="arrow_back" size={22} /> {t('aiPlanner', 'back')}
        </Link>
        <h1 className="ai-planner__title">{t('aiPlanner', 'title')}</h1>
        <button
          type="button"
          className="ai-planner__settings"
          onClick={() => {
            setActiveChipEditor(null);
            setSettingsOpen(true);
          }}
          aria-label={t('aiPlanner', 'configure')}
        >
          <Icon name="tune" size={22} />
        </button>
      </header>

      {!aiConfigured && (
        <p className="ai-planner__banner" role="status">
          {t('aiPlanner', 'notConfigured')} {t('aiPlanner', 'notConfiguredHint')}
        </p>
      )}

      <div className="ai-planner__hero">
        <p className="ai-planner__greeting">{greeting}</p>
        <p className="ai-planner__sub">{t('aiPlanner', 'heroSub')}</p>

        <div className="ai-planner__moods">
          {moodCards.map((m) => (
            <button
              key={m.label}
              type="button"
              className="ai-planner__mood"
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

        <div className="ai-planner__chips-wrap" ref={chipsBarRef}>
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
                    value={selectedDate.toISOString().slice(0, 10)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) setSelectedDate(new Date(`${v}T12:00:00`));
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
      </div>

      <div className="ai-planner__chat">
        <div className="ai-planner__messages">
          {messages.map((m, i) => (
            <div key={i}>
              <div
                className={`ai-planner__bubble ${
                  m.role === 'user' ? 'ai-planner__bubble--user' : 'ai-planner__bubble--assistant'
                }${m.error ? ' ai-planner__bubble--error' : ''}`}
              >
                {m.content}
                {m.error && m.retryText && (
                  <div className="ai-planner__plan-actions" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="ai-planner__btn ai-planner__btn--ghost"
                      onClick={() => {
                        setMessages((prev) => prev.filter((_, j) => j !== i));
                        sendMessage(m.retryText);
                      }}
                    >
                      {t('aiPlanner', 'tryAgain')}
                    </button>
                  </div>
                )}
              </div>
              {Array.isArray(m.slots) && (() => {
                const editable = i === lastPlanMessageIndex;
                const conflictForMsg = editable ? getSlotConflictIndices(m.slots) : new Set();
                return (
                  <div className="ai-planner__plan">
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
                        <div key={dayIndex} className="ai-planner__plan-day">
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
                      <div className="ai-planner__plan-actions">
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
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
          {sending && (
            <div className="ai-planner__bubble ai-planner__bubble--assistant">{t('aiPlanner', 'thinking')}</div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div
        className="ai-planner__composer"
        style={keyboardInsetPx > 0 ? { bottom: keyboardInsetPx } : undefined}
      >
        <div className="ai-planner__composer-inner">
          <textarea
            className="ai-planner__input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder={t('aiPlanner', 'placeholder')}
            aria-label={t('aiPlanner', 'placeholder')}
            disabled={!aiConfigured || dataLoading}
            enterKeyHint="send"
            autoComplete="off"
          />
          <button
            type="button"
            className="ai-planner__send"
            disabled={!aiConfigured || dataLoading || sending || !input.trim()}
            onClick={() => sendMessage(input)}
            aria-label={t('aiPlanner', 'send')}
          >
            <Icon name="send" size={22} aria-hidden />
            <span className="ai-planner__send-label">{t('aiPlanner', 'send')}</span>
          </button>
        </div>
      </div>

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
                value={selectedDate.toISOString().slice(0, 10)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setSelectedDate(new Date(v + 'T12:00:00'));
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
    </div>
  );
}
