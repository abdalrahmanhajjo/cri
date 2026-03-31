import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import api, { getPlaceImageUrl, getImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import GlobalSearchBar from '../components/GlobalSearchBar';
import SponsoredPlaceCard from '../components/SponsoredPlaceCard';
import { filterPlacesByQuery } from '../utils/searchFilter';
import { sortDiscoverPlaces } from '../utils/placeDiscoverRank';
import { getCategoriesForWay } from '../utils/findYourWayGrouping';
import { getDayCount, ensureDaysArray, toDateOnly, sortPlacesForItinerary, tripDaysPlaceIdsOnlyToPayload } from '../utils/tripPlannerHelpers';
import { COMMUNITY_PATH, PLACES_DISCOVER_PATH } from '../utils/discoverPaths';
import { useSiteSettings } from '../context/SiteSettingsContext';
import './PlaceDining.css';

function formatTripRange(trip, locale) {
  const a = trip.startDate ? new Date(trip.startDate) : null;
  const b = trip.endDate ? new Date(trip.endDate) : null;
  if (!a || Number.isNaN(a.getTime())) return '';
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (!b || Number.isNaN(b.getTime())) return a.toLocaleDateString(locale, opts);
  return `${a.toLocaleDateString(locale, opts)} – ${b.toLocaleDateString(locale, opts)}`;
}

function BentoCard({ place, layout, onMapClick, onAddToTrip, viewDetailsLabel, mapAriaLabel, addToTripLabel }) {
  const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
  const rating = place.rating != null ? Number(place.rating).toFixed(1) : null;
  return (
    <article className={`dg-bento-card dg-bento-card--${layout}`}>
      <Link to={`/place/${place.id}`} className="dg-bento-card__main">
        <div className="dg-bento-card__media">
          {img ? (
            <DeliveryImg url={img} preset="gridCard" alt="" />
          ) : (
            <span className="dg-bento-card__fallback">
              <Icon name="restaurant" size={32} />
            </span>
          )}
          <div className="dg-bento-card__scrim" aria-hidden />
          {rating ? (
            <span className="dg-bento-card__rating">
              <Icon name="star" size={14} /> {rating}
            </span>
          ) : null}
        </div>
        <div className="dg-bento-card__body">
          <h3 className="dg-bento-card__title">{place.name}</h3>
          {place.location ? <p className="dg-bento-card__loc">{place.location}</p> : null}
          <span className="dg-bento-card__cta">
            <span>{viewDetailsLabel}</span>
            <Icon name="arrow_forward" size={18} aria-hidden />
          </span>
        </div>
      </Link>
      <div className="dg-bento-card__actions">
        {onAddToTrip ? (
          <button
            type="button"
            className="dg-bento-card__btn dg-bento-card__btn--trip"
            onClick={() => onAddToTrip(place)}
            aria-label={addToTripLabel}
          >
            <Icon name="event_note" size={18} aria-hidden />
          </button>
        ) : null}
        {onMapClick ? (
          <button
            type="button"
            className="dg-bento-card__btn dg-bento-card__btn--map"
            onClick={() => onMapClick(place)}
            aria-label={mapAriaLabel}
          >
            <Icon name="map" size={18} aria-hidden />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function bentoLayoutForIndex(i) {
  const r = i % 7;
  if (r === 0) return 'hero';
  if (r === 1 || r === 4) return 'wide';
  if (r === 2) return 'tall';
  return 'std';
}

export default function PlaceDining() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const toolbarRef = useRef(null);
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const locale = lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-LB' : 'en-GB';

  const fcatParam = searchParams.get('fcat') || '';
  const sortParam = searchParams.get('sort') || 'recommended';
  const qParam = searchParams.get('q') || '';

  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qDraft, setQDraft] = useState(qParam);
  const [tripPickPlace, setTripPickPlace] = useState(null);
  const [tripModalTrips, setTripModalTrips] = useState([]);
  const [tripModalLoading, setTripModalLoading] = useState(false);
  const [tripAddSaving, setTripAddSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [sponsoredItems, setSponsoredItems] = useState([]);
  const { settings, loading: siteSettingsLoading } = useSiteSettings();
  const diningGuide = settings.diningGuide;

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
    let cancelled = false;
    api
      .sponsoredPlaces({ surface: 'dining', lang: langParam })
      .then((r) => {
        if (cancelled) return;
        setSponsoredItems(Array.isArray(r.items) ? r.items : []);
      })
      .catch(() => {
        if (!cancelled) setSponsoredItems([]);
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

  const foodCategories = useMemo(() => getCategoriesForWay('food', categories), [categories]);

  const foodCategoryIds = useMemo(() => new Set(foodCategories.map((c) => String(c.id))), [foodCategories]);
  const hiddenPlaceIdSet = useMemo(
    () => new Set((diningGuide.hiddenPlaceIds || []).map((id) => String(id))),
    [diningGuide.hiddenPlaceIds]
  );
  const diningPlacesAll = useMemo(
    () =>
      places.filter(
        (p) => foodCategoryIds.has(String(p.categoryId ?? p.category_id)) && !hiddenPlaceIdSet.has(String(p.id))
      ),
    [places, foodCategoryIds, hiddenPlaceIdSet]
  );

  const diningPlaceIdSet = useMemo(() => new Set(diningPlacesAll.map((p) => String(p.id))), [diningPlacesAll]);

  const sponsoredDining = useMemo(() => {
    return sponsoredItems.filter((it) => {
      const pid =
        it?.placeId != null ? String(it.placeId) : it?.place?.id != null ? String(it.place.id) : '';
      return pid && diningPlaceIdSet.has(pid);
    });
  }, [sponsoredItems, diningPlaceIdSet]);

  const filteredForTopPicks = useMemo(() => {
    let base = diningPlacesAll;
    if (fcatParam) {
      const id = String(fcatParam);
      base = base.filter((p) => String(p.categoryId ?? p.category_id) === id);
    }
    const q = qParam.trim();
    if (q) {
      const narrow = filterPlacesByQuery(base, q);
      base = narrow.length > 0 ? narrow : base;
    }
    return base;
  }, [diningPlacesAll, fcatParam, qParam]);

  const filteredTopPicksById = useMemo(() => {
    const m = new Map();
    filteredForTopPicks.forEach((p) => m.set(String(p.id), p));
    return m;
  }, [filteredForTopPicks]);

  const topPicks = useMemo(() => {
    const fromFeatured = [];
    const used = new Set();
    for (const id of (diningGuide.featuredPlaceIds || []).map(String)) {
      const p = filteredTopPicksById.get(id);
      if (p) {
        fromFeatured.push(p);
        used.add(String(p.id));
      }
    }
    const rest = [...filteredForTopPicks]
      .filter((p) => !used.has(String(p.id)))
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    const need = Math.max(0, 8 - fromFeatured.length);
    return [...fromFeatured, ...rest.slice(0, need)];
  }, [filteredForTopPicks, filteredTopPicksById, diningGuide.featuredPlaceIds]);

  const mainListPlaces = useMemo(() => {
    let base = diningPlacesAll;
    if (fcatParam) {
      const id = String(fcatParam);
      base = base.filter((p) => String(p.categoryId ?? p.category_id) === id);
    }
    const q = qParam.trim();
    if (q) {
      const narrow = filterPlacesByQuery(base, q);
      base = narrow.length > 0 ? narrow : base;
    }
    const sort = sortParam === 'rating' || sortParam === 'name' ? sortParam : 'recommended';
    const sorted = sortDiscoverPlaces(base, { query: qParam, sort });
    const featuredIds = (diningGuide.featuredPlaceIds || []).map(String);
    const featuredSet = new Set(featuredIds);
    const orderedFeatured = [];
    const seen = new Set();
    for (const fid of featuredIds) {
      const p = sorted.find((x) => String(x.id) === fid);
      if (p && !seen.has(String(p.id))) {
        orderedFeatured.push(p);
        seen.add(String(p.id));
      }
    }
    const rest = sorted.filter((p) => !featuredSet.has(String(p.id)));
    return [...orderedFeatured, ...rest];
  }, [diningPlacesAll, diningGuide.featuredPlaceIds, fcatParam, qParam, sortParam]);

  const placeMap = useMemo(() => {
    const m = {};
    (places || []).forEach((p) => {
      if (p && p.id != null) m[String(p.id)] = p;
    });
    return m;
  }, [places]);

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

  const langKey = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const heroLoc = diningGuide.hero?.[langKey] || {};
  const heroEyebrow = String(heroLoc.kicker || '').trim() || t('diningGuide', 'eyebrow');
  const heroTitle = String(heroLoc.title || '').trim() || t('diningGuide', 'title');
  const heroSubtitle = String(heroLoc.subtitle || '').trim() || t('diningGuide', 'subtitle');
  const secLoc = diningGuide.sectionLabels?.[langKey] || {};
  const sponsoredKicker =
    String(secLoc.sponsoredKicker || '').trim() || t('diningGuide', 'sponsoredKicker');
  const topPicksTitle =
    String(secLoc.topPicksTitle || '').trim() || t('diningGuide', 'topPicksTitle');
  const mainCollectionTitleSr =
    String(secLoc.mainCollectionTitle || '').trim() || t('diningGuide', 'mainCollectionTitle');
  const rawHeroImg = (diningGuide.heroImageUrl || '').trim();
  const heroImageResolved = rawHeroImg ? getImageUrl(rawHeroImg) : '';

  const countLabel = (t('placeDiscover', 'resultCount') || '{count} places').replace(
    '{count}',
    String(mainListPlaces.length)
  );

  if (siteSettingsLoading) {
    return (
      <div className="dg-page" role="main">
        <header className="dg-hero dg-hero--loading">
          <div className="dg-hero__inner">
            <div className="dg-skel dg-skel--title" />
            <div className="dg-skel dg-skel--search" />
          </div>
        </header>
        <div className="dg-container">
          <div className="dg-skel-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="dg-skel dg-skel--card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (diningGuide.enabled === false) {
    return <Navigate to={PLACES_DISCOVER_PATH} replace />;
  }

  if (loading) {
    return (
      <div className="dg-page" role="main">
        <header className="dg-hero dg-hero--loading">
          <div className="dg-hero__inner">
            <div className="dg-skel dg-skel--title" />
            <div className="dg-skel dg-skel--search" />
          </div>
        </header>
        <div className="dg-container">
          <div className="dg-skel-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="dg-skel dg-skel--card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dg-page" role="main">
        <div className="dg-container dg-error-wrap">
          <p className="dg-error" role="alert">
            {error}
          </p>
          <Link to="/" className="dg-btn-secondary">
            {t('nav', 'home')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dg-page" role="main">
      <header
        className={`dg-hero${heroImageResolved ? ' dg-hero--photo' : ''}`}
        aria-labelledby="dg-hero-title"
        style={
          heroImageResolved
            ? {
                backgroundImage: `linear-gradient(165deg, rgba(74,18,18,0.92) 0%, rgba(45,10,10,0.88) 48%, rgba(124,45,18,0.9) 100%), url(${heroImageResolved})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="dg-hero__glow" aria-hidden />
        <div className="dg-hero__grain" aria-hidden />
        <div className="dg-hero__inner">
          <div className="dg-hero__intro">
            <p className="dg-hero__eyebrow">{heroEyebrow}</p>
            <h1 id="dg-hero-title" className="dg-hero__title">
              {heroTitle}
            </h1>
            <p className="dg-hero__sub">{heroSubtitle}</p>
          </div>
          <div className="dg-hero__actions-top">
            <Link to="/map" className="dg-hero__link">
              <Icon name="map" size={20} aria-hidden />
              <span>{t('diningGuide', 'heroMapCta')}</span>
            </Link>
            <Link to={PLACES_DISCOVER_PATH} className="dg-hero__link dg-hero__link--ghost">
              <span>{t('diningGuide', 'browseDiscover')}</span>
              <Icon name="arrow_forward" size={18} aria-hidden />
            </Link>
          </div>
          <div className="dg-search-wrap">
            <GlobalSearchBar
              className="global-search-bar--full dg-global-search"
              idPrefix="place-dining"
              queryValue={qDraft}
              onQueryChange={setQDraft}
            />
          </div>
        </div>
      </header>

      <div className="dg-container dg-body">
        {diningGuide.sections?.sponsored !== false && sponsoredDining.length > 0 ? (
          <section className="dg-sponsored" aria-label={sponsoredKicker}>
            <div className="dg-section-head">
              <h2 className="dg-section-title">{sponsoredKicker}</h2>
            </div>
            <div className="dg-sponsored-rail">
              {sponsoredDining.slice(0, 6).map((item) => (
                <div key={item.id} className="dg-sponsored-rail__item">
                  <SponsoredPlaceCard item={item} t={t} variant="tile" />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {diningGuide.sections?.topPicks !== false && topPicks.length > 0 ? (
          <section className="dg-top-picks" aria-labelledby="dg-top-picks-title">
            <div className="dg-section-head">
              <h2 id="dg-top-picks-title" className="dg-section-title">
                {topPicksTitle}
              </h2>
              <p className="dg-section-sub">{t('diningGuide', 'topPicksSub')}</p>
            </div>
            <div className="dg-rail" role="list">
              {topPicks.map((place) => {
                const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
                const rating = place.rating != null ? Number(place.rating).toFixed(1) : null;
                return (
                  <div key={place.id} className="dg-rail__item" role="listitem">
                    <Link to={`/place/${place.id}`} className="dg-rail-card">
                      <div className="dg-rail-card__media">
                        {img ? (
                          <DeliveryImg url={img} preset="discoverCard" alt="" />
                        ) : (
                          <span className="dg-rail-card__fallback">
                            <Icon name="restaurant" size={28} />
                          </span>
                        )}
                        {rating ? (
                          <span className="dg-rail-card__rating">
                            <Icon name="star" size={12} /> {rating}
                          </span>
                        ) : null}
                      </div>
                      <div className="dg-rail-card__body">
                        <h3 className="dg-rail-card__title">{place.name}</h3>
                        {place.location ? <p className="dg-rail-card__loc">{place.location}</p> : null}
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="dg-panel" ref={toolbarRef} aria-label={t('diningGuide', 'openFilters')}>
          <div className="dg-panel__row dg-panel__row--chips">
            <p className="dg-panel__label">{t('diningGuide', 'categoryFilterLabel')}</p>
            <div className="dg-chips" role="group">
              <button
                type="button"
                className={`dg-chip ${!fcatParam ? 'dg-chip--on' : ''}`}
                onClick={() => setParam('fcat', '')}
              >
                {t('diningGuide', 'allStyles')}
              </button>
              {foodCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`dg-chip ${String(fcatParam) === String(c.id) ? 'dg-chip--on' : ''}`}
                  onClick={() =>
                    setParam('fcat', String(fcatParam) === String(c.id) ? '' : String(c.id))
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="dg-panel__row dg-panel__row--sort">
            <span className="dg-count" aria-live="polite">
              {countLabel}
            </span>
            <div className="dg-sort-wrap">
              <label className="dg-sr-only" htmlFor="dg-sort">
                {t('diningGuide', 'sortLabel')}
              </label>
              <select
                id="dg-sort"
                className="dg-select"
                value={sortParam}
                onChange={(e) => setParam('sort', e.target.value)}
              >
                <option value="recommended">{t('placeDiscover', 'sortRecommended')}</option>
                <option value="rating">{t('home', 'spotsSortRating')}</option>
                <option value="name">{t('home', 'spotsSortName')}</option>
              </select>
            </div>
          </div>
        </section>

        <h2 id="dg-collection-title" className="dg-sr-only">
          {mainCollectionTitleSr}
        </h2>
        {mainListPlaces.length === 0 ? (
          <p className="dg-empty">{t('home', 'noSpots')}</p>
        ) : (
          <section className="dg-bento" aria-labelledby="dg-collection-title">
            {mainListPlaces.map((p, i) => (
                <BentoCard
                  key={p.id}
                  place={p}
                  layout={bentoLayoutForIndex(i)}
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

      <nav className="dg-dock" aria-label={t('diningGuide', 'dockLabel')}>
        <Link to="/map" className="dg-dock__item">
          <Icon name="map" size={22} aria-hidden />
          <span className="dg-dock__label">{t('home', 'viewMap')}</span>
        </Link>
        <Link to={COMMUNITY_PATH} className="dg-dock__item">
          <Icon name="dynamic_feed" size={22} aria-hidden />
          <span className="dg-dock__label">{t('nav', 'communityFeed')}</span>
        </Link>
        <button type="button" className="dg-dock__item" onClick={scrollToFilters}>
          <Icon name="tune" size={22} aria-hidden />
          <span className="dg-dock__label">{t('diningGuide', 'openFilters')}</span>
        </button>
      </nav>

      {tripPickPlace && (
        <div className="dg-modal-backdrop" role="presentation" onClick={closeTripModal}>
          <div
            className="dg-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dg-trip-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dg-modal-header">
              <h2 id="dg-trip-modal-title" className="dg-modal-title">
                {t('placeDiscover', 'addToTripTitle')}
              </h2>
              <button
                type="button"
                className="dg-modal-close"
                onClick={closeTripModal}
                aria-label={t('placeDiscover', 'modalClose')}
              >
                <Icon name="close" size={22} />
              </button>
            </div>
            <p className="dg-modal-place-name">{tripPickPlace.name}</p>
            <p className="dg-modal-hint">{t('placeDiscover', 'addToTripHint')}</p>

            {tripModalLoading ? (
              <p className="dg-modal-loading">{t('placeDiscover', 'tripsLoading')}</p>
            ) : tripModalTrips.length === 0 ? (
              <div className="dg-modal-empty">
                <p>{t('placeDiscover', 'addToTripEmpty')}</p>
                <Link to="/plan" className="dg-modal-primary">
                  {t('home', 'createTrip')}
                </Link>
              </div>
            ) : (
              <ul className="dg-modal-trip-list">
                {tripModalTrips.map((tr) => (
                  <li key={tr.id}>
                    <button
                      type="button"
                      className="dg-modal-trip-row"
                      disabled={tripAddSaving}
                      onClick={() => addPlaceToTripFirstDay(tr)}
                    >
                      <span className="dg-modal-trip-text">
                        <span className="dg-modal-trip-name">{tr.name}</span>
                        <span className="dg-modal-trip-dates">{formatTripRange(tr, locale)}</span>
                      </span>
                      <Icon name="chevron_right" size={22} className="dg-modal-trip-chev" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="dg-modal-footer">
              <Link to="/plan" className="dg-modal-link">
                {t('placeDiscover', 'goToPlan')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`dg-toast dg-toast--${toast.kind}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
}
