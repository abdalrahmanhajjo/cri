import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { getPlaceImageUrl } from '../api/client';
import { useSiteSettings } from '../context/SiteSettingsContext';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import { DateRangeCalendar } from '../components/Calendar';
import { filterPlacesByQuery } from '../utils/searchFilter';
import {
  getDayCount,
  isValidDateRange,
  ensureDaysWithSlots,
  mergeDaysWithSlotsWhenShrinking,
  toDateOnly,
  BEST_TIME_ORDER,
  buildTripDaysApiPayload,
  hasOverlappingTimeSlots,
  tripHasDateConflict,
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
import './Explore.css';
import './Plan.css';

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

function PlaceCardDiscover({ place, isFavourite, onToggleFavourite, tripDayCount = 0, onAddToTrip, t }) {
  if (!place || place.id == null) return null;
  const placeId = String(place.id);
  const imgUrl = getPlaceImageUrl(place.image || (Array.isArray(place.images) && place.images[0])) || null;
  const name = place.name != null ? String(place.name) : '';
  const location = place.location != null ? String(place.location) : '';
  const rating = place.rating != null ? Number(place.rating) : null;
  const bestTime = place.bestTime ? String(place.bestTime) : '';
  const duration = place.duration ? String(place.duration) : '';
  const showTripAdd = typeof onAddToTrip === 'function' && tripDayCount > 0;

  return (
    <div className="plan-discover-card">
      <div className="plan-discover-card-top">
        <Link to={`/place/${placeId}`} className="plan-discover-card-link">
          <div
            className="plan-discover-card-media"
            style={imgUrl ? { backgroundImage: `url("${imgUrl}")` } : undefined}
          >
            {imgUrl ? (
              <DeliveryImg url={imgUrl} preset="planDiscover" alt="" />
            ) : (
              <span className="plan-discover-card-fallback">Place</span>
            )}
            <div className="plan-discover-card-overlay">
              <h3 className="plan-discover-card-title">{name || 'Place'}</h3>
              {location && <p className="plan-discover-card-meta">{location}</p>}
            </div>
            {rating != null && !Number.isNaN(rating) && (
              <span className="plan-discover-card-badge plan-discover-card-rating">
                <Icon name="star" size={14} /> {rating.toFixed(1)}
              </span>
            )}
          </div>
        </Link>
        <div className="plan-discover-card-summary">
          <Link to={`/place/${placeId}`} className="plan-discover-card-summary-title">
            {name || 'Place'}
          </Link>
          {location ? <p className="plan-discover-card-summary-loc">{location}</p> : null}
          {rating != null && !Number.isNaN(rating) ? (
            <span className="plan-discover-card-summary-rating">
              <Icon name="star" size={14} ariaHidden /> {rating.toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="plan-discover-card-footer">
        {bestTime && <span className="plan-discover-card-tag">{bestTime}</span>}
        {duration && <span className="plan-discover-card-tag">{duration}</span>}
        <button
          type="button"
          className={`plan-discover-fav-btn ${isFavourite ? 'plan-discover-fav-btn--active' : ''}`}
          onClick={(e) => { e.preventDefault(); onToggleFavourite(placeId); }}
          aria-label={t('home', 'planSavePlace')}
          title={t('home', 'planSavePlaceOptional')}
        >
          <Icon name={isFavourite ? 'favorite' : 'favorite_border'} size={22} />
        </button>
      </div>
      {showTripAdd && (
        <div className="plan-discover-card-add">
          <span className="plan-fav-add-label">{t('home', 'planAddToDay')}:</span>
          <div className="plan-fav-add-btns">
            {Array.from({ length: tripDayCount }, (_, i) => (
              <button
                key={i}
                type="button"
                className="plan-fav-add-day-btn"
                onClick={(e) => {
                  e.preventDefault();
                  onAddToTrip(placeId, name, i);
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FavouriteCard({ place, dayCount, onAddToDay, t }) {
  if (!place || place.id == null) return null;
  const placeId = String(place.id);
  const imgUrl = getPlaceImageUrl(place.image || (Array.isArray(place.images) && place.images[0])) || null;
  const name = place.name != null ? String(place.name) : '';
  const category = place.category || '';
  const location = place.location || '';

  return (
    <div className="plan-fav-card">
      <Link to={`/place/${placeId}`} className="plan-fav-card-media">
        {imgUrl ? <DeliveryImg url={imgUrl} preset="planSquare" alt="" /> : null}
        {!imgUrl && <span className="plan-fav-card-fallback">Place</span>}
      </Link>
      <div className="plan-fav-card-body">
        <Link to={`/place/${placeId}`} className="plan-fav-card-title">{name || placeId}</Link>
        {category && <span className="plan-fav-card-cat">{category}</span>}
        {location && <p className="plan-fav-card-loc">{location}</p>}
        <div className="plan-fav-card-actions">
          <span className="plan-fav-add-label">{t('home', 'planAddToDay')}:</span>
          <div className="plan-fav-add-btns">
            {Array.from({ length: dayCount }, (_, i) => (
              <button
                key={i}
                type="button"
                className="plan-fav-add-day-btn"
                onClick={() => onAddToDay(placeId, name, i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [favouriteIds, setFavouriteIds] = useState(new Set());
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

  const loadFavourites = useCallback(() => {
    api.user
      .favourites()
      .then((res) => {
        const ids = Array.isArray(res.placeIds) ? res.placeIds.map(String) : [];
        setFavouriteIds(new Set(ids));
        if (ids.length === 0) {
          setFavouritePlaces([]);
          return;
        }
        Promise.all(ids.map((id) => api.places.get(id).catch(() => null))).then((results) => {
          const list = results.filter(Boolean);
          setFavouritePlaces(list);
          setPlaceMap((prev) => {
            const next = { ...prev };
            list.forEach((p) => { next[String(p.id)] = p; });
            return next;
          });
          setPlaceNames((prev) => {
            const next = { ...prev };
            list.forEach((p) => { next[String(p.id)] = p.name || p.id; });
            return next;
          });
        });
      })
      .catch(() => { setFavouriteIds(new Set()); setFavouritePlaces([]); });
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

  const filteredPlaces = useMemo(() => {
    let list = filterPlacesByQuery(places, placeSearch);
    if (placeCategoryFilter) {
      list = list.filter((p) => (p.categoryId ?? p.category_id) === placeCategoryFilter);
    }
    return list;
  }, [places, placeSearch, placeCategoryFilter]);

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
  useEffect(() => { loadFavourites(); }, [loadFavourites]);
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

  const toggleFavourite = useCallback((placeId) => {
    const id = String(placeId);
    const isFav = favouriteIds.has(id);
    if (isFav) {
      api.user.removeFavourite(id).catch(() => {});
      setFavouriteIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      setFavouritePlaces((prev) => prev.filter((p) => String(p.id) !== id));
      showToast(t('home', 'planToastFavouriteOff'), 'info');
    } else {
      api.user.addFavourite(id).catch(() => {});
      setFavouriteIds((prev) => new Set([...prev, id]));
      showToast(t('home', 'planToastFavouriteOn'), 'success');
      api.places.get(id).then((p) => {
        if (p) {
          setFavouritePlaces((prev) => {
            if (prev.some((x) => String(x.id) === id)) return prev;
            return [...prev, p];
          });
          setPlaceMap((prev) => ({ ...prev, [id]: p }));
          setPlaceNames((prev) => ({ ...prev, [id]: p.name || id }));
        }
      }).catch(() => {});
    }
  }, [favouriteIds, showToast, t]);

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
      setDateError(t('home', 'tripDatesPast'));
      showToast(t('home', 'tripDatesPast'), 'error');
      return;
    }
    if (tripHasDateConflict(trips, start, end, null)) {
      setDateError(t('home', 'tripDateOverlap'));
      showToast(t('home', 'tripDateOverlap'), 'error');
      return;
    }
    setDateError(null);
    const desc = createDescription.trim();
    setSaving(true);
    api.user
      .createTrip({
        name,
        startDate: start,
        endDate: end,
        ...(desc ? { description: desc } : {}),
      })
      .then((created) => {
        loadTrips();
        setShowCreateForm(false);
        setCreateName('');
        setCreateStart('');
        setCreateEnd('');
        setCreateDescription('');
        setEditingTripId(created.id);
        showToast(t('home', 'planToastTripCreated'));
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

  const handleSaveTrip = () => {
    if (!editingTripId) return;
    if (editingTrip?.isHost === false) {
      showToast('Only the host can edit this trip.', 'error');
      return;
    }
    const name = editName.trim();
    setNameError('');
    if (!name) {
      setNameError(t('home', 'tripNameRequired'));
      showToast(t('home', 'tripNameRequired'), 'error');
      return;
    }
    const start = toDateOnly(editStart);
    const end = toDateOnly(editEnd);
    if (!isValidDateRange(start, end)) {
      setDateError(t('home', 'dateInvalid'));
      showToast(t('home', 'dateInvalid'), 'error');
      return;
    }
    if (tripHasDateConflict(trips, start, end, editingTripId)) {
      setDateError(t('home', 'tripDateOverlap'));
      showToast(t('home', 'tripDateOverlap'), 'error');
      return;
    }
    for (let i = 0; i < editDays.length; i++) {
      const slots = dayFromApiShape(editDays[i]).slots;
      if (hasOverlappingTimeSlots(slots)) {
        showToast(t('home', 'tripTimeConflict'), 'error');
        return;
      }
    }
    setDateError(null);
    const daysPayload = buildTripDaysApiPayload(editDays, start);
    const desc = editDescription.trim();
    setSaving(true);
    api.user
      .updateTrip(editingTripId, {
        name,
        startDate: start,
        endDate: end,
        days: daysPayload,
        description: desc,
      })
      .then(() => {
        loadTrips();
        const nextDesc = desc;
        const nextDays = ensureDaysWithSlots(daysPayload, getDayCount(start, end));
        setEditDays(nextDays);
        prevEditStateRef.current = {
          name,
          start,
          end,
          description: nextDesc,
          days: JSON.stringify(nextDays),
        };
        showToast(t('home', 'planToastTripUpdated'));
        navigate(`/trips/${encodeURIComponent(editingTripId)}`);
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

  const handleDeleteTrip = (id) => {
    if (!id || deletingTripId) return;
    const trip = trips.find((x) => x.id === id);
    if (trip?.isHost === false) {
      showToast('Only the host can delete this trip.', 'error');
      return;
    }
    if (!window.confirm(t('home', 'deleteTrip') + '?')) return;
    setDeletingTripId(id);
    api.user
      .deleteTrip(id)
      .then(() => {
        showToast(t('home', 'planToastTripDeleted'));
        setEditingTripId((current) => (current === id ? null : current));
        loadTrips();
      })
      .catch((err) => showToast(err.message || t('home', 'tripDeleteFailed'), 'error'))
      .finally(() => setDeletingTripId(null));
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges && !window.confirm(t('home', 'unsavedChanges'))) return;
    if (hasUnsavedChanges) showToast(t('home', 'planToastEditDiscarded'), 'info');
    setEditingTripId(null);
    setDateError(null);
    setNameError('');
  };

  const handleCloseCreateForm = () => {
    const hadDraft =
      createName.trim() || createStart || createEnd || createDescription.trim();
    setShowCreateForm(false);
    setDateError(null);
    setNameError('');
    setCreateName('');
    setCreateStart('');
    setCreateEnd('');
    setCreateDescription('');
    if (hadDraft) showToast(t('home', 'planToastCreateFormClosed'), 'info');
  };

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
    if (!Array.isArray(tr.days)) return [];
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

  return (
    <div className="vd plan-page" role="main" aria-label={t('home', 'planTitle')}>
      <header className="plan-hero">
        <div className="plan-hero-inner">
          <h1 className="plan-hero-title">{t('home', 'planTitle')}</h1>
          <p className="plan-hero-sub">{t('home', 'planTripSectionSub')}</p>
        </div>
      </header>

      <div className="plan-main">
        {tripsLoading ? (
          <div className="trips-loading">{t('home', 'loading')}</div>
        ) : tripsError ? (
          <div className="trips-error">{tripsError}</div>
        ) : isInBuilder ? (
          <>
          <nav className="plan-section-nav" aria-label="Plan sections">
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
          <div className="plan-unified" id="plan">
            <section
              className={`plan-unified-section plan-unified-section--basics${builderSectionCollapsed.basics ? ' plan-unified-section--collapsed' : ''}`}
              id="plan-basics"
            >
              <div className="plan-section-head-toggle">
                <div className="plan-section-step">
                  <span className="plan-step-num">1</span>
                  <h2 className="plan-section-title" id="plan-basics-label">{t('home', 'planStepBasics')}</h2>
                </div>
                <button
                  type="button"
                  className="plan-builder-section-toggle"
                  onClick={() => toggleBuilderSection('basics')}
                  aria-expanded={!builderSectionCollapsed.basics}
                  aria-controls="plan-basics-body"
                >
                  <Icon name={builderSectionCollapsed.basics ? 'expand_more' : 'expand_less'} size={22} aria-hidden />
                  <span>{builderSectionCollapsed.basics ? t('home', 'planBuilderSectionShow') : t('home', 'planBuilderSectionHide')}</span>
                </button>
              </div>
              {!builderSectionCollapsed.basics && (
              <div id="plan-basics-body" className="plan-builder-section-body" role="region" aria-labelledby="plan-basics-label">
              <div className="plan-unified-basics">
                <button type="button" className="plan-builder-back" onClick={handleCancelEdit} aria-label={t('home', 'cancel')}>
                  <Icon name="arrow_back" size={22} /> {t('home', 'cancel')}
                </button>
                <div className="plan-unified-basics-form">
                  <input
                    type="text"
                    className="plan-builder-title"
                    value={editName}
                    maxLength={200}
                    onChange={(e) => { setEditName(e.target.value); setNameError(''); }}
                    placeholder={t('home', 'tripNamePlaceholder')}
                    aria-label={t('home', 'tripName')}
                    aria-invalid={!!nameError}
                  />
                  {nameError && <p className="plan-name-error" role="alert">{nameError}</p>}
                  <p className="plan-label plan-notes-label">{t('home', 'tripNotesOptional')}</p>
                  <textarea
                    className="plan-notes-input"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder={t('home', 'tripNotesPlaceholder')}
                    rows={3}
                    maxLength={10000}
                    aria-label={t('home', 'tripNotesOptional')}
                  />
                  <div className="plan-quick-dates" role="group" aria-label={t('home', 'planQuickDates')}>
                    <button type="button" className="plan-quick-date-chip" onClick={() => applyEditQuickPreset('today')}>{t('home', 'planQuickToday')}</button>
                    <button type="button" className="plan-quick-date-chip" onClick={() => applyEditQuickPreset('weekend')}>{t('home', 'planQuickWeekend')}</button>
                    <button type="button" className="plan-quick-date-chip" onClick={() => applyEditQuickPreset('week')}>{t('home', 'planQuickWeek')}</button>
                  </div>
                  <div className="plan-builder-dates">
                    <label>
                      <span className="plan-label">{t('home', 'startDate')}</span>
                      <input type="date" value={editStart} onChange={(e) => { setEditStart(e.target.value); setDateError(null); }} aria-invalid={!!dateError} />
                    </label>
                    <label>
                      <span className="plan-label">{t('home', 'endDate')}</span>
                      <input type="date" value={editEnd} onChange={(e) => { setEditEnd(e.target.value); setDateError(null); }} aria-invalid={!!dateError} />
                    </label>
                  </div>
                </div>
                {editDays.some((d) => placeIdsFromDay(d).length > 0) && (
                  <button
                    type="button"
                    className="plan-builder-map-btn"
                    onClick={() => {
                      showToast(t('home', 'planToastOpenMap'), 'info');
                      navigate('/map', {
                        state: {
                          tripPlaceIds: editDays.flatMap((d) => placeIdsFromDay(d)),
                          tripDays: editDays,
                          tripName: editName || t('home', 'planTitle'),
                          tripStartDate: editStart || '',
                        },
                      });
                    }}
                  >
                    <Icon name="map" size={20} /> {t('detail', 'viewOnMap')}
                  </button>
                )}
              </div>
              {dateError && <p className="plan-date-error" role="alert">{dateError}</p>}
              <div className="plan-calendar-wrap">
                <DateRangeCalendar
                  startDate={editStart || undefined}
                  endDate={editEnd || undefined}
                  onChange={onEditCalendarRangeChange}
                  hintStart={t('home', 'selectStartDate')}
                  hintEnd={t('home', 'selectEndDate')}
                />
              </div>
              </div>
              )}
            </section>

            <section
              className={`plan-unified-section plan-unified-section--discover${builderSectionCollapsed.discover ? ' plan-unified-section--collapsed' : ''}`}
              id="plan-discover"
            >
              <div className="plan-section-head-toggle">
                <div className="plan-section-step">
                  <span className="plan-step-num">2</span>
                  <h2 className="plan-section-title" id="plan-discover-label">{t('home', 'planStepDiscover')}</h2>
                </div>
                <button
                  type="button"
                  className="plan-builder-section-toggle"
                  onClick={() => toggleBuilderSection('discover')}
                  aria-expanded={!builderSectionCollapsed.discover}
                  aria-controls="plan-discover-body"
                >
                  <Icon name={builderSectionCollapsed.discover ? 'expand_more' : 'expand_less'} size={22} aria-hidden />
                  <span>{builderSectionCollapsed.discover ? t('home', 'planBuilderSectionShow') : t('home', 'planBuilderSectionHide')}</span>
                </button>
              </div>
              {!builderSectionCollapsed.discover && (
              <div id="plan-discover-body" className="plan-builder-section-body" role="region" aria-labelledby="plan-discover-label">
              <p className="plan-section-sub">{t('home', 'planDiscoverSub')}</p>
              <div className="plan-discover-toolbar">
                <div className="plan-discover-toolbar-row">
                  <div className="plan-search-wrap plan-search-wrap--grow">
                    <Icon name="search" size={20} className="plan-search-icon" />
                    <input
                      type="search"
                      className="plan-search-input"
                      placeholder={t('home', 'planSearchPlaces')}
                      value={placeSearch}
                      onChange={(e) => setPlaceSearch(e.target.value)}
                      aria-label={t('home', 'planSearchPlaces')}
                    />
                  </div>
                  <div className="plan-category-filter" ref={categoryFilterRef}>
                    <button
                      type="button"
                      className={`plan-category-filter-trigger ${placeCategoryFilter != null ? 'plan-category-filter-trigger--active' : ''} ${categoryFilterOpen ? 'plan-category-filter-trigger--open' : ''}`}
                      aria-expanded={categoryFilterOpen}
                      aria-haspopup="listbox"
                      aria-label={t('home', 'planCategoryFilterBtnAria')}
                      onClick={() => setCategoryFilterOpen((o) => !o)}
                    >
                      <Icon name="filter_list" size={22} ariaHidden />
                    </button>
                    {categoryFilterOpen ? (
                      <div className="plan-category-filter-panel" role="listbox" aria-label={t('home', 'planCategoryFilterHeading')}>
                        <p className="plan-category-filter-panel-title">{t('home', 'planCategoryFilterHeading')}</p>
                        <div className="plan-category-pills plan-category-pills--panel">
                          <button
                            type="button"
                            role="option"
                            aria-selected={placeCategoryFilter == null}
                            className={`plan-category-pill ${!placeCategoryFilter ? 'plan-category-pill--active' : ''}`}
                            onClick={() => {
                              if (placeCategoryFilter != null) {
                                showToast(t('home', 'planToastCategoryAll'), 'info');
                              }
                              setPlaceCategoryFilter(null);
                              setCategoryFilterOpen(false);
                            }}
                          >
                            {t('home', 'planFilterAllCategories')}
                          </button>
                          {categories.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              role="option"
                              aria-selected={placeCategoryFilter === c.id}
                              className={`plan-category-pill ${placeCategoryFilter === c.id ? 'plan-category-pill--active' : ''}`}
                              onClick={() => {
                                const next = placeCategoryFilter === c.id ? null : c.id;
                                setPlaceCategoryFilter(next);
                                setCategoryFilterOpen(false);
                                if (next == null) {
                                  showToast(t('home', 'planToastCategoryAll'), 'info');
                                } else {
                                  showToast(
                                    formatPlanToast(t('home', 'planToastCategoryFilter'), {
                                      label: c.name != null ? String(c.name) : String(c.id),
                                    }),
                                    'info'
                                  );
                                }
                              }}
                            >
                              {c.name || c.id}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="plan-discover-by-category">
                {placeSections.map((sec) => (
                  <div key={sec.id} className="plan-category-section" id={`plan-cat-${sec.id}`}>
                    <h3 className="plan-category-section-title">{sec.name}</h3>
                    <div className="plan-discover-grid">
                      {sec.places.map((p) => (
                        <PlaceCardDiscover
                          key={p.id}
                          place={p}
                          isFavourite={favouriteIds.has(String(p.id))}
                          onToggleFavourite={toggleFavourite}
                          tripDayCount={isInBuilder ? editDays.length : 0}
                          onAddToTrip={isInBuilder ? addPlaceToDay : undefined}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {placeSections.length === 0 && (
                <p className="plan-empty-msg">{t('home', 'noSpots')}</p>
              )}
              </div>
              )}
            </section>

            <section
              className={`plan-unified-section plan-unified-section--favourites${builderSectionCollapsed.favourites ? ' plan-unified-section--collapsed' : ''}`}
              id="plan-favourites"
            >
              <div className="plan-section-head-toggle">
                <div className="plan-section-step">
                  <span className="plan-step-num">3</span>
                  <h2 className="plan-section-title" id="plan-favourites-label">{t('home', 'planFavouritesTitle')}</h2>
                </div>
                <button
                  type="button"
                  className="plan-builder-section-toggle"
                  onClick={() => toggleBuilderSection('favourites')}
                  aria-expanded={!builderSectionCollapsed.favourites}
                  aria-controls="plan-favourites-body"
                >
                  <Icon name={builderSectionCollapsed.favourites ? 'expand_more' : 'expand_less'} size={22} aria-hidden />
                  <span>{builderSectionCollapsed.favourites ? t('home', 'planBuilderSectionShow') : t('home', 'planBuilderSectionHide')}</span>
                </button>
              </div>
              {!builderSectionCollapsed.favourites && (
              <div id="plan-favourites-body" className="plan-builder-section-body" role="region" aria-labelledby="plan-favourites-label">
              <p className="plan-section-sub">{t('home', 'planFavouritesSub')}</p>
              {favouritePlaces.length === 0 ? (
                <div className="plan-fav-empty">
                  <Icon name="favorite_border" size={48} />
                  <p>{t('home', 'planFavouritesEmptyHint')}</p>
                </div>
              ) : (
                <>
                  <div className="plan-fav-search">
                    <div className="plan-search-wrap plan-search-wrap--sm">
                      <Icon name="search" size={18} className="plan-search-icon" />
                      <input
                        type="search"
                        className="plan-search-input"
                        placeholder={t('home', 'planSearchFavourites')}
                        value={favSearch}
                        onChange={(e) => setFavSearch(e.target.value)}
                        aria-label={t('home', 'planSearchFavourites')}
                      />
                    </div>
                  </div>
                  <div className="plan-fav-grid">
                    {filteredFavourites.map((p) => (
                      <FavouriteCard
                        key={p.id}
                        place={p}
                        dayCount={editDays.length}
                        onAddToDay={addPlaceToDay}
                        t={t}
                      />
                    ))}
                  </div>
                  {filteredFavourites.length === 0 && (
                    <p className="plan-empty-msg">{t('home', 'noSavedPlaces')}</p>
                  )}
                </>
              )}
              </div>
              )}
            </section>

            <section
              className={`plan-unified-section plan-unified-section--itinerary${builderSectionCollapsed.itinerary ? ' plan-unified-section--collapsed' : ''}`}
              id="plan-itinerary"
            >
              <div className="plan-section-head-toggle">
                <div className="plan-section-step">
                  <span className="plan-step-num">4</span>
                  <h2 className="plan-section-title" id="plan-itinerary-label">{t('home', 'planStepItinerary')}</h2>
                </div>
                <button
                  type="button"
                  className="plan-builder-section-toggle"
                  onClick={() => toggleBuilderSection('itinerary')}
                  aria-expanded={!builderSectionCollapsed.itinerary}
                  aria-controls="plan-itinerary-body"
                >
                  <Icon name={builderSectionCollapsed.itinerary ? 'expand_more' : 'expand_less'} size={22} aria-hidden />
                  <span>{builderSectionCollapsed.itinerary ? t('home', 'planBuilderSectionShow') : t('home', 'planBuilderSectionHide')}</span>
                </button>
              </div>
              {!builderSectionCollapsed.itinerary && (
              <div id="plan-itinerary-body" className="plan-builder-section-body" role="region" aria-labelledby="plan-itinerary-label">
              <div className="plan-days plan-days--unified">
                {editDays.map((day, i) => {
                  const groups = groupedPlacesBySlot(day, i);
                  const nPlaces = placeIdsFromDay(day).length;
                  return (
                    <div key={i} className="plan-day-card plan-day-card--unified">
                      <h3 className="plan-day-title">
                        {t('home', 'dayLabel')} {i + 1}
                        {editStart && getDateForDay(editStart, i) && (
                          <span className="plan-day-date">
                            {' '}({new Date(getDateForDay(editStart, i) + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })})
                          </span>
                        )}
                      </h3>
                      {nPlaces > 0 && (
                        <>
                          <button
                            type="button"
                            className="plan-optimize-btn"
                            onClick={() => { void optimizeDayOrder(i); }}
                            disabled={schedulingDayIndex !== null}
                          >
                            <Icon name="auto_awesome" size={18} />{' '}
                            {schedulingDayIndex === i ? t('home', 'loading') : t('home', 'planOptimizeOrder')}
                          </button>
                          <p className="plan-smart-schedule-hint">{t('home', 'planSmartScheduleHint')}</p>
                        </>
                      )}
                      <div className="plan-day-slots">
                        {TIME_SLOTS.map((slot) => {
                          const items = groups[slot] || [];
                          if (items.length === 0) return null;
                          return (
                            <div key={slot} className="plan-day-slot">
                              <span className="plan-day-slot-label">{timeSlotLabel(slot)}</span>
                              <ul className="plan-day-places">
                                {items.map(({ placeId, name, slot: slotRow }) => (
                                  <li key={placeId} className="plan-day-place">
                                    <div className="plan-day-place-main">
                                      <Link to={`/place/${placeId}`} className="plan-day-place-link">{name || placeId}</Link>
                                      <div className="plan-slot-times">
                                        <label className="plan-time-field">
                                          <span className="plan-time-field-label">{t('home', 'tripSlotStart')}</span>
                                          <input
                                            type="time"
                                            value={(slotRow.startTime && String(slotRow.startTime).slice(0, 5)) || ''}
                                            onChange={(e) => updateSlotTime(i, placeId, 'startTime', e.target.value ? `${e.target.value}:00` : '')}
                                          />
                                        </label>
                                        <label className="plan-time-field">
                                          <span className="plan-time-field-label">{t('home', 'tripSlotEnd')}</span>
                                          <input
                                            type="time"
                                            value={(slotRow.endTime && String(slotRow.endTime).slice(0, 5)) || ''}
                                            onChange={(e) => updateSlotTime(i, placeId, 'endTime', e.target.value ? `${e.target.value}:00` : '')}
                                          />
                                        </label>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className="plan-day-place-remove"
                                      onClick={() => removePlaceFromDay(i, placeId)}
                                      aria-label={t('home', 'planRemoveFromPlan')}
                                    >
                                      <Icon name="close" size={18} />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                      {nPlaces === 0 && (
                        <p className="plan-day-empty">{t('home', 'planDayEmpty')}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              </div>
              )}
              {hasUnsavedChanges ? (
                <p className="plan-unsaved-hint" role="status">
                  {t('home', 'planUnsavedHint')}
                </p>
              ) : null}
              <div className="plan-builder-actions">
                <button type="button" className="vd-btn vd-btn--primary" onClick={handleSaveTrip} disabled={saving}>
                  {saving ? t('home', 'loading') : t('home', 'saveTrip')}
                </button>
                <button type="button" className="vd-btn vd-btn--secondary" onClick={handleCancelEdit}>
                  {t('home', 'cancel')}
                </button>
                {editingTrip?.isHost !== false && (
                  <button
                    type="button"
                    className="vd-btn plan-delete-btn plan-delete-btn--icon-only"
                    onClick={() => handleDeleteTrip(editingTripId)}
                    disabled={saving || deletingTripId === editingTripId}
                    aria-busy={deletingTripId === editingTripId}
                    aria-label={
                      deletingTripId === editingTripId
                        ? t('home', 'loading')
                        : t('home', 'deleteTrip')
                    }
                  >
                    <Icon name="delete" size={22} ariaHidden />
                  </button>
                )}
              </div>
            </section>
          </div>
          </>
        ) : (
          <>
            <section id="plan" style={{ scrollMarginTop: '100px' }}>
              <div className="plan-section-head">
                <h2 className="plan-section-title">{t('nav', 'myTrips')}</h2>
                <div className="plan-section-head-actions">
                  {settings.aiPlannerEnabled !== false && (
                    <Link to="/plan/ai" className="plan-btn-ai">
                      <Icon name="auto_awesome" size={22} /> {t('nav', 'aiPlanBannerCta')}
                    </Link>
                  )}
                  {!showCreateForm && (
                    <button
                      type="button"
                      className="plan-btn-create"
                      onClick={() => {
                        setShowCreateForm(true);
                        showToast(t('home', 'planToastNewTripForm'), 'info');
                      }}
                    >
                      <Icon name="add" size={24} /> {t('home', 'createTrip')}
                    </button>
                  )}
                </div>
              </div>

              {(shareRequestsLoading || incomingShareRequests.length > 0) && (
                <div className="plan-share-requests-panel">
                  <div className="plan-share-requests-head">
                    <div className="plan-share-requests-heading">
                      <h3>Incoming trip requests</h3>
                      <p>Review shared itineraries before accepting.</p>
                    </div>
                    <div className="plan-share-requests-head-actions">
                      <span className="plan-share-requests-count">{incomingShareRequests.length}</span>
                      <button
                        type="button"
                        className="plan-share-requests-collapse-btn"
                        onClick={() => setShareRequestsCollapsed((v) => !v)}
                      >
                        {shareRequestsCollapsed ? 'Show all' : 'Hide all'}
                      </button>
                    </div>
                  </div>
                  {shareRequestsLoading ? (
                    <p className="plan-share-requests-empty">{t('home', 'loading')}</p>
                  ) : shareRequestsCollapsed ? (
                    <p className="plan-share-requests-empty">Requests hidden.</p>
                  ) : (
                    <ul className="plan-share-requests-list">
                      {incomingShareRequests.map((req) => (
                        <li key={req.id} className="plan-share-request-item">
                        <div className="plan-share-request-top">
                          <p className="plan-share-request-user">
                            <span className="plan-share-request-from-label">From</span>{' '}
                            <strong>{req.fromUser?.name || req.fromUser?.username || 'User'}</strong>
                          </p>
                          <span className="plan-share-request-status">{req.status}</span>
                        </div>
                        {req.fromUser?.username ? (
                          <p className="plan-share-request-handle">{req.fromUser.username}</p>
                        ) : null}
                        <p className="plan-share-request-trip">{req.trip?.name || 'Trip'}</p>
                        <p className="plan-share-request-meta">
                          {req.trip?.dayCount || 0} day(s) - {req.trip?.stopCount || 0} stop(s)
                        </p>
                        {req.createdAt ? (
                          <p className="plan-share-request-time">
                            <Icon name="schedule" size={14} ariaHidden /> {new Date(req.createdAt).toLocaleString()}
                          </p>
                        ) : null}
                        {req.message ? <p className="plan-share-request-message">"{req.message}"</p> : null}
                        <div className="plan-share-request-preview-actions">
                          <button
                            type="button"
                            className="plan-share-request-link-btn"
                            onClick={() => toggleRequestExpanded(req.id)}
                          >
                            {expandedShareRequestIds.has(req.id) ? 'Hide trip details' : 'View trip details'}
                          </button>
                        </div>
                        {expandedShareRequestIds.has(req.id) && (
                          <div className="plan-share-request-details">
                            {Array.isArray(req.trip?.days) && req.trip.days.length > 0 ? (
                              <ul className="plan-share-request-days">
                                {req.trip.days.map((day, idx) => {
                                  const slots = Array.isArray(day?.slots) ? day.slots : [];
                                  const dayPlaceIds = slots.map((s) => String(s.placeId)).filter(Boolean);
                                  return (
                                    <li key={`${req.id}-day-${idx}`} className="plan-share-request-day">
                                      <p className="plan-share-request-day-title">
                                        Day {idx + 1}
                                        {day?.date ? ` - ${day.date}` : ''}
                                        {` (${dayPlaceIds.length} place${dayPlaceIds.length === 1 ? '' : 's'})`}
                                      </p>
                                      {dayPlaceIds.length > 0 ? (
                                        <ul className="plan-share-request-day-places">
                                          {dayPlaceIds.map((pid, pidx) => {
                                            const placeName = placeNames[String(pid)] || placeMap[String(pid)]?.name || pid;
                                            return (
                                              <li key={`${req.id}-day-${idx}-place-${pidx}`} className="plan-share-request-day-place">
                                                {placeName}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      ) : (
                                        <p className="plan-share-request-day-empty">No places in this day.</p>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="plan-share-request-day-empty">No day details provided.</p>
                            )}
                          </div>
                        )}
                        <div className="plan-share-request-actions">
                          <button
                            type="button"
                            className="plan-share-request-btn plan-share-request-btn--accept"
                            onClick={() => handleRespondIncomingShare(req.id, 'accept')}
                            disabled={shareActionBusyId === req.id}
                          >
                            <Icon name="check" size={16} ariaHidden /> Accept
                          </button>
                          <button
                            type="button"
                            className="plan-share-request-btn plan-share-request-btn--reject"
                            onClick={() => handleRespondIncomingShare(req.id, 'reject')}
                            disabled={shareActionBusyId === req.id}
                          >
                            <Icon name="close" size={16} ariaHidden /> Reject
                          </button>
                        </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {trips.length > 0 && !showCreateForm && (
                <div className="plan-trips-filters" aria-label={t('home', 'tripsFilterTitle')}>
                  <div className="plan-trips-filters-toolbar">
                    <p className="plan-trips-filters-results">
                      {formatPlanToast(t('home', 'tripsFilterShowing'), {
                        shown: filteredSortedTrips.length,
                        total: trips.length,
                      })}
                    </p>
                    <div className="plan-trips-filters-toolbar-actions">
                      {tripFiltersActive && (
                        <button type="button" className="plan-trips-filter-clear vd-btn vd-btn--secondary" onClick={clearTripListFilters}>
                          {t('home', 'tripsFilterClearAll')}
                        </button>
                      )}
                      <button
                        type="button"
                        className={`plan-trips-filters-toggle ${tripFiltersOpen ? 'plan-trips-filters-toggle--open' : ''}`}
                        onClick={() => setTripFiltersOpen((o) => !o)}
                        aria-expanded={tripFiltersOpen}
                        aria-controls="plan-trips-filters-panel"
                        id="plan-trips-filters-toggle"
                      >
                        <span>{tripFiltersOpen ? t('home', 'tripsFilterToggleHide') : t('home', 'tripsFilterToggleShow')}</span>
                        <Icon name={tripFiltersOpen ? 'expand_less' : 'expand_more'} size={22} />
                      </button>
                    </div>
                  </div>
                  {tripFiltersOpen && (
                    <div id="plan-trips-filters-panel" className="plan-trips-filters-panel" role="region" aria-labelledby="plan-trips-filters-toggle">
                      <div className="plan-trips-filter-search" role="search">
                        <Icon name="search" size={22} className="plan-trips-filter-search-icon" aria-hidden />
                        <input
                          type="search"
                          className="plan-trips-filter-search-input"
                          value={tripListSearch}
                          onChange={(e) => setTripListSearch(e.target.value)}
                          placeholder={t('home', 'tripsFilterSearchPlaceholder')}
                          aria-label={t('home', 'tripsFilterSearchLabel')}
                        />
                      </div>
                      <div className="plan-trips-filter-group">
                        <span className="plan-trips-filter-label">{t('home', 'tripsFilterWhenLabel')}</span>
                        <div className="plan-trips-filter-dates">
                          <label className="plan-trips-filter-date">
                            <input
                              type="date"
                              value={tripFilterFrom}
                              onChange={(e) => setTripFilterFrom(e.target.value)}
                              aria-label={t('home', 'tripsFilterFrom')}
                            />
                          </label>
                          <span className="plan-trips-filter-date-sep" aria-hidden>–</span>
                          <label className="plan-trips-filter-date">
                            <input
                              type="date"
                              value={tripFilterTo}
                              onChange={(e) => setTripFilterTo(e.target.value)}
                              aria-label={t('home', 'tripsFilterTo')}
                            />
                          </label>
                        </div>
                        <div className="plan-trips-filter-quick-chips" role="group" aria-label={t('home', 'tripsFilterQuickPresets')}>
                          <button type="button" className="plan-quick-date-chip" onClick={() => applyTripFilterDatePreset('this_month')}>
                            {t('home', 'tripsFilterPresetThisMonth')}
                          </button>
                          <button type="button" className="plan-quick-date-chip" onClick={() => applyTripFilterDatePreset('next_month')}>
                            {t('home', 'tripsFilterPresetNextMonth')}
                          </button>
                          <button type="button" className="plan-quick-date-chip" onClick={() => applyTripFilterDatePreset('next_30')}>
                            {t('home', 'tripsFilterPresetNext30')}
                          </button>
                          {(tripFilterFrom || tripFilterTo) && (
                            <button type="button" className="plan-quick-date-chip plan-quick-date-chip--ghost" onClick={() => applyTripFilterDatePreset('clear')}>
                              {t('home', 'tripsFilterClearDates')}
                            </button>
                          )}
                        </div>
                        <div className="plan-calendar-wrap plan-calendar-wrap--trips-filter">
                          <DateRangeCalendar
                            startDate={tripFilterFrom || undefined}
                            endDate={tripFilterTo || undefined}
                            onChange={(start, end) => {
                              setTripFilterFrom(start);
                              setTripFilterTo(end);
                            }}
                            showHint={false}
                          />
                        </div>
                      </div>
                      <div className="plan-trips-filter-group">
                        <span className="plan-trips-filter-label">{t('home', 'tripsFilterPhaseLabel')}</span>
                        <div className="plan-trips-filter-pills" role="group">
                          {(['all', 'upcoming', 'ongoing', 'past']).map((key) => (
                            <button
                              key={key}
                              type="button"
                              className={`plan-trips-filter-pill ${tripFilterPhase === key ? 'plan-trips-filter-pill--active' : ''}`}
                              onClick={() => setTripFilterPhase(key)}
                              aria-pressed={tripFilterPhase === key}
                            >
                              {t('home', key === 'all' ? 'tripsFilterPhaseAll' : key === 'upcoming' ? 'tripsFilterPhaseUpcoming' : key === 'ongoing' ? 'tripsFilterPhaseOngoing' : 'tripsFilterPhasePast')}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="plan-trips-filter-group">
                        <span className="plan-trips-filter-label">{t('home', 'tripsFilterStopsLabel')}</span>
                        <div className="plan-trips-filter-pills" role="group">
                          {(['any', 'with', 'without']).map((key) => (
                            <button
                              key={key}
                              type="button"
                              className={`plan-trips-filter-pill ${tripFilterStops === key ? 'plan-trips-filter-pill--active' : ''}`}
                              onClick={() => setTripFilterStops(key)}
                              aria-pressed={tripFilterStops === key}
                            >
                              {t('home', key === 'any' ? 'tripsFilterStopsAny' : key === 'with' ? 'tripsFilterStopsWith' : 'tripsFilterStopsWithout')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {trips.length === 0 && !showCreateForm && (
                <div className="plan-empty">
                  <p className="plan-empty-title">{t('home', 'planText')}</p>
                  <p className="plan-empty-hint">{t('home', 'planEmptyHint')}</p>
                  <div className="plan-empty-ctas">
                    <Link to="/map" className="vd-btn vd-btn--primary">
                      {t('home', 'viewMapCta')}
                      <Icon name="arrow_forward" size={20} />
                    </Link>
                    <Link to="/favourites" className="vd-btn vd-btn--secondary">
                      {t('nav', 'myFavourites')}
                      <Icon name="arrow_forward" size={20} />
                    </Link>
                  </div>
                </div>
              )}

              {showCreateForm && (
                <form className="plan-create-form" onSubmit={handleCreateSubmit}>
                  <h3 className="plan-form-title">{t('home', 'createTrip')}</h3>
                  <label>
                    <span className="plan-label">{t('home', 'tripName')}</span>
                    <input type="text" value={createName} onChange={(e) => { setCreateName(e.target.value); setNameError(''); }} maxLength={200} placeholder={t('home', 'tripNamePlaceholder')} className="plan-input" aria-invalid={!!nameError} />
                  </label>
                  {nameError && <p className="plan-name-error" role="alert">{nameError}</p>}
                  <label>
                    <span className="plan-label">{t('home', 'tripNotesOptional')}</span>
                    <textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} className="plan-input plan-input--textarea" rows={3} maxLength={10000} placeholder={t('home', 'tripNotesPlaceholder')} />
                  </label>
                  <div className="plan-quick-dates plan-quick-dates--create" role="group" aria-label={t('home', 'planQuickDates')}>
                    <button type="button" className="plan-quick-date-chip" onClick={() => applyCreateQuickPreset('today')}>{t('home', 'planQuickToday')}</button>
                    <button type="button" className="plan-quick-date-chip" onClick={() => applyCreateQuickPreset('weekend')}>{t('home', 'planQuickWeekend')}</button>
                    <button type="button" className="plan-quick-date-chip" onClick={() => applyCreateQuickPreset('week')}>{t('home', 'planQuickWeek')}</button>
                  </div>
                  <div className="plan-create-dates">
                    <label>
                      <span className="plan-label">{t('home', 'startDate')}</span>
                      <input type="date" value={createStart} onChange={(e) => { setCreateStart(e.target.value); setDateError(null); }} className="plan-input" required />
                    </label>
                    <label>
                      <span className="plan-label">{t('home', 'endDate')}</span>
                      <input type="date" value={createEnd} onChange={(e) => { setCreateEnd(e.target.value); setDateError(null); }} className="plan-input" required />
                    </label>
                  </div>
                  {dateError && <p className="plan-date-error" role="alert">{dateError}</p>}
                  <div className="plan-calendar-wrap">
                    <DateRangeCalendar
                      startDate={createStart || undefined}
                      endDate={createEnd || undefined}
                      onChange={onCreateCalendarRangeChange}
                      hintStart={t('home', 'selectStartDate')}
                      hintEnd={t('home', 'selectEndDate')}
                    />
                  </div>
                  <div className="plan-form-actions">
                    <button type="submit" className="vd-btn vd-btn--primary" disabled={saving}>
                      {saving ? t('home', 'loading') : t('home', 'saveTrip')}
                    </button>
                    <button type="button" className="vd-btn vd-btn--secondary" onClick={handleCloseCreateForm}>
                      {t('home', 'cancel')}
                    </button>
                  </div>
                </form>
              )}

              {trips.length > 0 && !showCreateForm && filteredSortedTrips.length === 0 && (
                <p className="plan-trips-filter-empty" role="status">
                  {t('home', 'tripsFilterNoResults')}
                </p>
              )}

              {trips.length > 0 && !showCreateForm && filteredSortedTrips.length > 0 && (
                <ul className="plan-trips-grid">
                  {filteredSortedTrips.map((tr) => {
                    const totalPlaces = Array.isArray(tr.days)
                      ? tr.days.reduce((acc, d) => acc + placeIdsFromDay(d).length, 0)
                      : 0;
                    const numDays = getDayCount(tr.startDate, tr.endDate);
                    const hasPlaces = totalPlaces > 0;
                    const canHostManage = tr.isHost !== false;
                    return (
                      <li key={tr.id} className="plan-trip-card">
                        <button type="button" className="plan-trip-card-inner" onClick={() => navigate(`/trips/${encodeURIComponent(tr.id)}`)}>
                          <h3>{tr.name || t('home', 'planTitle')}</h3>
                          {tr.description && <p className="plan-trip-desc">{tr.description}</p>}
                          <div className="plan-trip-stats">
                            <span className="plan-trip-stat">{numDays} {numDays === 1 ? 'day' : 'days'}</span>
                            <span className="plan-trip-stat">{totalPlaces} {totalPlaces === 1 ? 'place' : 'places'}</span>
                          </div>
                          <p className="plan-trip-meta">
                            {tr.startDate && new Date(toDateOnly(tr.startDate) + 'T12:00:00').toLocaleDateString()}
                            {tr.endDate && ` – ${new Date(toDateOnly(tr.endDate) + 'T12:00:00').toLocaleDateString()}`}
                          </p>
                          <span className="plan-trip-arrow" aria-hidden="true"><Icon name="arrow_forward" size={22} /></span>
                        </button>
                        <div className="plan-trip-card-actions">
                          {hasPlaces && (
                            <button type="button" className="plan-trip-card-btn plan-trip-card-btn--primary" onClick={(e) => { e.stopPropagation(); handleViewTripOnMap(tr); }}>
                              <Icon name="map" size={18} /> {t('detail', 'viewOnMap')}
                            </button>
                          )}
                          <button type="button" className="plan-trip-card-btn" onClick={(e) => { e.stopPropagation(); handleShareTrip(tr); }}>
                            <Icon name="share" size={18} /> {t('detail', 'share')}
                          </button>
                          <button type="button" className="plan-trip-card-btn" onClick={(e) => { e.stopPropagation(); handleDuplicateTrip(tr); }} disabled={duplicatingId === tr.id}>
                            <Icon name="content_copy" size={18} /> {t('home', 'duplicate')}
                          </button>
                          {canHostManage && (
                            <button
                              type="button"
                              className="plan-trip-card-btn plan-trip-card-btn--danger plan-trip-card-btn--icon-only"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTrip(tr.id);
                              }}
                              disabled={deletingTripId === tr.id || duplicatingId === tr.id}
                              aria-busy={deletingTripId === tr.id}
                              aria-label={
                                deletingTripId === tr.id ? t('home', 'loading') : t('home', 'deleteTrip')
                              }
                            >
                              <Icon name="delete" size={20} ariaHidden />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {trips.length > 0 && !showCreateForm && (
                <div className="plan-secondary-ctas">
                  <Link to="/map" className="vd-btn vd-btn--secondary">{t('home', 'viewMapCta')} <Icon name="arrow_forward" size={20} /></Link>
                  <Link to="/favourites" className="vd-btn vd-btn--secondary">{t('nav', 'myFavourites')} <Icon name="arrow_forward" size={20} /></Link>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {toast && (
        <div className={`plan-toast plan-toast--${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  );
}
