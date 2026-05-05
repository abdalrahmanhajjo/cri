import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useFavourites } from '../context/FavouritesContext';
import Icon from '../components/Icon';
import GlobalSearchBar from '../components/GlobalSearchBar';
import { filterPlacesByQuery } from '../utils/searchFilter';
import { sortDiscoverPlaces } from '../utils/placeDiscoverRank';
import {
  getDayCount,
  ensureDaysWithSlots,
  toDateOnly,
  buildTripDaysApiPayload,
  hasOverlappingTimeSlots,
  getDateForDayIndex,
} from '../utils/tripPlannerHelpers';
import { useSiteSettings } from '../context/SiteSettingsContext';
import {
  getFoodAndStayCategoryIdSets,
  isDedicatedGuideListing,
} from '../utils/placeGuideExclusions';
import { PLACES_DISCOVER_PATH } from '../utils/discoverPaths';
import './css/PlaceDiscover.css';

function formatTripRange(trip, locale) {
  const a = trip.startDate ? new Date(trip.startDate) : null;
  const b = trip.endDate ? new Date(trip.endDate) : null;
  if (!a || Number.isNaN(a.getTime())) return '';
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (!b || Number.isNaN(b.getTime())) return a.toLocaleDateString(locale, opts);
  return `${a.toLocaleDateString(locale, opts)} – ${b.toLocaleDateString(locale, opts)}`;
}

function normalizeHm(value) {
  if (value == null) return '';
  const raw = String(value).trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Stable id for API calls (favourites, trips) when the list payload uses id vs place_id. */
function resolveDiscoverPlaceId(place) {
  if (!place || typeof place !== 'object') return '';
  const raw = place.id ?? place.place_id ?? place.placeId;
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s || s === 'undefined') return '';
  return s;
}

function DiscoverCard({
  place,
  viewMode,
  onMapClick,
  onAddToTrip,
  onToggleFavourite,
  isFavourite,
  viewDetailsLabel,
  mapAriaLabel,
  addToTripLabel,
  favouriteLabel,
  favouriteBusy,
}) {
  const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
  const rating = place.rating != null ? Number(place.rating).toFixed(1) : null;
  const isList = viewMode === 'list';
  const placeId = resolveDiscoverPlaceId(place);

  return (
    <div className={`pd-card pd-card--${viewMode}`}>
      <Link to={placeId ? `/place/${encodeURIComponent(placeId)}` : '#'} className="pd-card-main">
        <div className="pd-card-media">
          {img ? (
            <DeliveryImg url={img} preset="discoverCard" alt="" />
          ) : (
            <span className="pd-card-fallback">
              <Icon name="place" size={28} />
            </span>
          )}
          <div className="pd-card-media-scrim" aria-hidden />
          {rating && (
            <span className="pd-card-rating">
              <Icon name="star" size={14} /> {rating}
            </span>
          )}
        </div>
        <div className="pd-card-body">
          <h3 className="pd-card-title">{place.name}</h3>
          {place.location && <p className="pd-card-location">{place.location}</p>}
          <span className="pd-card-cta">
            {isList ? <Icon name="arrow_forward" size={18} /> : null}
            <span>{viewDetailsLabel}</span>
          </span>
        </div>
      </Link>
      <div className="pd-card-actions-row">
        {onToggleFavourite && (
          <button
            type="button"
            className={`pd-card-action pd-card-action--fav ${isFavourite ? 'pd-card-action--fav-on' : ''}`}
            onClick={() => onToggleFavourite(place)}
            aria-label={favouriteLabel}
            aria-pressed={Boolean(isFavourite)}
            title={favouriteLabel}
            disabled={favouriteBusy}
            aria-busy={favouriteBusy}
          >
            <Icon name={isFavourite ? 'favorite' : 'favorite_border'} size={20} aria-hidden />
          </button>
        )}
        {onAddToTrip && (
          <button
            type="button"
            className="pd-card-action pd-card-action--trip"
            onClick={() => onAddToTrip(place)}
            aria-label={addToTripLabel}
          >
            <Icon name="event_note" size={20} aria-hidden />
            <span className="pd-card-action-text">{addToTripLabel}</span>
          </button>
        )}
        {onMapClick && (
          <button
            type="button"
            className="pd-card-action pd-card-action--map"
            onClick={() => onMapClick(place)}
            aria-label={mapAriaLabel}
          >
            <Icon name="map" size={20} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

function getDefaultDiscoverViewMode() {
  if (typeof window === 'undefined') return 'grid';
  return window.matchMedia('(max-width: 767px)').matches ? 'list' : 'grid';
}

export default function PlaceDiscover() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { isFavourite, isBusy, toggleFavourite: commitFavouriteToggle } = useFavourites();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const toolbarRef = useRef(null);
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const locale = lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-LB' : 'en-GB';

  const categoryParam = searchParams.get('category') || '';
  const sortParam = searchParams.get('sort') || 'recommended';
  const qParam = searchParams.get('q') || '';

  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState(() => getDefaultDiscoverViewMode());
  const [qDraft, setQDraft] = useState(qParam);
  const [tripPickPlace, setTripPickPlace] = useState(null);
  const [tripModalTrips, setTripModalTrips] = useState([]);
  const [tripModalLoading, setTripModalLoading] = useState(false);
  const [tripAddSaving, setTripAddSaving] = useState(false);
  const [tripActiveId, setTripActiveId] = useState('');
  const [tripDayIndex, setTripDayIndex] = useState(0);
  const [tripStartTime, setTripStartTime] = useState('');
  const [tripEndTime, setTripEndTime] = useState('');
  const [tripAddError, setTripAddError] = useState('');
  const [tripSearchQuery, setTripSearchQuery] = useState('');
  /** 1 = choose trip only; 2 = day & time only (clearer UX). */
  const [tripModalStep, setTripModalStep] = useState(1);
  const [toast, setToast] = useState(null);
  const { settings } = useSiteSettings();

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const hasManualViewChoice = useRef(false);

  const showToast = useCallback((message, kind = 'info') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    setQDraft(qParam);
  }, [qParam]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(max-width: 767px)');
    const syncDefaultView = () => {
      if (!hasManualViewChoice.current) {
        setViewMode(media.matches ? 'list' : 'grid');
      }
    };
    syncDefaultView();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncDefaultView);
      return () => media.removeEventListener('change', syncDefaultView);
    }
    media.addListener(syncDefaultView);
    return () => media.removeListener(syncDefaultView);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      const trimmed = qDraft.trim();
      const cur = (searchParamsRef.current.get('q') || '').trim();
      if (trimmed === cur) return;
      const next = new URLSearchParams(searchParamsRef.current);
      if (trimmed) next.set('q', trimmed);
      else next.delete('q');
      setSearchParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(id);
  }, [qDraft, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.places.list({ lang: langParam }).then((r) => r.popular || r.locations || []),
      api.categories.list({ lang: langParam }).then((r) => r.categories || []),
    ])
      .then(([p, c]) => {
        if (!cancelled) {
          setPlaces(Array.isArray(p) ? p : []);
          setCategories(Array.isArray(c) ? c : []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [langParam]);

  useEffect(() => {
    if (!tripPickPlace || !user) {
      setTripModalTrips([]);
      return;
    }
    let cancelled = false;
    setTripModalLoading(true);
    api.user
      .trips()
      .then((res) => {
        if (!cancelled) setTripModalTrips(Array.isArray(res.trips) ? res.trips : []);
      })
      .catch(() => {
        if (!cancelled) setTripModalTrips([]);
      })
      .finally(() => {
        if (!cancelled) setTripModalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripPickPlace, user]);

  const hiddenRestaurantIds = useMemo(() => {
    const ids = settings?.discoverGuide?.hiddenRestaurantPlaceIds;
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  }, [settings]);

  const { foodCategoryIds, stayCategoryIds } = useMemo(
    () => getFoodAndStayCategoryIdSets(categories),
    [categories]
  );

  const filteredPlaces = useMemo(() => {
    let base = places.filter((p) => {
      if (hiddenRestaurantIds.has(resolveDiscoverPlaceId(p))) return false;
      if (isDedicatedGuideListing(p, foodCategoryIds, stayCategoryIds)) return false;
      return true;
    });
    if (categoryParam) {
      const id = String(categoryParam);
      base = base.filter((p) => String(p.categoryId ?? p.category_id) === id);
    }
    const q = qParam.trim();
    if (q) {
      const narrow = filterPlacesByQuery(base, q);
      base = narrow.length > 0 ? narrow : base;
    }
    return sortDiscoverPlaces(base, { query: qParam, sort: sortParam === 'rating' || sortParam === 'name' ? sortParam : 'recommended' });
  }, [
    places,
    hiddenRestaurantIds,
    foodCategoryIds,
    stayCategoryIds,
    categoryParam,
    qParam,
    sortParam,
  ]);

  const setParam = useCallback(
    (key, value) => {
      const next = new URLSearchParams(searchParams);
      if (value === '' || value == null) next.delete(key);
      else next.set(key, String(value));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleViewOnMap = useCallback(
    (place) => {
      const returnTo = `${location.pathname}${location.search}${location.hash || ''}`;
      if (!user) {
        navigate('/login', { state: { from: returnTo } });
        return;
      }
      const pid = resolveDiscoverPlaceId(place);
      if (!pid) return;
      navigate('/map', {
        state: { tripPlaceIds: [pid], tripDays: [{ placeIds: [pid] }], tripName: place.name },
      });
    },
    [navigate, user, location.pathname, location.search, location.hash]
  );

  const openAddToTrip = useCallback(
    (place) => {
      const returnTo = `${location.pathname}${location.search}${location.hash || ''}`;
      if (!user) {
        navigate('/login', { state: { from: returnTo } });
        return;
      }
      setTripPickPlace(place);
      setTripSearchQuery('');
      setTripModalStep(1);
    },
    [user, navigate, location.pathname, location.search, location.hash]
  );

  const toggleFavourite = useCallback(
    async (place) => {
      const returnTo = `${location.pathname}${location.search}${location.hash || ''}`;
      if (!user) {
        navigate('/login', { state: { from: returnTo } });
        return;
      }
      const placeId = resolveDiscoverPlaceId(place);
      if (!placeId) return;
      const r = await commitFavouriteToggle(placeId);
      if (r.reason === 'auth') {
        navigate('/login', { state: { from: returnTo } });
        return;
      }
      if (!r.ok) {
        if (r.reason === 'busy') return;
        showToast(t('feedback', 'favouriteUpdateFailed'), 'error');
        return;
      }
      showToast(t('feedback', r.added ? 'favouriteAdded' : 'favouriteRemoved'), 'success');
    },
    [commitFavouriteToggle, location.hash, location.pathname, location.search, navigate, showToast, t, user]
  );

  const closeTripModal = useCallback(() => {
    setTripPickPlace(null);
    setTripActiveId('');
    setTripDayIndex(0);
    setTripStartTime('');
    setTripEndTime('');
    setTripAddError('');
    setTripSearchQuery('');
    setTripModalStep(1);
  }, []);

  const selectedTrip = useMemo(
    () => tripModalTrips.find((trip) => String(trip.id) === String(tripActiveId)) || null,
    [tripModalTrips, tripActiveId]
  );

  useEffect(() => {
    if (tripModalStep !== 2 || !tripPickPlace) return;
    if (tripModalLoading) return;
    if (tripModalTrips.length === 0) return;
    if (!tripActiveId || !selectedTrip) setTripModalStep(1);
  }, [tripModalStep, tripPickPlace, tripModalLoading, tripModalTrips.length, tripActiveId, selectedTrip]);

  const selectedTripDayCount = useMemo(() => {
    if (!selectedTrip) return 1;
    const start = toDateOnly(selectedTrip.startDate);
    const end = toDateOnly(selectedTrip.endDate);
    return getDayCount(start || selectedTrip.startDate, end || selectedTrip.endDate);
  }, [selectedTrip]);

  const filteredTripOptions = useMemo(() => {
    const q = tripSearchQuery.trim().toLowerCase();
    if (!q) return tripModalTrips;
    return tripModalTrips.filter((trip) => {
      const haystack = `${trip?.name || ''} ${formatTripRange(trip, locale)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [tripModalTrips, tripSearchQuery, locale]);

  const liveTripValidationError = useMemo(() => {
    if (!tripPickPlace || !selectedTrip) return 'Select a trip first.';
    const startHm = normalizeHm(tripStartTime);
    const endHm = normalizeHm(tripEndTime);
    if (!startHm || !endHm) return 'Select start and end time.';
    if (endHm <= startHm) return 'End time must be after start time.';

    const start = toDateOnly(selectedTrip.startDate);
    const end = toDateOnly(selectedTrip.endDate);
    const dayCount = getDayCount(start || selectedTrip.startDate, end || selectedTrip.endDate);
    const safeDayIndex = Math.min(Math.max(0, tripDayIndex), Math.max(0, dayCount - 1));
    const days = ensureDaysWithSlots(selectedTrip.days, dayCount);
    const daySlots = days[safeDayIndex]?.slots || [];
    const placeId = resolveDiscoverPlaceId(tripPickPlace);
    if (!placeId) return 'This place could not be identified.';
    if (daySlots.some((slot) => String(slot.placeId) === placeId)) return 'This place is already in the selected day.';

    const nextSlot = { placeId, startTime: `${startHm}:00`, endTime: `${endHm}:00`, notes: null };
    if (hasOverlappingTimeSlots([...daySlots, nextSlot])) return 'Selected time conflicts with another place in this day.';
    return '';
  }, [tripPickPlace, selectedTrip, tripStartTime, tripEndTime, tripDayIndex]);

  const addPlaceToTrip = useCallback(async () => {
    if (!tripPickPlace || !selectedTrip || tripAddSaving) return;
    if (liveTripValidationError) {
      setTripAddError(liveTripValidationError);
      return;
    }
    setTripAddError('');
    const startHm = normalizeHm(tripStartTime);
    const endHm = normalizeHm(tripEndTime);

    const start = toDateOnly(selectedTrip.startDate);
    const end = toDateOnly(selectedTrip.endDate);
    const dayCount = getDayCount(start || selectedTrip.startDate, end || selectedTrip.endDate);
    const safeDayIndex = Math.min(Math.max(0, tripDayIndex), Math.max(0, dayCount - 1));
    const days = ensureDaysWithSlots(selectedTrip.days, dayCount).map((day) => ({
      slots: Array.isArray(day?.slots) ? day.slots.map((slot) => ({ ...slot })) : [],
    }));

    const idStr = resolveDiscoverPlaceId(tripPickPlace);
    if (!idStr) {
      setTripAddError('This place could not be identified.');
      return;
    }
    const daySlots = days[safeDayIndex]?.slots || [];
    const nextSlot = { placeId: idStr, startTime: `${startHm}:00`, endTime: `${endHm}:00`, notes: null };

    days[safeDayIndex] = { slots: [...daySlots, nextSlot] };
    const payloadDays = buildTripDaysApiPayload(days, start || toDateOnly(selectedTrip.startDate));

    setTripAddSaving(true);
    try {
      await api.user.updateTrip(selectedTrip.id, { days: payloadDays });
      showToast((t('placeDiscover', 'addToTripSuccess') || '').replace('{name}', selectedTrip.name || ''), 'success');
      closeTripModal();
    } catch (err) {
      setTripAddError(err?.message || t('placeDiscover', 'addToTripFailed'));
    } finally {
      setTripAddSaving(false);
    }
  }, [tripPickPlace, selectedTrip, tripAddSaving, tripStartTime, tripEndTime, tripDayIndex, liveTripValidationError, showToast, t, closeTripModal]);

  useEffect(() => {
    if (!tripPickPlace) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeTripModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tripPickPlace, closeTripModal]);

  useEffect(() => {
    if (!tripPickPlace) return;
    if (tripModalTrips.length < 1) {
      setTripActiveId('');
      return;
    }
    setTripActiveId((prev) => {
      if (prev && tripModalTrips.some((trip) => String(trip.id) === String(prev))) return prev;
      return String(tripModalTrips[0].id);
    });
  }, [tripPickPlace, tripModalTrips]);

  useEffect(() => {
    if (!selectedTrip) return;
    const maxDay = Math.max(0, selectedTripDayCount - 1);
    setTripDayIndex((prev) => Math.min(Math.max(0, prev), maxDay));
  }, [selectedTrip, selectedTripDayCount]);

  const countLabel = (t('placeDiscover', 'resultCount') || '{count} places').replace('{count}', String(filteredPlaces.length));

  if (loading) {
    return (
      <div className="pd-page" role="main">
        <header className="pd-hero pd-hero--loading">
          <div className="pd-hero-inner">
            <div className="pd-skel pd-skel-title" />
            <div className="pd-skel pd-skel-search" />
          </div>
        </header>
        <div className="pd-container">
          <div className="pd-skel-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="pd-skel pd-skel-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pd-page" role="main">
        <div className="pd-container pd-error-wrap">
          <p className="pd-error" role="alert">
            {error}
          </p>
          <Link to="/" className="pd-btn-secondary">
            {t('nav', 'home')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pd-page" role="main">
      <header className="pd-hero pd-hero--clean" aria-labelledby="pd-hero-title">
        <div className="pd-hero-grid" aria-hidden="true" />
        <div className="pd-hero-inner">
          <div className="pd-hero-intro">
            <p className="pd-hero-eyebrow">{t('placeDiscover', 'eyebrow')}</p>
            <h1 id="pd-hero-title" className="pd-hero-title">
              {t('placeDiscover', 'title')}
            </h1>
          </div>
          <div className="pd-global-search-wrap">
            <GlobalSearchBar
              className="global-search-bar--full"
              idPrefix="place-discover"
              queryValue={qDraft}
              onQueryChange={setQDraft}
            />
          </div>
        </div>
      </header>

      <div className="pd-container pd-body">
        <section className="pd-filters-card" aria-label={t('placeDiscover', 'filtersSectionLabel')}>
          <div id="pd-discover-toolbar" ref={toolbarRef} className="pd-toolbar">
            <div className="pd-toolbar-categories">
              <p className="pd-filter-label">{t('placeDiscover', 'categoryLabel')}</p>
              <div className="pd-category-strip" role="group">
                <button
                  type="button"
                  className={`pd-cat-pill ${!categoryParam ? 'pd-cat-pill--active' : ''}`}
                  onClick={() => setParam('category', '')}
                >
                  {t('home', 'spotsAllCategories')}
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`pd-cat-pill ${String(categoryParam) === String(c.id) ? 'pd-cat-pill--active' : ''}`}
                    onClick={() =>
                      setParam('category', String(categoryParam) === String(c.id) ? '' : String(c.id))
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="pd-toolbar-row">
              <span className="pd-count" aria-live="polite">
                {countLabel}
              </span>
              <div className="pd-toolbar-controls">
                <span className="pd-sr-only">{t('placeDiscover', 'sortViewGroupLabel')}</span>
                <label className="pd-sr-only" htmlFor="pd-sort">
                  {t('home', 'spotsSortBy')}
                </label>
                <select id="pd-sort" className="pd-select" value={sortParam} onChange={(e) => setParam('sort', e.target.value)}>
                  <option value="recommended">{t('placeDiscover', 'sortRecommended')}</option>
                  <option value="rating">{t('home', 'spotsSortRating')}</option>
                  <option value="name">{t('home', 'spotsSortName')}</option>
                </select>
                <div className="pd-view" role="group" aria-label={t('placeDiscover', 'viewModeLabel')}>
                  <button
                    type="button"
                    className={`pd-view-btn ${viewMode === 'grid' ? 'pd-view-btn--on' : ''}`}
                    onClick={() => {
                      hasManualViewChoice.current = true;
                      setViewMode('grid');
                    }}
                    aria-pressed={viewMode === 'grid'}
                    aria-label={t('home', 'spotsViewGrid')}
                  >
                    <Icon name="grid_view" size={20} />
                  </button>
                  <button
                    type="button"
                    className={`pd-view-btn ${viewMode === 'list' ? 'pd-view-btn--on' : ''}`}
                    onClick={() => {
                      hasManualViewChoice.current = true;
                      setViewMode('list');
                    }}
                    aria-pressed={viewMode === 'list'}
                    aria-label={t('home', 'spotsViewList')}
                  >
                    <Icon name="view_list" size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <h2 id="pd-results-heading" className="pd-sr-only">
          {t('placeDiscover', 'resultsHeading')}
        </h2>
        {filteredPlaces.length === 0 ? (
          <p className="pd-empty">{t('home', 'noSpots')}</p>
        ) : (
          <section className={`pd-mosaic pd-mosaic--${viewMode}`} aria-labelledby="pd-results-heading">
            {filteredPlaces.map((p) => {
              const rowId = resolveDiscoverPlaceId(p) || String(p.id ?? '');
              return (
                <DiscoverCard
                  key={rowId}
                  place={p}
                  viewMode={viewMode}
                  onMapClick={handleViewOnMap}
                  onAddToTrip={openAddToTrip}
                  onToggleFavourite={toggleFavourite}
                  isFavourite={isFavourite(rowId)}
                  favouriteBusy={isBusy(rowId)}
                  viewDetailsLabel={t('home', 'viewDetails')}
                  mapAriaLabel={t('placeDiscover', 'viewOnMap')}
                  addToTripLabel={t('placeDiscover', 'addToTrip')}
                  favouriteLabel={
                    isFavourite(rowId)
                      ? t('home', 'removeFromFavourites')
                      : user
                        ? t('home', 'addToFavourites')
                        : t('home', 'signInToSave')
                  }
                />
              );
            })}
          </section>
        )}
      </div>

      {tripPickPlace && (
        <div className="pd-modal-backdrop" role="presentation" onClick={closeTripModal}>
          <div
            className="pd-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pd-trip-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pd-modal-header">
              <h2 id="pd-trip-modal-title" className="pd-modal-title">
                {t('placeDiscover', 'addToTripTitle')}
              </h2>
              <button type="button" className="pd-modal-close" onClick={closeTripModal} aria-label={t('placeDiscover', 'modalClose')}>
                <Icon name="close" size={22} />
              </button>
            </div>
            {tripModalStep === 1 ? (
              <>
                <p className="pd-modal-place-name">{tripPickPlace.name}</p>
                <p className="pd-modal-hint">{t('placeDiscover', 'addToTripHint')}</p>
                <p className="pd-modal-step-title">{t('placeDiscover', 'addToTripStepChoose')}</p>

                {tripModalLoading ? (
                  <p className="pd-modal-loading">{t('placeDiscover', 'tripsLoading')}</p>
                ) : tripModalTrips.length === 0 ? (
                  <div className="pd-modal-empty">
                    <p>{t('placeDiscover', 'addToTripEmpty')}</p>
                    <Link to="/plan" className="pd-modal-primary">
                      {t('home', 'createTrip')}
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="pd-modal-search-wrap">
                      <input
                        type="search"
                        className="pd-modal-search"
                        value={tripSearchQuery}
                        onChange={(e) => setTripSearchQuery(e.target.value)}
                        placeholder="Search trip..."
                        aria-label="Search trip"
                      />
                    </div>
                    <ul className="pd-modal-trip-list">
                      {filteredTripOptions.map((tr) => (
                        <li key={tr.id}>
                          <button
                            type="button"
                            className={`pd-modal-trip-row ${String(tr.id) === String(tripActiveId) ? 'is-active' : ''}`}
                            disabled={tripAddSaving}
                            onClick={() => {
                              setTripActiveId(String(tr.id));
                              setTripAddError('');
                            }}
                          >
                            <span className="pd-modal-trip-text">
                              <span className="pd-modal-trip-name">{tr.name}</span>
                              <span className="pd-modal-trip-dates">{formatTripRange(tr, locale)}</span>
                            </span>
                            {String(tr.id) === String(tripActiveId) ? (
                              <Icon name="check" size={20} className="pd-modal-trip-chev" aria-hidden />
                            ) : (
                              <Icon name="chevron_right" size={22} className="pd-modal-trip-chev" aria-hidden />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {!tripModalLoading && filteredTripOptions.length === 0 ? (
                      <p className="pd-modal-loading">No trips match your search.</p>
                    ) : null}
                    <div className="pd-modal-step-footer">
                      <button
                        type="button"
                        className="pd-modal-primary pd-modal-primary--full"
                        disabled={!tripActiveId || tripAddSaving}
                        onClick={() => {
                          setTripAddError('');
                          setTripModalStep(2);
                        }}
                      >
                        {t('placeDiscover', 'addToTripContinue')}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : null}

            {tripModalStep === 2 && selectedTrip ? (
              <div className="pd-modal-trip-editor pd-modal-trip-editor--solo">
                <button
                  type="button"
                  className="pd-modal-back"
                  onClick={() => {
                    setTripAddError('');
                    setTripModalStep(1);
                  }}
                  disabled={tripAddSaving}
                >
                  <Icon name="arrow_back" size={20} aria-hidden />
                  <span>{t('placeDiscover', 'addToTripBack')}</span>
                </button>
                <p className="pd-modal-place-name">{tripPickPlace.name}</p>
                <p className="pd-modal-trip-picked">
                  <span className="pd-modal-trip-picked-name">{selectedTrip.name}</span>
                  <span className="pd-modal-trip-picked-dates">{formatTripRange(selectedTrip, locale)}</span>
                </p>
                <p className="pd-modal-step-title">{t('placeDiscover', 'addToTripStepTiming')}</p>
                <div className="pd-modal-grid">
                  <label className="pd-modal-field">
                    <span>Day</span>
                    <select
                      value={tripDayIndex}
                      onChange={(e) => setTripDayIndex(Number.parseInt(e.target.value, 10) || 0)}
                      disabled={tripAddSaving}
                    >
                      {Array.from({ length: selectedTripDayCount }, (_, idx) => {
                        const dateLabel = getDateForDayIndex(selectedTrip.startDate, idx);
                        return (
                          <option key={idx} value={idx}>
                            {`Day ${idx + 1}${dateLabel ? ` - ${dateLabel}` : ''}`}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="pd-modal-field">
                    <span>Start time</span>
                    <input type="time" value={tripStartTime} onChange={(e) => setTripStartTime(e.target.value)} required />
                  </label>
                </div>
                <div className="pd-modal-grid">
                  <label className="pd-modal-field">
                    <span>End time</span>
                    <input type="time" value={tripEndTime} onChange={(e) => setTripEndTime(e.target.value)} required />
                  </label>
                  <div className="pd-modal-add-wrap">
                    <button
                      type="button"
                      className="pd-modal-primary pd-modal-primary--full"
                      onClick={addPlaceToTrip}
                      disabled={tripAddSaving || !!liveTripValidationError}
                    >
                      {tripAddSaving ? 'Saving...' : 'Add to selected trip'}
                    </button>
                  </div>
                </div>
                {tripAddError || liveTripValidationError ? (
                  <p className="pd-modal-error" role="alert">
                    {tripAddError || liveTripValidationError}
                  </p>
                ) : (
                  <p className="pd-modal-valid">Timing looks good.</p>
                )}
              </div>
            ) : null}

            <div className="pd-modal-footer">
              <Link to="/plan" className="pd-modal-link">
                {t('placeDiscover', 'goToPlan')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`pd-toast pd-toast--${toast.kind}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
}
