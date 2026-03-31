import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import GlobalSearchBar from '../components/GlobalSearchBar';
import SponsoredPlaceCard from '../components/SponsoredPlaceCard';
import { filterPlacesByQuery } from '../utils/searchFilter';
import { sortDiscoverPlaces } from '../utils/placeDiscoverRank';
import { getDayCount, ensureDaysArray, toDateOnly, sortPlacesForItinerary, tripDaysPlaceIdsOnlyToPayload } from '../utils/tripPlannerHelpers';
import { COMMUNITY_PATH } from '../utils/discoverPaths';
import { discoverPlacesListParams } from '../utils/discoverPlaceListParams';
import './PlaceDiscover.css';

function formatTripRange(trip, locale) {
  const a = trip.startDate ? new Date(trip.startDate) : null;
  const b = trip.endDate ? new Date(trip.endDate) : null;
  if (!a || Number.isNaN(a.getTime())) return '';
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (!b || Number.isNaN(b.getTime())) return a.toLocaleDateString(locale, opts);
  return `${a.toLocaleDateString(locale, opts)} – ${b.toLocaleDateString(locale, opts)}`;
}

function DiscoverCard({
  place,
  viewMode,
  onMapClick,
  onAddToTrip,
  viewDetailsLabel,
  mapAriaLabel,
  addToTripLabel,
}) {
  const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
  const rating = place.rating != null ? Number(place.rating).toFixed(1) : null;
  const isList = viewMode === 'list';

  return (
    <div className={`pd-card pd-card--${viewMode}`}>
      <Link to={`/place/${place.id}`} className="pd-card-main">
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

export default function PlaceDiscover() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const toolbarRef = useRef(null);
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const locale = lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-LB' : 'en-GB';
  const discoverListParams = useMemo(() => discoverPlacesListParams(langParam), [langParam]);

  const categoryParam = searchParams.get('category') || '';
  const sortParam = searchParams.get('sort') || 'recommended';
  const qParam = searchParams.get('q') || '';

  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [qDraft, setQDraft] = useState(qParam);
  const [tripPickPlace, setTripPickPlace] = useState(null);
  const [tripModalTrips, setTripModalTrips] = useState([]);
  const [tripModalLoading, setTripModalLoading] = useState(false);
  const [tripAddSaving, setTripAddSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [sponsoredDiscover, setSponsoredDiscover] = useState([]);

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const showToast = useCallback((message, kind = 'info') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    setQDraft(qParam);
  }, [qParam]);

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
      api.places.list(discoverListParams).then((r) => r.popular || r.locations || []),
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
  }, [langParam, discoverListParams]);

  useEffect(() => {
    let cancelled = false;
    api
      .sponsoredPlaces({ surface: 'discover', lang: langParam })
      .then((r) => {
        if (cancelled) return;
        setSponsoredDiscover(Array.isArray(r.items) ? r.items : []);
      })
      .catch(() => {
        if (!cancelled) setSponsoredDiscover([]);
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

  const placeMap = useMemo(() => {
    const m = {};
    (places || []).forEach((p) => {
      if (p && p.id != null) m[String(p.id)] = p;
    });
    return m;
  }, [places]);

  const sponsoredPlaceIdSet = useMemo(() => {
    const s = new Set();
    (sponsoredDiscover || []).forEach((it) => {
      if (it?.placeId != null) s.add(String(it.placeId));
      if (it?.place?.id != null) s.add(String(it.place.id));
    });
    return s;
  }, [sponsoredDiscover]);

  const filteredPlaces = useMemo(() => {
    let base = places;
    if (categoryParam) {
      const id = String(categoryParam);
      base = base.filter((p) => String(p.categoryId ?? p.category_id) === id);
    }
    const q = qParam.trim();
    if (q) {
      const narrow = filterPlacesByQuery(base, q);
      base = narrow.length > 0 ? narrow : base;
    }
    const sorted = sortDiscoverPlaces(base, { query: qParam, sort: sortParam === 'rating' || sortParam === 'name' ? sortParam : 'recommended' });
    if (sponsoredPlaceIdSet.size === 0) return sorted;
    return sorted.slice().sort((a, b) => {
      const sa = sponsoredPlaceIdSet.has(String(a?.id)) ? 1 : 0;
      const sb = sponsoredPlaceIdSet.has(String(b?.id)) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      return 0;
    });
  }, [places, categoryParam, qParam, sortParam, sponsoredPlaceIdSet]);

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
      navigate('/map', {
        state: { tripPlaceIds: [place.id], tripDays: [{ placeIds: [place.id] }], tripName: place.name },
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
    },
    [user, navigate, location.pathname, location.search, location.hash]
  );

  const closeTripModal = useCallback(() => {
    setTripPickPlace(null);
  }, []);

  const addPlaceToTripFirstDay = useCallback(
    async (trip) => {
      if (!tripPickPlace || tripAddSaving) return;
      const start = toDateOnly(trip.startDate);
      const end = toDateOnly(trip.endDate);
      const dayCount = getDayCount(start || trip.startDate, end || trip.endDate);
      const days = ensureDaysArray(trip.days, dayCount);
      const idStr = String(tripPickPlace.id);
      const firstIds = days[0]?.placeIds || [];
      if (firstIds.includes(idStr)) {
        showToast(t('placeDiscover', 'addToTripAlready'), 'info');
        closeTripModal();
        return;
      }
      const mergedIds = sortPlacesForItinerary([...firstIds, idStr], placeMap);
      const newDaysPlaceIds = [{ placeIds: mergedIds }, ...days.slice(1).map((d) => ({ placeIds: [...(d?.placeIds || [])] }))];
      const newDays = tripDaysPlaceIdsOnlyToPayload(newDaysPlaceIds, start || toDateOnly(trip.startDate));

      setTripAddSaving(true);
      try {
        await api.user.updateTrip(trip.id, { days: newDays });
        showToast(
          (t('placeDiscover', 'addToTripSuccess') || '').replace('{name}', trip.name || ''),
          'success'
        );
        closeTripModal();
      } catch (err) {
        showToast(err?.message || t('placeDiscover', 'addToTripFailed'), 'error');
      } finally {
        setTripAddSaving(false);
      }
    },
    [tripPickPlace, tripAddSaving, placeMap, showToast, t, closeTripModal]
  );

  useEffect(() => {
    if (!tripPickPlace) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeTripModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tripPickPlace, closeTripModal]);

  const scrollToFilters = useCallback(() => {
    toolbarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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
            <p className="pd-hero-sub">{t('placeDiscover', 'subtitle')}</p>
          </div>
          <div className="pd-global-search-wrap">
            <GlobalSearchBar
              className="global-search-bar--full"
              idPrefix="place-discover"
              queryValue={qDraft}
              onQueryChange={setQDraft}
              placesListParams={discoverListParams}
            />
          </div>
          <div className="pd-hero-actions" aria-label={t('placeDiscover', 'quickActionsLabel')}>
            <Link to="/map" className="pd-hero-action">
              <Icon name="map" size={20} aria-hidden />
              <span>{t('home', 'viewMap')}</span>
            </Link>
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
                    onClick={() => setViewMode('grid')}
                    aria-pressed={viewMode === 'grid'}
                    aria-label={t('home', 'spotsViewGrid')}
                  >
                    <Icon name="grid_view" size={20} />
                  </button>
                  <button
                    type="button"
                    className={`pd-view-btn ${viewMode === 'list' ? 'pd-view-btn--on' : ''}`}
                    onClick={() => setViewMode('list')}
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
            {sponsoredDiscover.length > 0 && viewMode === 'list' ? (
              <div className="pd-sponsored-block">
                <p className="pd-sponsored-kicker">{t('discover', 'sponsoredDiscoverKicker')}</p>
                <div className="pd-sponsored-inline">
                  <SponsoredPlaceCard item={sponsoredDiscover[0]} t={t} variant="inline" />
                </div>
              </div>
            ) : null}
            {filteredPlaces.map((p) => (
              <DiscoverCard
                key={p.id}
                place={p}
                viewMode={viewMode}
                onMapClick={handleViewOnMap}
                onAddToTrip={openAddToTrip}
                viewDetailsLabel={t('home', 'viewDetails')}
                mapAriaLabel={t('placeDiscover', 'viewOnMap')}
                addToTripLabel={t('placeDiscover', 'addToTrip')}
              />
            ))}
          </section>
        )}
      </div>

      <nav className="pd-app-dock" aria-label={t('placeDiscover', 'dockLabel')}>
        <Link to="/map" className="pd-app-dock__item">
          <Icon name="map" size={22} aria-hidden />
          <span className="pd-app-dock__label">{t('home', 'viewMap')}</span>
        </Link>
        <Link to={COMMUNITY_PATH} className="pd-app-dock__item">
          <Icon name="dynamic_feed" size={22} aria-hidden />
          <span className="pd-app-dock__label">{t('nav', 'communityFeed')}</span>
        </Link>
        <button type="button" className="pd-app-dock__item" onClick={scrollToFilters}>
          <Icon name="tune" size={22} aria-hidden />
          <span className="pd-app-dock__label">{t('placeDiscover', 'openFilters')}</span>
        </button>
      </nav>

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
            <p className="pd-modal-place-name">{tripPickPlace.name}</p>
            <p className="pd-modal-hint">{t('placeDiscover', 'addToTripHint')}</p>

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
              <ul className="pd-modal-trip-list">
                {tripModalTrips.map((tr) => (
                  <li key={tr.id}>
                    <button
                      type="button"
                      className="pd-modal-trip-row"
                      disabled={tripAddSaving}
                      onClick={() => addPlaceToTripFirstDay(tr)}
                    >
                      <span className="pd-modal-trip-text">
                        <span className="pd-modal-trip-name">{tr.name}</span>
                        <span className="pd-modal-trip-dates">{formatTripRange(tr, locale)}</span>
                      </span>
                      <Icon name="chevron_right" size={22} className="pd-modal-trip-chev" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

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
