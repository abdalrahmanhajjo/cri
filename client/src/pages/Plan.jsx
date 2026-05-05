import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import {
  getDayCount,
  isValidDateRange,
  ensureDaysWithSlots,
  mergeDaysWithSlotsWhenShrinking,
  toDateOnly,
  BEST_TIME_ORDER,
  buildTripDaysApiPayload,
  hasOverlappingTimeSlots,
  findNextNonOverlappingDateRange,
  tripCalendarRangesOverlap,
  tripPhaseForSort,
  sortTripsSmart,
  quickDatePresetRange,
  datesOnOrAfterToday,
  optimizeSlotsOrder,
  dayFromApiShape,
  placeIdsFromDay,
  getDateForDayIndex,
  formatYMD,
} from '../utils/tripPlannerHelpers';
import { loadSmartScheduleContext, sortAndAssignSmartSlotTimes } from '../utils/smartVisitTiming';
import { getFoodAndStayCategoryIdSets, isDedicatedGuideListing } from '../utils/placeGuideExclusions';
import {
  isManualTripCreateTourDone,
  setManualTripCreateTourDone,
  clearManualTripCreateTour,
  isManualTripBuilderTourDone,
  setManualTripBuilderTourDone,
  clearManualTripBuilderTour,
} from '../utils/manualTripOnboardingStorage';
import AiPlannerOnboarding from '../components/AiPlannerOnboarding';
import { filterPlacesByQuery } from '../utils/searchFilter';
import { orderPlacesByIds } from '../utils/orderPlacesByIds';
import { useFavourites } from '../context/FavouritesContext';

// Components
import { PlanHero } from '../components/plan/PlanHero';
import { PlanTripList } from '../components/plan/PlanTripList';
import { PlanCreateForm } from '../components/plan/PlanCreateForm';
import { PlanBuilderBasics } from '../components/plan/PlanBuilderBasics';
import { PlanBuilderDiscover } from '../components/plan/PlanBuilderDiscover';
import { PlanBuilderFavourites } from '../components/plan/PlanBuilderFavourites';
import { PlanBuilderItinerary } from '../components/plan/PlanBuilderItinerary';
import { PlanDeleteConfirmModal } from '../components/plan/PlanModals';

import './css/Explore.css';
import './css/Plan.css';

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

/** Replace `{key}` placeholders in translation strings. */
function formatPlanToast(template, vars) {
  let s = template;
  Object.entries(vars).forEach(([k, v]) => {
    s = s.split(`{${k}}`).join(String(v));
  });
  return s;
}

function groupPlacesByCategory(places, categories) {
  const byId = new Map();
  (categories || []).forEach((c) => byId.set(c.id, { id: c.id, name: c.name, places: [] }));
  const uncategorized = [];
  places.forEach((p) => {
    const catId = p.categoryId ?? p.category_id;
    const cat = catId ? byId.get(catId) : null;
    if (cat) cat.places.push(p);
    else uncategorized.push(p);
  });
  const sections = [];
  (categories || []).forEach((c) => {
    const list = byId.get(c.id)?.places ?? [];
    if (list.length > 0) sections.push({ id: c.id, name: c.name, places: list });
  });
  if (uncategorized.length > 0) sections.push({ id: 'other', name: 'Other', places: uncategorized });
  return sections;
}

const TIME_SLOTS = ['morning', 'afternoon', 'evening'];
const getDateForDay = getDateForDayIndex;

const INITIAL_BUILDER_SECTION_COLLAPSED = {
  basics: false,
  discover: false,
  favourites: false,
  itinerary: false,
};

export default function Plan() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTripId, setEditingTripId] = useState(null);
  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [favouritePlaces, setFavouritePlaces] = useState([]);
  const [placeMap, setPlaceMap] = useState({});
  const [placeSearch, setPlaceSearch] = useState('');
  const [placeCategoryFilter, setPlaceCategoryFilter] = useState(null);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const categoryFilterRef = useRef(null);
  const [favSearch, setFavSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [placeNames, setPlaceNames] = useState({});
  const [toast, setToast] = useState(null);
  const [dateError, setDateError] = useState(null);
  const [createName, setCreateName] = useState('');
  const [createStart, setCreateStart] = useState('');
  const [createEnd, setCreateEnd] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [deletingTripId, setDeletingTripId] = useState(null);
  const [tripDeleteConfirmId, setTripDeleteConfirmId] = useState(null);
  const [schedulingDayIndex, setSchedulingDayIndex] = useState(null);
  const [builderSectionCollapsed, setBuilderSectionCollapsed] = useState(() => ({
    ...INITIAL_BUILDER_SECTION_COLLAPSED,
  }));
  const [tripListSearch, setTripListSearch] = useState('');
  const [tripFilterFrom, setTripFilterFrom] = useState('');
  const [tripFilterTo, setTripFilterTo] = useState('');
  const [tripFilterPhase, setTripFilterPhase] = useState('all');
  const [tripFilterStops, setTripFilterStops] = useState('any');
  const [tripFiltersOpen, setTripFiltersOpen] = useState(false);
  const [incomingShareRequests, setIncomingShareRequests] = useState([]);
  const [shareRequestsLoading, setShareRequestsLoading] = useState(false);
  const [shareActionBusyId, setShareActionBusyId] = useState(null);
  const [shareRequestsCollapsed, setShareRequestsCollapsed] = useState(false);
  const [expandedShareRequestIds, setExpandedShareRequestIds] = useState(() => new Set());
  const { settings } = useSiteSettings();
  const { user } = useAuth();
  const { favouriteIds, toggleFavourite: commitFavouriteToggle } = useFavourites();
  const storageUserId = user?.id != null ? String(user.id) : 'anon';

  const tourCreateBtnRef = useRef(null);
  const tourCreateFormRef = useRef(null);
  const tourCreateCalendarRef = useRef(null);
  const tourCreateActionsRef = useRef(null);
  const tourBuilderNavRef = useRef(null);
  const tourBuilderBasicsRef = useRef(null);
  const tourBuilderDiscoverRef = useRef(null);
  const tourBuilderFavouritesRef = useRef(null);
  const tourBuilderSaveRef = useRef(null);

  const [createTourOpen, setCreateTourOpen] = useState(false);
  const [createTourStep, setCreateTourStep] = useState(0);
  const [createTourHighlightRect, setCreateTourHighlightRect] = useState(null);
  const [builderTourOpen, setBuilderTourOpen] = useState(false);
  const [builderTourStep, setBuilderTourStep] = useState(0);
  const [builderTourHighlightRect, setBuilderTourHighlightRect] = useState(null);

  const CREATE_TOUR_STEP_COUNT = 5;
  const BUILDER_TOUR_STEP_COUNT = 6;

  const sortedTrips = useMemo(() => sortTripsSmart(trips), [trips]);

  const tripStopsCount = useCallback((tr) => {
    if (!Array.isArray(tr?.days)) return 0;
    return tr.days.reduce((acc, d) => acc + placeIdsFromDay(d).length, 0);
  }, []);

  const filteredSortedTrips = useMemo(() => {
    let list = sortedTrips;
    const q = tripListSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((tr) => {
        const name = String(tr.name || '').toLowerCase();
        const desc = String(tr.description || '').toLowerCase();
        return name.includes(q) || desc.includes(q);
      });
    }
    if (tripFilterPhase !== 'all') {
      list = list.filter((tr) => tripPhaseForSort(tr) === tripFilterPhase);
    }
    const f0 = toDateOnly(tripFilterFrom);
    const f1 = toDateOnly(tripFilterTo);
    if (f0 && f1) {
      const rangeStart = f0 <= f1 ? f0 : f1;
      const rangeEnd = f0 <= f1 ? f1 : f0;
      list = list.filter((tr) => tripCalendarRangesOverlap(tr.startDate, tr.endDate, rangeStart, rangeEnd));
    } else if (f0) {
      list = list.filter((tr) => {
        const e = toDateOnly(tr.endDate);
        return e && e >= f0;
      });
    } else if (f1) {
      list = list.filter((tr) => {
        const s = toDateOnly(tr.startDate);
        return s && s <= f1;
      });
    }
    if (tripFilterStops === 'with') {
      list = list.filter((tr) => tripStopsCount(tr) > 0);
    } else if (tripFilterStops === 'without') {
      list = list.filter((tr) => tripStopsCount(tr) === 0);
    }
    return list;
  }, [sortedTrips, tripListSearch, tripFilterFrom, tripFilterTo, tripFilterPhase, tripFilterStops, tripStopsCount]);

  const tripFiltersActive =
    tripListSearch.trim() !== ''
    || !!toDateOnly(tripFilterFrom)
    || !!toDateOnly(tripFilterTo)
    || tripFilterPhase !== 'all'
    || tripFilterStops !== 'any';

  const clearTripListFilters = useCallback(() => {
    setTripListSearch('');
    setTripFilterFrom('');
    setTripFilterTo('');
    setTripFilterPhase('all');
    setTripFilterStops('any');
  }, []);

  const applyTripFilterDatePreset = useCallback((preset) => {
    const today = new Date();
    const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (preset === 'this_month') {
      const s = new Date(d0.getFullYear(), d0.getMonth(), 1);
      const e = new Date(d0.getFullYear(), d0.getMonth() + 1, 0);
      setTripFilterFrom(formatYMD(s));
      setTripFilterTo(formatYMD(e));
    } else if (preset === 'next_month') {
      const s = new Date(d0.getFullYear(), d0.getMonth() + 1, 1);
      const e = new Date(d0.getFullYear(), d0.getMonth() + 2, 0);
      setTripFilterFrom(formatYMD(s));
      setTripFilterTo(formatYMD(e));
    } else if (preset === 'next_30') {
      const e = new Date(d0);
      e.setDate(e.getDate() + 29);
      setTripFilterFrom(formatYMD(d0));
      setTripFilterTo(formatYMD(e));
    } else if (preset === 'clear') {
      setTripFilterFrom('');
      setTripFilterTo('');
    }
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadTrips = useCallback(() => {
    setTripsLoading(true);
    api.user
      .trips()
      .then((data) => setTrips(data.trips || []))
      .catch((err) => setTripsError(err.message || 'Failed to load trips'))
      .finally(() => setTripsLoading(false));
  }, []);

  const loadIncomingShareRequests = useCallback(() => {
    setShareRequestsLoading(true);
    api.user
      .tripShareRequests({ box: 'inbox', status: 'pending' })
      .then((data) => {
        setIncomingShareRequests(Array.isArray(data?.requests) ? data.requests : []);
      })
      .catch(() => {
        setIncomingShareRequests([]);
      })
      .finally(() => setShareRequestsLoading(false));
  }, []);

  const loadPlacesAndCategories = useCallback(() => {
    Promise.all([
      api.places.list({ lang: langParam }).catch(() => ({ popular: [] })),
      api.categories.list({ lang: langParam }).catch(() => ({ categories: [] })),
    ]).then(([placesRes, catRes]) => {
      const pl = Array.isArray(placesRes?.popular) ? placesRes.popular : (Array.isArray(placesRes?.locations) ? placesRes.locations : []);
      const cat = Array.isArray(catRes?.categories) ? catRes.categories : [];
      setPlaces(pl);
      setCategories(cat);
      setPlaceMap((prev) => {
        const next = { ...prev };
        pl.forEach((p) => { next[String(p.id)] = p; });
        return next;
      });
    });
  }, [langParam]);

  const { foodCategoryIds, stayCategoryIds } = useMemo(
    () => getFoodAndStayCategoryIdSets(categories),
    [categories]
  );

  const favouriteIdsKey = useMemo(
    () => [...favouriteIds].map(String).sort().join(','),
    [favouriteIds]
  );

  useEffect(() => {
    if (!user) {
      setFavouritePlaces([]);
      return undefined;
    }
    const ids = favouriteIdsKey ? favouriteIdsKey.split(',') : [];
    if (ids.length === 0) {
      setFavouritePlaces([]);
      return undefined;
    }
    let cancelled = false;
    Promise.all(ids.map((id) => api.places.get(id).catch(() => null))).then((results) => {
      if (cancelled) return;
      const list = results.filter(Boolean);
      const ordered = orderPlacesByIds(ids, list);
      setFavouritePlaces(ordered);
      setPlaceMap((prev) => {
        const next = { ...prev };
        ordered.forEach((p) => {
          next[String(p.id)] = p;
        });
        return next;
      });
      setPlaceNames((prev) => {
        const next = { ...prev };
        ordered.forEach((p) => {
          next[String(p.id)] = p.name || p.id;
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [user, favouriteIdsKey]);

  const filteredPlaces = useMemo(() => {
    let list = places.filter((p) => !isDedicatedGuideListing(p, foodCategoryIds, stayCategoryIds));
    list = filterPlacesByQuery(list, placeSearch);
    if (placeCategoryFilter) {
      list = list.filter((p) => (p.categoryId ?? p.category_id) === placeCategoryFilter);
    }
    return list;
  }, [places, placeSearch, placeCategoryFilter, foodCategoryIds, stayCategoryIds]);

  const placeSections = useMemo(
    () => groupPlacesByCategory(filteredPlaces, categories),
    [filteredPlaces, categories]
  );

  const filteredFavourites = useMemo(
    () => filterPlacesByQuery(favouritePlaces, favSearch),
    [favouritePlaces, favSearch]
  );

  useEffect(() => { loadTrips(); }, [loadTrips]);
  useEffect(() => { loadIncomingShareRequests(); }, [loadIncomingShareRequests]);

  useEffect(() => {
    if (tripsLoading) return;
    const editId = searchParams.get('edit');
    if (!editId) return;
    const existingTrip = trips.find((tr) => tr.id === editId);
    if (existingTrip) {
      if (existingTrip.isHost === false) {
        showToast('Only the host can edit this trip.', 'error');
        const next = new URLSearchParams(searchParams);
        next.delete('edit');
        setSearchParams(next, { replace: true });
        return;
      }
      setEditingTripId(editId);
      setShowCreateForm(false);
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
      return;
    }
    let cancelled = false;
    api.user
      .getTrip(editId)
      .then((trip) => {
        if (cancelled || !trip?.id) return;
        if (trip.isHost === false) {
          showToast('Only the host can edit this trip.', 'error');
          const next = new URLSearchParams(searchParams);
          next.delete('edit');
          setSearchParams(next, { replace: true });
          return;
        }
        setTrips((prev) => (prev.some((t) => t.id === trip.id) ? prev : [trip, ...prev]));
        setEditingTripId(editId);
        setShowCreateForm(false);
        const next = new URLSearchParams(searchParams);
        next.delete('edit');
        setSearchParams(next, { replace: true });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tripsLoading, trips, searchParams, setSearchParams, showToast]);
  useEffect(() => { loadPlacesAndCategories(); }, [loadPlacesAndCategories]);

  useEffect(() => {
    if (!categoryFilterOpen) return;
    const close = () => setCategoryFilterOpen(false);
    const onDoc = (e) => {
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [categoryFilterOpen]);

  const toggleFavourite = useCallback(
    async (placeId) => {
      const id = String(placeId);
      const wasFav = favouriteIds.has(id);
      const r = await commitFavouriteToggle(id);
      if (!r.ok) {
        if (r.reason === 'busy') return;
        showToast(t('feedback', 'favouriteUpdateFailed'), 'error');
        return;
      }
      showToast(
        wasFav ? t('home', 'planToastFavouriteOff') : t('home', 'planToastFavouriteOn'),
        wasFav ? 'info' : 'success'
      );
    },
    [favouriteIds, commitFavouriteToggle, showToast, t]
  );

  const editingTrip = useMemo(
    () => (editingTripId ? sortedTrips.find((tr) => tr.id === editingTripId) ?? null : null),
    [sortedTrips, editingTripId]
  );
  const [editDays, setEditDays] = useState([]);
  const [editName, setEditName] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const prevEditStateRef = useRef(null);

  useEffect(() => {
    if (!editingTrip) {
      setEditDays([]);
      setEditName('');
      setEditStart('');
      setEditEnd('');
      setEditDescription('');
      setNameError('');
      prevEditStateRef.current = null;
      return;
    }
    const start = toDateOnly(editingTrip.startDate);
    const end = toDateOnly(editingTrip.endDate);
    const dc = getDayCount(start || editingTrip.startDate, end || editingTrip.endDate);
    const days = ensureDaysWithSlots(editingTrip.days, dc);
    setEditName(editingTrip.name || '');
    setEditStart(start);
    setEditEnd(end);
    setEditDescription(editingTrip.description != null ? String(editingTrip.description) : '');
    setEditDays(days);
    prevEditStateRef.current = {
      name: editingTrip.name || '',
      start,
      end,
      description: editingTrip.description != null ? String(editingTrip.description) : '',
      days: JSON.stringify(days),
    };
    const placeIds = days.flatMap((d) => placeIdsFromDay(d));
    if (placeIds.length > 0) {
      Promise.all(placeIds.map((id) => api.places.get(id).catch(() => null))).then((placesRes) => {
        placesRes.filter(Boolean).forEach((p) => {
          setPlaceMap((prev) => ({ ...prev, [String(p.id)]: p }));
          setPlaceNames((prev) => ({ ...prev, [String(p.id)]: p.name || p.id }));
        });
      });
    }
  }, [editingTripId, editingTrip]);

  useEffect(() => {
    if (!editingTripId) {
      setBuilderSectionCollapsed({ ...INITIAL_BUILDER_SECTION_COLLAPSED });
    }
  }, [editingTripId]);

  const toggleBuilderSection = useCallback((key) => {
    setBuilderSectionCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const expandBuilderSection = useCallback((key) => {
    setBuilderSectionCollapsed((prev) => {
      if (!prev[key]) return prev;
      return { ...prev, [key]: false };
    });
  }, []);

  const [planSkipFabTarget, setPlanSkipFabTarget] = useState(null);

  const updatePlanSkipFabTarget = useCallback(() => {
    if (typeof document === 'undefined') return;
    const vh = window.innerHeight;
    const probeY = vh * 0.22;

    const itineraryEl = document.getElementById('plan-itinerary');
    if (itineraryEl) {
      const ir = itineraryEl.getBoundingClientRect();
      if (probeY >= ir.top && probeY <= ir.bottom) {
        setPlanSkipFabTarget(null);
        return;
      }
    }

    const chain = [
      ['plan-basics', 'discover'],
      ['plan-discover', 'favourites'],
      ['plan-favourites', 'itinerary'],
    ];

    for (const [sectionId, nextKey] of chain) {
      const el = document.getElementById(sectionId);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (probeY >= r.top && probeY <= r.bottom) {
        setPlanSkipFabTarget(nextKey);
        return;
      }
    }

    let bestNext = 'discover';
    let bestVis = 0;
    for (const [sectionId, nextKey] of chain) {
      const el = document.getElementById(sectionId);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (vis > bestVis) {
        bestVis = vis;
        bestNext = nextKey;
      }
    }
    if (itineraryEl) {
      const ir = itineraryEl.getBoundingClientRect();
      const visI = Math.max(0, Math.min(ir.bottom, vh) - Math.max(ir.top, 0));
      if (visI > bestVis) {
        setPlanSkipFabTarget(null);
        return;
      }
    }
    setPlanSkipFabTarget(bestVis > 48 ? bestNext : null);
  }, []);

  const advancePlanBuilderStep = useCallback(
    (targetKey) => {
      const scrollTargetIds = {
        basics: 'plan-basics',
        discover: 'plan-discover',
        favourites: 'plan-favourites',
        itinerary: 'plan-itinerary',
      };
      const id = scrollTargetIds[targetKey];
      if (!id) return;
      flushSync(() => {
        setBuilderSectionCollapsed((prev) => ({
          ...prev,
          [targetKey]: false,
        }));
      });
      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(updatePlanSkipFabTarget, 480);
      });
    },
    [updatePlanSkipFabTarget]
  );

  useEffect(() => {
    if (!editingTripId) {
      setPlanSkipFabTarget(null);
      return undefined;
    }
    updatePlanSkipFabTarget();
    const onScroll = () => updatePlanSkipFabTarget();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [editingTripId, builderSectionCollapsed, updatePlanSkipFabTarget]);

  useEffect(() => {
    if (!editingTrip || editStart === '' || editEnd === '') return;
    const count = getDayCount(editStart, editEnd);
    setEditDays((prev) => {
      if (count < prev.length) return mergeDaysWithSlotsWhenShrinking(prev, count);
      return ensureDaysWithSlots(prev, count);
    });
  }, [editStart, editEnd, editingTrip]);

  const hasUnsavedChanges = editingTrip && prevEditStateRef.current && (
    editName !== prevEditStateRef.current.name ||
    editStart !== prevEditStateRef.current.start ||
    editEnd !== prevEditStateRef.current.end ||
    editDescription !== (prevEditStateRef.current.description || '') ||
    JSON.stringify(editDays) !== prevEditStateRef.current.days
  );

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const name = createName.trim();
    const start = toDateOnly(createStart);
    const end = toDateOnly(createEnd);
    setNameError('');
    if (!name) {
      setNameError(t('home', 'tripNameRequired'));
      showToast(t('home', 'tripNameRequired'), 'error');
      return;
    }
    if (!start || !end) {
      showToast(t('home', 'planToastDatesMissing'), 'error');
      return;
    }
    if (!isValidDateRange(start, end)) {
      setDateError(t('home', 'dateInvalid'));
      showToast(t('home', 'dateInvalid'), 'error');
      return;
    }
    if (!datesOnOrAfterToday(start, end)) {
      setDateError(t('home', 'datePast'));
      showToast(t('home', 'datePast'), 'error');
      return;
    }
    setSaving(true);
    api.user
      .createTrip({
        name,
        startDate: start,
        endDate: end,
        description: createDescription.trim() || null,
      })
      .then((data) => {
        setTrips((prev) => [data, ...prev]);
        setShowCreateForm(false);
        setCreateName('');
        setCreateStart('');
        setCreateEnd('');
        setCreateDescription('');
        setEditingTripId(data.id);
        showToast(t('home', 'planToastTripCreated'), 'success');
      })
      .catch((err) => {
        const msg =
          err?.data?.code === 'TRIP_DATE_OVERLAP'
            ? t('home', 'tripDateOverlap')
            : err.message || t('home', 'tripSaveFailed');
        showToast(msg, 'error');
      })
      .finally(() => setSaving(false));
  };

  const handleSaveTrip = useCallback(() => {
    if (!editingTripId) return;
    const name = editName.trim();
    const start = toDateOnly(editStart);
    const end = toDateOnly(editEnd);
    setNameError('');
    if (!name) {
      setNameError(t('home', 'tripNameRequired'));
      showToast(t('home', 'tripNameRequired'), 'error');
      return;
    }
    if (!start || !end) {
      showToast(t('home', 'planToastDatesMissing'), 'error');
      return;
    }
    if (!isValidDateRange(start, end)) {
      setDateError(t('home', 'dateInvalid'));
      showToast(t('home', 'dateInvalid'), 'error');
      return;
    }
    if (hasOverlappingTimeSlots(editDays)) {
      showToast(t('home', 'tripOverlappingTimes'), 'error');
    }
    setSaving(true);
    const daysPayload = buildTripDaysApiPayload(editDays, start);
    api.user
      .updateTrip(editingTripId, {
        name,
        startDate: start,
        endDate: end,
        description: editDescription.trim() || null,
        days: daysPayload,
      })
      .then((data) => {
        setTrips((prev) => prev.map((tr) => (tr.id === data.id ? data : tr)));
        setEditingTripId(null);
        showToast(t('home', 'planToastTripSaved'), 'success');
      })
      .catch((err) => {
        const msg =
          err?.data?.code === 'TRIP_DATE_OVERLAP'
            ? t('home', 'tripDateOverlap')
            : err.message || t('home', 'tripSaveFailed');
        showToast(msg, 'error');
      })
      .finally(() => setSaving(false));
  }, [editingTripId, editName, editStart, editEnd, editDescription, editDays, showToast, t]);

  const handleCancelEdit = useCallback(() => {
    setEditingTripId(null);
  }, []);

  const handleCloseCreateForm = useCallback(() => {
    setShowCreateForm(false);
  }, []);

  const beginDeleteTrip = useCallback((id) => {
    setTripDeleteConfirmId(id);
  }, []);

  const cancelTripDeleteConfirm = useCallback(() => {
    setTripDeleteConfirmId(null);
  }, []);

  const executeDeleteTrip = useCallback(() => {
    if (!tripDeleteConfirmId || deletingTripId) return;
    setDeletingTripId(tripDeleteConfirmId);
    api.user
      .deleteTrip(tripDeleteConfirmId)
      .then(() => {
        setTrips((prev) => prev.filter((tr) => tr.id !== tripDeleteConfirmId));
        if (editingTripId === tripDeleteConfirmId) setEditingTripId(null);
        showToast(t('home', 'planToastTripDeleted'), 'info');
      })
      .catch((err) => showToast(err.message || t('home', 'tripDeleteFailed'), 'error'))
      .finally(() => {
        setDeletingTripId(null);
        setTripDeleteConfirmId(null);
      });
  }, [tripDeleteConfirmId, deletingTripId, editingTripId, showToast, t]);

  const createTourStepMeta = useMemo(() => [
    { target: 'createBtn', title: t('home', 'manualTourCreateTitle'), body: t('home', 'manualTourCreateBody') },
    { target: 'createForm', title: t('home', 'manualTourFormTitle'), body: t('home', 'manualTourFormBody') },
    { target: 'createCalendar', title: t('home', 'manualTourCalendarTitle'), body: t('home', 'manualTourCalendarBody') },
    { target: 'createActions', title: t('home', 'manualTourActionsTitle'), body: t('home', 'manualTourActionsBody') },
    { target: null, title: t('home', 'manualTourDoneTitle'), body: t('home', 'manualTourDoneBody') },
  ], [t]);

  const createTourRefMap = useMemo(() => ({
    createBtn: tourCreateBtnRef,
    createForm: tourCreateFormRef,
    createCalendar: tourCreateCalendarRef,
    createActions: tourCreateActionsRef,
  }), []);

  const builderTourStepMeta = useMemo(() => [
    { target: 'nav', title: t('home', 'manualTourNavTitle'), body: t('home', 'manualTourNavBody') },
    { target: 'basics', title: t('home', 'manualTourBasicsTitle'), body: t('home', 'manualTourBasicsBody') },
    { target: 'discover', title: t('home', 'manualTourDiscoverTitle'), body: t('home', 'manualTourDiscoverBody') },
    { target: 'favourites', title: t('home', 'manualTourFavTitle'), body: t('home', 'manualTourFavBody') },
    { target: 'itinerary', title: t('home', 'manualTourItineraryTitle'), body: t('home', 'manualTourItineraryBody') },
    { target: 'save', title: t('home', 'manualTourSaveTitle'), body: t('home', 'manualTourSaveBody') },
  ], [t]);

  const builderTourRefMap = useMemo(() => ({
    nav: tourBuilderNavRef,
    basics: tourBuilderBasicsRef,
    discover: tourBuilderDiscoverRef,
    favourites: tourBuilderFavouritesRef,
    itinerary: { current: typeof document !== 'undefined' ? document.getElementById('plan-itinerary') : null },
    save: tourBuilderSaveRef,
  }), []);

  const expandForBuilderTourTarget = useCallback((target) => {
    if (target === 'basics') expandBuilderSection('basics');
    if (target === 'discover') expandBuilderSection('discover');
    if (target === 'favourites') expandBuilderSection('favourites');
    if (target === 'itinerary') expandBuilderSection('itinerary');
  }, [expandBuilderSection]);

  const syncCreateTourHighlightForStep = useCallback(() => {
    if (!createTourOpen) return;
    const ref = createTourStepMeta[createTourStep]?.target ? createTourRefMap[createTourStepMeta[createTourStep].target] : null;
    if (!ref?.current) {
      setCreateTourHighlightRect(null);
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
    setCreateTourHighlightRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [createTourOpen, createTourStep, createTourStepMeta, createTourRefMap, showCreateForm]);

  const syncBuilderTourHighlightForStep = useCallback(() => {
    if (!builderTourOpen) return;
    const stepMeta = builderTourStepMeta[builderTourStep];
    const key = stepMeta?.target;
    if (key) {
      flushSync(() => {
        expandForBuilderTourTarget(key);
      });
    }
    const ref = key ? builderTourRefMap[key] : null;
    if (!key || !ref?.current) {
      setBuilderTourHighlightRect(null);
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
    setBuilderTourHighlightRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [builderTourOpen, builderTourStep, builderTourStepMeta, builderTourRefMap, expandForBuilderTourTarget]);

  useLayoutEffect(() => {
    if (!createTourOpen) {
      setCreateTourHighlightRect(null);
      return;
    }
    let cancelled = false;
    syncCreateTourHighlightForStep();
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      syncCreateTourHighlightForStep();
      requestAnimationFrame(() => {
        if (!cancelled) syncCreateTourHighlightForStep();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [createTourOpen, createTourStep, showCreateForm, syncCreateTourHighlightForStep]);

  useLayoutEffect(() => {
    if (!builderTourOpen) {
      setBuilderTourHighlightRect(null);
      return;
    }
    let cancelled = false;
    syncBuilderTourHighlightForStep();
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      syncBuilderTourHighlightForStep();
      requestAnimationFrame(() => {
        if (!cancelled) syncBuilderTourHighlightForStep();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [builderTourOpen, builderTourStep, builderSectionCollapsed, syncBuilderTourHighlightForStep]);

  useEffect(() => {
    if (!createTourOpen) return undefined;
    const onResize = () => syncCreateTourHighlightForStep();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [createTourOpen, syncCreateTourHighlightForStep]);

  useEffect(() => {
    if (!builderTourOpen) return undefined;
    const onResize = () => syncBuilderTourHighlightForStep();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [builderTourOpen, syncBuilderTourHighlightForStep]);

  const finishCreateTour = useCallback(() => {
    setCreateTourOpen(false);
    setCreateTourStep(0);
    setCreateTourHighlightRect(null);
    setManualTripCreateTourDone(storageUserId);
  }, [storageUserId]);

  const finishBuilderTour = useCallback(() => {
    setBuilderTourOpen(false);
    setBuilderTourStep(0);
    setBuilderTourHighlightRect(null);
    setManualTripBuilderTourDone(storageUserId);
  }, [storageUserId]);

  const startCreateTour = useCallback(() => {
    clearManualTripCreateTour(storageUserId);
    setBuilderTourOpen(false);
    setBuilderTourStep(0);
    setBuilderTourHighlightRect(null);
    setCreateTourStep(0);
    setShowCreateForm(false);
    setCreateTourOpen(true);
  }, [storageUserId]);

  const startBuilderTour = useCallback(() => {
    clearManualTripBuilderTour(storageUserId);
    setCreateTourOpen(false);
    setCreateTourStep(0);
    setCreateTourHighlightRect(null);
    setBuilderTourStep(0);
    setBuilderTourOpen(true);
  }, [storageUserId]);

  useEffect(() => {
    if (!editingTripId || !createTourOpen) return;
    setCreateTourOpen(false);
    setCreateTourStep(0);
    setCreateTourHighlightRect(null);
    setManualTripCreateTourDone(storageUserId);
  }, [editingTripId, createTourOpen, storageUserId]);

  useEffect(() => {
    if (tripsLoading || tripsError || editingTripId) return undefined;
    if (isManualTripCreateTourDone(storageUserId)) return undefined;
    if (showCreateForm) return undefined;
    const id = window.setTimeout(() => setCreateTourOpen(true), 450);
    return () => clearTimeout(id);
  }, [tripsLoading, tripsError, editingTripId, storageUserId, showCreateForm]);

  useEffect(() => {
    if (!editingTripId || tripsLoading || tripsError) return undefined;
    if (isManualTripBuilderTourDone(storageUserId)) return undefined;
    if (createTourOpen) return undefined;
    const id = window.setTimeout(() => setBuilderTourOpen(true), 450);
    return () => clearTimeout(id);
  }, [editingTripId, tripsLoading, tripsError, storageUserId, createTourOpen]);

  const applyEditQuickPreset = useCallback(
    (presetKey) => {
      const r = quickDatePresetRange(presetKey);
      setEditStart(r.start);
      setEditEnd(r.end);
      setDateError(null);
      const label =
        presetKey === 'today'
          ? t('home', 'planQuickToday')
          : presetKey === 'weekend'
            ? t('home', 'planQuickWeekend')
            : t('home', 'planQuickWeek');
      showToast(formatPlanToast(t('home', 'planToastDatesQuick'), { label }), 'info');
    },
    [showToast, t]
  );

  const applyCreateQuickPreset = useCallback(
    (presetKey) => {
      const r = quickDatePresetRange(presetKey);
      setCreateStart(r.start);
      setCreateEnd(r.end);
      setDateError(null);
      const label =
        presetKey === 'today'
          ? t('home', 'planQuickToday')
          : presetKey === 'weekend'
            ? t('home', 'planQuickWeekend')
            : t('home', 'planQuickWeek');
      showToast(formatPlanToast(t('home', 'planToastDatesQuick'), { label }), 'info');
    },
    [showToast, t]
  );

  const onEditCalendarRangeChange = useCallback(
    (start, end) => {
      setEditStart(start);
      setEditEnd(end);
      setDateError(null);
      showToast(t('home', 'planToastDatesCalendar'), 'info');
    },
    [showToast, t]
  );

  const onCreateCalendarRangeChange = useCallback(
    (start, end) => {
      setCreateStart(start);
      setCreateEnd(end);
      setDateError(null);
      showToast(t('home', 'planToastDatesCalendar'), 'info');
    },
    [showToast, t]
  );

  const addPlaceToDay = useCallback(
    (placeId, name, dayIndex) => {
      const idStr = String(placeId);
      const p = placeMap[idStr] ?? places.find((x) => String(x.id) === idStr);
      const label = String((p?.name || name || idStr || '').trim() || idStr);
      if (p) {
        setPlaceMap((prev) => ({ ...prev, [idStr]: p }));
        setPlaceNames((prev) => ({ ...prev, [idStr]: p.name != null ? String(p.name) : idStr }));
      } else if (name) {
        setPlaceNames((prev) => ({ ...prev, [idStr]: name }));
      }
      setEditDays((prev) =>
        prev.map((day, i) => {
          if (i !== dayIndex) return day;
          const slots = dayFromApiShape(day).slots;
          if (slots.some((s) => s.placeId === idStr)) {
            showToast(formatPlanToast(t('home', 'planToastAlreadyOnDay'), { place: label, n: dayIndex + 1 }), 'info');
            return { slots: [...slots] };
          }
          showToast(formatPlanToast(t('home', 'planToastPlaceAdded'), { place: label, n: dayIndex + 1 }), 'success');
          return {
            slots: [...slots, { placeId: idStr, startTime: null, endTime: null, notes: null }],
          };
        })
      );
    },
    [placeMap, places, showToast, t]
  );

  const removePlaceFromDay = useCallback(
    (dayIndex, placeId) => {
      const idStr = String(placeId);
      setEditDays((prev) => {
        const slots = dayFromApiShape(prev[dayIndex]).slots;
        const had = slots.some((s) => s.placeId === idStr);
        const label =
          placeNames[idStr] || placeMap[idStr]?.name || idStr;
        if (had) {
          showToast(formatPlanToast(t('home', 'planToastPlaceRemoved'), { place: label, n: dayIndex + 1 }), 'info');
        }
        return prev.map((day, i) =>
          i === dayIndex ? { slots: slots.filter((s) => s.placeId !== idStr) } : day
        );
      });
    },
    [placeMap, placeNames, showToast, t]
  );

  const updateSlotTime = useCallback((dayIndex, placeId, field, value) => {
    const v = value && String(value).trim() ? String(value).trim().slice(0, 8) : null;
    setEditDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIndex) return day;
        const slots = dayFromApiShape(day).slots.map((s) =>
          s.placeId === placeId ? { ...s, [field]: v } : s
        );
        return { slots };
      })
    );
  }, []);

  const optimizeDayOrder = useCallback(
    async (dayIndex) => {
      const dateYmd = getDateForDay(editStart, dayIndex);
      if (!dateYmd) {
        showToast(t('home', 'planToastSmartNeedDates'), 'error');
        return;
      }
      setSchedulingDayIndex(dayIndex);
      try {
        const ctx = await loadSmartScheduleContext(dateYmd);
        setEditDays((prev) => {
          const slots = dayFromApiShape(prev[dayIndex] ?? { slots: [] }).slots;
          if (!slots.length) return prev;
          const nextSlots = sortAndAssignSmartSlotTimes(slots, placeMap, ctx);
          return prev.map((d, i) => (i === dayIndex ? { slots: nextSlots } : d));
        });
        showToast(formatPlanToast(t('home', 'planToastDaySmartScheduled'), { n: dayIndex + 1 }), 'success');
      } catch {
        setEditDays((prev) => {
          const slots = dayFromApiShape(prev[dayIndex] ?? { slots: [] }).slots;
          if (!slots.length) return prev;
          const sortedSlots = optimizeSlotsOrder(slots, placeMap);
          return prev.map((d, i) => (i === dayIndex ? { slots: sortedSlots } : d));
        });
        showToast(t('home', 'planToastSmartScheduleFailed'), 'error');
      } finally {
        setSchedulingDayIndex(null);
      }
    },
    [editStart, getDateForDay, placeMap, showToast, t]
  );

  const getTripPlaceIds = useCallback((tr) => {
    if (!tr || !Array.isArray(tr.days)) return [];
    return tr.days.flatMap((d) => placeIdsFromDay(d));
  }, []);

  const handleViewTripOnMap = useCallback(
    (tr) => {
      const placeIds = getTripPlaceIds(tr);
      const days = Array.isArray(tr.days) ? tr.days : [{ placeIds }];
      showToast(t('home', 'planToastOpenMap'), 'info');
      navigate('/map', {
        state: {
          tripPlaceIds: placeIds,
          tripDays: days,
          tripName: tr.name || t('home', 'planTitle'),
          tripStartDate: tr.startDate || '',
        },
      });
    },
    [getTripPlaceIds, navigate, showToast, t]
  );

  const handleShareTrip = useCallback((tr) => {
    const name = tr.name || t('home', 'planTitle');
    const url = `${window.location.origin}/trips/${encodeURIComponent(tr.id)}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: name, text: t('home', 'planTitle') + ': ' + name, url })
        .then(() => showToast(t('home', 'linkCopied'))).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => showToast(t('home', 'linkCopied'))).catch(() => {});
    }
  }, [t, showToast]);

  const handleRespondIncomingShare = useCallback(
    (requestId, decision) => {
      if (!requestId || shareActionBusyId) return;
      setShareActionBusyId(requestId);
      api.user
        .respondTripShareRequest(requestId, decision)
        .then(() => {
          if (decision === 'accept') {
            showToast('Trip request accepted and added to your trips.');
            loadTrips();
          } else {
            showToast('Trip request rejected.', 'info');
          }
          loadIncomingShareRequests();
        })
        .catch((err) => {
          showToast(err?.message || t('feedback', 'actionFailed'), 'error');
        })
        .finally(() => setShareActionBusyId(null));
    },
    [shareActionBusyId, showToast, loadTrips, loadIncomingShareRequests, t]
  );

  const toggleRequestExpanded = useCallback((requestId) => {
    setExpandedShareRequestIds((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) next.delete(requestId);
      else next.add(requestId);
      return next;
    });
  }, []);

  const handleDuplicateTrip = useCallback((tr) => {
    const name = (tr.name || t('home', 'planTitle')).trim() + ' (Copy)';
    const start = toDateOnly(tr.startDate);
    const end = toDateOnly(tr.endDate);
    if (!start || !end) {
      showToast(t('home', 'tripSaveFailed'), 'error');
      return;
    }
    const range = findNextNonOverlappingDateRange(trips, start, end);
    if (!range) {
      showToast(t('home', 'tripDuplicateNoFreeRange'), 'error');
      return;
    }
    const { startDate: newStart, endDate: newEnd } = range;
    const shifted = newStart !== start || newEnd !== end;
    setDuplicatingId(tr.id);
    const descCopy = tr.description != null && String(tr.description).trim() ? String(tr.description).trim() : null;
    api.user
      .createTrip({
        name,
        startDate: newStart,
        endDate: newEnd,
        ...(descCopy ? { description: descCopy } : {}),
      })
      .then((created) => {
        const dc = getDayCount(newStart, newEnd);
        const normalized = ensureDaysWithSlots(tr.days, dc);
        const daysPayload = buildTripDaysApiPayload(normalized, newStart);
        const hasPlaces = daysPayload.some((d) => d.slots && d.slots.length > 0);
        if (hasPlaces) {
          return api.user.updateTrip(created.id, { days: daysPayload }).then(() => created);
        }
        return created;
      })
      .then(() => {
        loadTrips();
        showToast(
          shifted
            ? formatPlanToast(t('home', 'tripDuplicateDatesShifted'), { start: newStart, end: newEnd })
            : t('home', 'planToastTripDuplicated')
        );
      })
      .catch((err) => {
        const msg =
          err?.data?.code === 'TRIP_DATE_OVERLAP'
            ? t('home', 'tripDateOverlap')
            : err.message || t('home', 'tripSaveFailed');
        showToast(msg, 'error');
      })
      .finally(() => setDuplicatingId(null));
  }, [loadTrips, showToast, t, trips]);

  const timeSlotLabel = (slot) => {
    if (slot === 'morning') return t('home', 'planTimeMorning');
    if (slot === 'afternoon') return t('home', 'planTimeAfternoon');
    return t('home', 'planTimeEvening');
  };

  const getPlaceForSlot = (placeId, _dayIndex) => {
    const id = String(placeId);
    const p = placeMap[id];
    const bestTime = p?.bestTime ? String(p.bestTime).trim() : '';
    const slot = bestTime in BEST_TIME_ORDER ? String(bestTime).toLowerCase() : 'morning';
    return { placeId: id, slot, name: placeNames[id] || p?.name || id };
  };

  const groupedPlacesBySlot = (dayObj, dayIndex) => {
    const groups = { morning: [], afternoon: [], evening: [] };
    dayFromApiShape(dayObj).slots.forEach((slot) => {
      const { slot: slotKey, name } = getPlaceForSlot(slot.placeId, dayIndex);
      const s = slotKey in groups ? slotKey : 'morning';
      groups[s].push({ placeId: slot.placeId, name, slot });
    });
    return groups;
  };

  const isInBuilder = !!editingTrip;
  const pendingDeleteTrip = tripDeleteConfirmId
    ? trips.find((x) => x.id === tripDeleteConfirmId) ?? null
    : null;

  return (
    <div className="vd plan-page" role="main" aria-label={t('home', 'planTitle')}>
      <PlanHero
        t={t}
        incomingShareRequests={incomingShareRequests}
        shareRequestsCollapsed={shareRequestsCollapsed}
        setShareRequestsCollapsed={setShareRequestsCollapsed}
        expandedShareRequestIds={expandedShareRequestIds}
        toggleRequestExpanded={toggleRequestExpanded}
        handleRespondIncomingShare={handleRespondIncomingShare}
        shareActionBusyId={shareActionBusyId}
        isInBuilder={isInBuilder}
        startCreateTour={startCreateTour}
        aiPlannerEnabled={settings.aiPlannerEnabled}
        showCreateForm={showCreateForm}
        setShowCreateForm={setShowCreateForm}
        tourCreateBtnRef={tourCreateBtnRef}
        showToast={showToast}
      />

      <div className="plan-main">
        {tripsLoading ? (
          <div className="trips-loading">{t('home', 'loading')}</div>
        ) : tripsError ? (
          <div className="trips-error">{tripsError}</div>
        ) : isInBuilder ? (
          <>
          <div className="plan-section-nav-wrap">
          <nav ref={tourBuilderNavRef} className="plan-section-nav" aria-label="Plan sections">
            <a
              href="#plan-basics"
              className={`plan-section-nav-link${builderSectionCollapsed.basics ? ' plan-section-nav-link--collapsed' : ''}`}
              onClick={() => expandBuilderSection('basics')}
            >
              <span className="plan-section-nav-num">1</span>
              <span>{t('home', 'planStepBasics')}</span>
            </a>
            <a
              href="#plan-discover"
              className={`plan-section-nav-link${builderSectionCollapsed.discover ? ' plan-section-nav-link--collapsed' : ''}`}
              onClick={() => expandBuilderSection('discover')}
            >
              <span className="plan-section-nav-num">2</span>
              <span>{t('home', 'planStepDiscover')}</span>
            </a>
            <a
              href="#plan-favourites"
              className={`plan-section-nav-link${builderSectionCollapsed.favourites ? ' plan-section-nav-link--collapsed' : ''}`}
              onClick={() => expandBuilderSection('favourites')}
            >
              <span className="plan-section-nav-num">3</span>
              <span>{t('home', 'planStepSelect')}</span>
            </a>
            <a
              href="#plan-itinerary"
              className={`plan-section-nav-link${builderSectionCollapsed.itinerary ? ' plan-section-nav-link--collapsed' : ''}`}
              onClick={() => expandBuilderSection('itinerary')}
            >
              <span className="plan-section-nav-num">4</span>
              <span>{t('home', 'planStepItinerary')}</span>
            </a>
          </nav>
          <button
            type="button"
            className="plan-manual-tour-btn plan-manual-tour-btn--nav"
            onClick={startBuilderTour}
            title={t('home', 'manualTourRestart')}
            aria-label={t('home', 'manualTourRestartAria')}
          >
            <Icon name="menu_book" size={22} ariaHidden />
          </button>
          </div>
          <div className="plan-unified" id="plan">
            <PlanBuilderBasics
              builderSectionCollapsed={builderSectionCollapsed}
              toggleBuilderSection={toggleBuilderSection}
              handleCancelEdit={handleCancelEdit}
              editName={editName}
              setEditName={setEditName}
              setNameError={setNameError}
              nameError={nameError}
              editDescription={editDescription}
              setEditDescription={setEditDescription}
              applyEditQuickPreset={applyEditQuickPreset}
              editStart={editStart}
              setEditStart={setEditStart}
              editEnd={editEnd}
              setEditEnd={setEditEnd}
              setDateError={setDateError}
              dateError={dateError}
              editDays={editDays}
              placeIdsFromDay={placeIdsFromDay}
              showToast={showToast}
              navigate={navigate}
              onEditCalendarRangeChange={onEditCalendarRangeChange}
              t={t}
              tourBuilderBasicsRef={tourBuilderBasicsRef}
            />

            <PlanBuilderDiscover
              builderSectionCollapsed={builderSectionCollapsed}
              toggleBuilderSection={toggleBuilderSection}
              placeSearch={placeSearch}
              setPlaceSearch={setPlaceSearch}
              categoryFilterRef={categoryFilterRef}
              placeCategoryFilter={placeCategoryFilter}
              categoryFilterOpen={categoryFilterOpen}
              setCategoryFilterOpen={setCategoryFilterOpen}
              showToast={showToast}
              setPlaceCategoryFilter={setPlaceCategoryFilter}
              categories={categories}
              placeSections={placeSections}
              favouriteIds={favouriteIds}
              toggleFavourite={toggleFavourite}
              isInBuilder={isInBuilder}
              editDays={editDays}
              addPlaceToDay={addPlaceToDay}
              formatPlanToast={formatPlanToast}
              t={t}
              tourBuilderDiscoverRef={tourBuilderDiscoverRef}
            />

            <PlanBuilderFavourites
              builderSectionCollapsed={builderSectionCollapsed}
              toggleBuilderSection={toggleBuilderSection}
              favouritePlaces={favouritePlaces}
              favSearch={favSearch}
              setFavSearch={setFavSearch}
              filteredFavourites={filteredFavourites}
              editDays={editDays}
              addPlaceToDay={addPlaceToDay}
              t={t}
              tourBuilderFavouritesRef={tourBuilderFavouritesRef}
            />

            <PlanBuilderItinerary
              builderSectionCollapsed={builderSectionCollapsed}
              toggleBuilderSection={toggleBuilderSection}
              editDays={editDays}
              editStart={editStart}
              getDateForDay={getDateForDay}
              placeIdsFromDay={placeIdsFromDay}
              optimizeDayOrder={optimizeDayOrder}
              schedulingDayIndex={schedulingDayIndex}
              groupedPlacesBySlot={groupedPlacesBySlot}
              TIME_SLOTS={TIME_SLOTS}
              timeSlotLabel={timeSlotLabel}
              updateSlotTime={updateSlotTime}
              removePlaceFromDay={removePlaceFromDay}
              hasUnsavedChanges={hasUnsavedChanges}
              handleSaveTrip={handleSaveTrip}
              handleCancelEdit={handleCancelEdit}
              saving={saving}
              editingTrip={editingTrip}
              editingTripId={editingTripId}
              beginDeleteTrip={beginDeleteTrip}
              deletingTripId={deletingTripId}
              t={t}
              tourBuilderSaveRef={tourBuilderSaveRef}
            />
          </div>
          {planSkipFabTarget ? (
            <button
              type="button"
              className="plan-skip-next-fab"
              onClick={() => advancePlanBuilderStep(planSkipFabTarget)}
              title={t('home', 'planSkipToNextStep')}
              aria-label={t('home', 'planSkipToNextStep')}
            >
              <Icon name="arrow_forward" size={26} ariaHidden />
            </button>
          ) : null}
          </>
        ) : (
          <>
            <PlanTripList
              trips={trips}
              showCreateForm={showCreateForm}
              t={t}
              filteredSortedTrips={filteredSortedTrips}
              tripFiltersActive={tripFiltersActive}
              clearTripListFilters={clearTripListFilters}
              tripFiltersOpen={tripFiltersOpen}
              setTripFiltersOpen={setTripFiltersOpen}
              tripListSearch={tripListSearch}
              setTripListSearch={setTripListSearch}
              tripFilterFrom={tripFilterFrom}
              setTripFilterFrom={setTripFilterFrom}
              tripFilterTo={tripFilterTo}
              setTripFilterTo={setTripFilterTo}
              applyTripFilterDatePreset={applyTripFilterDatePreset}
              tripFilterPhase={tripFilterPhase}
              setTripFilterPhase={setTripFilterPhase}
              tripFilterStops={tripFilterStops}
              setTripFilterStops={setTripFilterStops}
              navigate={navigate}
              handleViewTripOnMap={handleViewTripOnMap}
              handleShareTrip={handleShareTrip}
              handleDuplicateTrip={handleDuplicateTrip}
              beginDeleteTrip={beginDeleteTrip}
              duplicatingId={duplicatingId}
              deletingTripId={deletingTripId}
              placeIdsFromDay={placeIdsFromDay}
              formatPlanToast={formatPlanToast}
            />

            {showCreateForm && (
              <PlanCreateForm
                tourCreateFormRef={tourCreateFormRef}
                handleCreateSubmit={handleCreateSubmit}
                createName={createName}
                setCreateName={setCreateName}
                setNameError={setNameError}
                nameError={nameError}
                createDescription={createDescription}
                setCreateDescription={setCreateDescription}
                applyCreateQuickPreset={applyCreateQuickPreset}
                createStart={createStart}
                setCreateStart={setCreateStart}
                createEnd={createEnd}
                setCreateEnd={setCreateEnd}
                setDateError={setDateError}
                dateError={dateError}
                tourCreateCalendarRef={tourCreateCalendarRef}
                onCreateCalendarRangeChange={onCreateCalendarRangeChange}
                tourCreateActionsRef={tourCreateActionsRef}
                saving={saving}
                handleCloseCreateForm={handleCloseCreateForm}
                t={t}
              />
            )}
          </>
        )}
      </div>

      <AiPlannerOnboarding
        open={createTourOpen}
        stepIndex={createTourStep}
        stepCount={CREATE_TOUR_STEP_COUNT}
        title={createTourStepMeta[createTourStep]?.title ?? ''}
        body={createTourStepMeta[createTourStep]?.body ?? ''}
        highlightRect={createTourHighlightRect}
        onNext={() => {
          if (createTourStep === 1) {
            setShowCreateForm(true);
          }
          if (createTourStep >= CREATE_TOUR_STEP_COUNT - 1) {
            finishCreateTour();
          } else {
            setCreateTourStep((s) => s + 1);
          }
        }}
        onBack={() => {
          if (createTourStep === 0) {
            finishCreateTour();
            return;
          }
          if (createTourStep === 2) {
            setShowCreateForm(false);
          }
          setCreateTourStep((s) => Math.max(0, s - 1));
        }}
        onSkip={finishCreateTour}
        isLastStep={createTourStep === CREATE_TOUR_STEP_COUNT - 1}
        nextLabel={t('aiPlanner', 'onboardingNext')}
        backLabel={t('aiPlanner', 'onboardingBack')}
        skipLabel={t('aiPlanner', 'onboardingSkip')}
        doneLabel={t('aiPlanner', 'onboardingDone')}
        progressLabel={t('aiPlanner', 'onboardingProgress')}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      />
      <AiPlannerOnboarding
        open={builderTourOpen}
        stepIndex={builderTourStep}
        stepCount={BUILDER_TOUR_STEP_COUNT}
        title={builderTourStepMeta[builderTourStep]?.title ?? ''}
        body={builderTourStepMeta[builderTourStep]?.body ?? ''}
        highlightRect={builderTourHighlightRect}
        onNext={() => {
          if (builderTourStep >= BUILDER_TOUR_STEP_COUNT - 1) {
            finishBuilderTour();
          } else {
            setBuilderTourStep((s) => s + 1);
          }
        }}
        onBack={() => {
          if (builderTourStep === 0) {
            finishBuilderTour();
            return;
          }
          setBuilderTourStep((s) => Math.max(0, s - 1));
        }}
        onSkip={finishBuilderTour}
        isLastStep={builderTourStep === BUILDER_TOUR_STEP_COUNT - 1}
        nextLabel={t('aiPlanner', 'onboardingNext')}
        backLabel={t('aiPlanner', 'onboardingBack')}
        skipLabel={t('aiPlanner', 'onboardingSkip')}
        doneLabel={t('aiPlanner', 'onboardingDone')}
        progressLabel={t('aiPlanner', 'onboardingProgress')}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      />

      <PlanDeleteConfirmModal
        tripDeleteConfirmId={tripDeleteConfirmId}
        cancelTripDeleteConfirm={cancelTripDeleteConfirm}
        pendingDeleteTrip={pendingDeleteTrip}
        executeDeleteTrip={executeDeleteTrip}
        deletingTripId={deletingTripId}
        t={t}
      />

      {toast && (
        <div className={`plan-toast plan-toast--${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  );
}
