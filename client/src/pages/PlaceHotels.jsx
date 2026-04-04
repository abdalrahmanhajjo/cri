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
import './PlaceHotels.css';

function formatTripRange(trip, locale) {
  const a = trip.startDate ? new Date(trip.startDate) : null;
  const b = trip.endDate ? new Date(trip.endDate) : null;
  if (!a || Number.isNaN(a.getTime())) return '';
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (!b || Number.isNaN(b.getTime())) return a.toLocaleDateString(locale, opts);
  return `${a.toLocaleDateString(locale, opts)} – ${b.toLocaleDateString(locale, opts)}`;
}

function StayCard({ place, onMapClick, onAddToTrip, viewDetailsLabel, mapAriaLabel, addToTripLabel }) {
  const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
  const rating = place.rating != null ? Number(place.rating).toFixed(1) : null;
  return (
    <article className="hg-stay-card">
      <Link to={`/place/${place.id}`} className="hg-stay-card__main">
        <div className="hg-stay-card__media">
          {img ? (
            <DeliveryImg url={img} preset="gridCard" alt="" />
          ) : (
            <span className="hg-stay-card__fallback">
              <Icon name="hotel" size={32} />
            </span>
          )}
          <div className="hg-stay-card__frame" aria-hidden />
          {rating ? (
            <span className="hg-stay-card__rating">
              <Icon name="star" size={14} /> {rating}
            </span>
          ) : null}
        </div>
        <div className="hg-stay-card__body">
          <h3 className="hg-stay-card__title">{place.name}</h3>
          {place.location ? <p className="hg-stay-card__loc">{place.location}</p> : null}
          <span className="hg-stay-card__cta">
            <span>{viewDetailsLabel}</span>
            <Icon name="arrow_forward" size={18} aria-hidden />
          </span>
        </div>
      </Link>
      <div className="hg-stay-card__actions">
        {onAddToTrip ? (
          <button
            type="button"
            className="hg-stay-card__btn hg-stay-card__btn--trip"
            onClick={() => onAddToTrip(place)}
            aria-label={addToTripLabel}
          >
            <Icon name="event_note" size={18} aria-hidden />
          </button>
        ) : null}
        {onMapClick ? (
          <button
            type="button"
            className="hg-stay-card__btn hg-stay-card__btn--map"
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

export default function PlaceHotels() {
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
  const hotelsGuide = settings.hotelsGuide;

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const showToast = useCallback((message, kind = 'info') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const sponsoredHotelsEnabled = settings?.sponsoredPlacesEnabled?.hotels !== false;

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
    if (!sponsoredHotelsEnabled) {
      setSponsoredItems([]);
      return undefined;
    }
    api
      .sponsoredPlaces({ surface: 'hotels', lang: langParam })
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
  }, [langParam, sponsoredHotelsEnabled]);

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

  const stayCategories = useMemo(() => getCategoriesForWay('stay', categories), [categories]);
  const stayCategoryIds = useMemo(() => new Set(stayCategories.map((c) => String(c.id))), [stayCategories]);
  const hiddenPlaceIdSet = useMemo(
    () => new Set((hotelsGuide.hiddenPlaceIds || []).map((id) => String(id))),
    [hotelsGuide.hiddenPlaceIds]
  );
  const stayPlacesAll = useMemo(
    () =>
      places.filter(
        (p) => stayCategoryIds.has(String(p.categoryId ?? p.category_id)) && !hiddenPlaceIdSet.has(String(p.id))
      ),
    [places, stayCategoryIds, hiddenPlaceIdSet]
  );
  const stayPlaceIdSet = useMemo(() => new Set(stayPlacesAll.map((p) => String(p.id))), [stayPlacesAll]);

  const sponsoredStay = useMemo(() => {
    return sponsoredItems.filter((it) => {
      const pid =
        it?.placeId != null ? String(it.placeId) : it?.place?.id != null ? String(it.place.id) : '';
      return pid && stayPlaceIdSet.has(pid);
    });
  }, [sponsoredItems, stayPlaceIdSet]);

  const filteredForTopPicks = useMemo(() => {
    let base = stayPlacesAll;
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
  }, [stayPlacesAll, fcatParam, qParam]);

  const filteredTopPicksById = useMemo(() => {
    const m = new Map();
    filteredForTopPicks.forEach((p) => m.set(String(p.id), p));
    return m;
  }, [filteredForTopPicks]);

  const topPicks = useMemo(() => {
    const fromFeatured = [];
    const used = new Set();
    for (const id of (hotelsGuide.featuredPlaceIds || []).map(String)) {
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
  }, [filteredForTopPicks, filteredTopPicksById, hotelsGuide.featuredPlaceIds]);

  const mainListPlaces = useMemo(() => {
    let base = stayPlacesAll;
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
    const featuredIds = (hotelsGuide.featuredPlaceIds || []).map(String);
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
  }, [stayPlacesAll, hotelsGuide.featuredPlaceIds, fcatParam, qParam, sortParam]);

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

  const countLabel = (t('placeDiscover', 'resultCount') || '{count} places').replace(
    '{count}',
    String(mainListPlaces.length)
  );

  const langKey = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const heroLoc = hotelsGuide.hero?.[langKey] || {};
  const heroEyebrow = String(heroLoc.kicker || '').trim() || t('hotelGuide', 'eyebrow');
  const heroTitle = String(heroLoc.title || '').trim() || t('hotelGuide', 'title');
  const heroSubtitle = String(heroLoc.subtitle || '').trim() || t('hotelGuide', 'subtitle');
  const secLoc = hotelsGuide.sectionLabels?.[langKey] || {};
  const sponsoredKicker =
    String(secLoc.sponsoredKicker || '').trim() || t('hotelGuide', 'sponsoredKicker');
  const topPicksTitle =
    String(secLoc.topPicksTitle || '').trim() || t('hotelGuide', 'topPicksTitle');
  const mainCollectionTitleSr =
    String(secLoc.mainCollectionTitle || '').trim() || t('hotelGuide', 'mainCollectionTitle');
  const rawHeroImg = (hotelsGuide.heroImageUrl || '').trim();
  const heroImageResolved = rawHeroImg ? getImageUrl(rawHeroImg) : '';

  if (siteSettingsLoading) {
    return (
      <div className="hg-page" role="main">
        <header className="hg-hero hg-hero--loading">
          <div className="hg-hero__inner">
            <div className="hg-skel hg-skel--title" />
            <div className="hg-skel hg-skel--search" />
          </div>
        </header>
        <div className="hg-container">
          <div className="hg-skel-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="hg-skel hg-skel--card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (hotelsGuide.enabled === false) {
    return <Navigate to={PLACES_DISCOVER_PATH} replace />;
  }

  if (loading) {
    return (
      <div className="hg-page" role="main">
        <header className="hg-hero hg-hero--loading">
          <div className="hg-hero__inner">
            <div className="hg-skel hg-skel--title" />
            <div className="hg-skel hg-skel--search" />
          </div>
        </header>
        <div className="hg-container">
          <div className="hg-skel-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="hg-skel hg-skel--card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hg-page" role="main">
        <div className="hg-container hg-error-wrap">
          <p className="hg-error" role="alert">
            {error}
          </p>
          <Link to="/" className="hg-btn-secondary">
            {t('nav', 'home')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="hg-page" role="main">
      <header
        className={`hg-hero${heroImageResolved ? ' hg-hero--photo' : ''}`}
        aria-labelledby="hg-hero-title"
        style={
          heroImageResolved
            ? {
                backgroundImage: `linear-gradient(145deg, rgba(11,18,36,0.92) 0%, rgba(21,30,53,0.9) 42%, rgba(36,49,82,0.92) 100%), url(${heroImageResolved})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="hg-hero__mesh" aria-hidden />
        <div className="hg-hero__stripes" aria-hidden />
        <div className="hg-hero__inner">
          <div className="hg-hero__intro">
            <p className="hg-hero__eyebrow">{heroEyebrow}</p>
            <h1 id="hg-hero-title" className="hg-hero__title">
              {heroTitle}
            </h1>
            <p className="hg-hero__sub">{heroSubtitle}</p>
          </div>
          <div className="hg-hero__actions">
            <Link to="/map" className="hg-hero__btn hg-hero__btn--gold">
              <Icon name="map" size={20} aria-hidden />
              <span>{t('hotelGuide', 'heroMapCta')}</span>
            </Link>
            <Link to={PLACES_DISCOVER_PATH} className="hg-hero__btn hg-hero__btn--ghost">
              <span>{t('hotelGuide', 'browseDiscover')}</span>
              <Icon name="arrow_forward" size={18} aria-hidden />
            </Link>
          </div>
          <div className="hg-search">
            <GlobalSearchBar
              className="global-search-bar--full hg-global-search"
              idPrefix="place-hotels"
              queryValue={qDraft}
              onQueryChange={setQDraft}
            />
          </div>
        </div>
      </header>

      <div className="hg-container hg-main">
        {sponsoredStay.length > 0 ? (
          <section className="hg-sponsored" aria-label={sponsoredKicker}>
            <header className="hg-section-head">
              <h2 className="hg-section-title">{sponsoredKicker}</h2>
            </header>
            <div className="hg-sponsored-track">
              {sponsoredStay.slice(0, 6).map((item) => (
                <div key={item.id} className="hg-sponsored-track__cell">
                  <SponsoredPlaceCard item={item} t={t} variant="tile" />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {topPicks.length > 0 ? (
          <section className="hg-picks" aria-labelledby="hg-picks-title">
            <header className="hg-section-head">
              <h2 id="hg-picks-title" className="hg-section-title">
                {topPicksTitle}
              </h2>
              <p className="hg-section-lead">{t('hotelGuide', 'topPicksSub')}</p>
            </header>
            <div className="hg-picks-scroll" role="list">
              {topPicks.map((place) => {
                const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
                const rating = place.rating != null ? Number(place.rating).toFixed(1) : null;
                return (
                  <div key={place.id} className="hg-picks-scroll__item" role="listitem">
                    <Link to={`/place/${place.id}`} className="hg-pick-card">
                      <div className="hg-pick-card__visual">
                        {img ? (
                          <DeliveryImg url={img} preset="discoverCard" alt="" />
                        ) : (
                          <span className="hg-pick-card__ph">
                            <Icon name="hotel" size={28} />
                          </span>
                        )}
                        {rating ? (
                          <span className="hg-pick-card__score">
                            <Icon name="star" size={12} /> {rating}
                          </span>
                        ) : null}
                      </div>
                      <div className="hg-pick-card__text">
                        <h3 className="hg-pick-card__name">{place.name}</h3>
                        {place.location ? <p className="hg-pick-card__meta">{place.location}</p> : null}
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="hg-toolbar" ref={toolbarRef} aria-label={t('hotelGuide', 'openFilters')}>
          <div className="hg-toolbar__chips">
            <p className="hg-toolbar__label">{t('hotelGuide', 'categoryFilterLabel')}</p>
            <div className="hg-pills" role="group">
              <button
                type="button"
                className={`hg-pill ${!fcatParam ? 'hg-pill--active' : ''}`}
                onClick={() => setParam('fcat', '')}
              >
                {t('hotelGuide', 'allStyles')}
              </button>
              {stayCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`hg-pill ${String(fcatParam) === String(c.id) ? 'hg-pill--active' : ''}`}
                  onClick={() =>
                    setParam('fcat', String(fcatParam) === String(c.id) ? '' : String(c.id))
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="hg-toolbar__sort">
            <span className="hg-meta-count" aria-live="polite">
              {countLabel}
            </span>
            <label className="hg-sr-only" htmlFor="hg-sort">
              {t('hotelGuide', 'sortLabel')}
            </label>
            <select
              id="hg-sort"
              className="hg-sort-select"
              value={sortParam}
              onChange={(e) => setParam('sort', e.target.value)}
            >
              <option value="recommended">{t('placeDiscover', 'sortRecommended')}</option>
              <option value="rating">{t('home', 'spotsSortRating')}</option>
              <option value="name">{t('home', 'spotsSortName')}</option>
            </select>
          </div>
        </section>

        <h2 id="hg-grid-label" className="hg-sr-only">
          {mainCollectionTitleSr}
        </h2>
        {mainListPlaces.length === 0 ? (
          <p className="hg-empty">{t('home', 'noSpots')}</p>
        ) : (
          <section className="hg-stays" aria-labelledby="hg-grid-label">
            {mainListPlaces.map((p) => (
              <StayCard
                key={p.id}
                place={p}
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

      <nav className="hg-dock" aria-label={t('hotelGuide', 'dockLabel')}>
        <Link to="/map" className="hg-dock__btn">
          <Icon name="map" size={22} aria-hidden />
          <span className="hg-dock__txt">{t('home', 'viewMap')}</span>
        </Link>
        <Link to={COMMUNITY_PATH} className="hg-dock__btn">
          <Icon name="dynamic_feed" size={22} aria-hidden />
          <span className="hg-dock__txt">{t('nav', 'communityFeed')}</span>
        </Link>
        <button type="button" className="hg-dock__btn" onClick={scrollToFilters}>
          <Icon name="tune" size={22} aria-hidden />
          <span className="hg-dock__txt">{t('hotelGuide', 'openFilters')}</span>
        </button>
      </nav>

      {tripPickPlace && (
        <div className="hg-sheet-bg" role="presentation" onClick={closeTripModal}>
          <div
            className="hg-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hg-trip-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hg-sheet__head">
              <h2 id="hg-trip-title" className="hg-sheet__h">
                {t('placeDiscover', 'addToTripTitle')}
              </h2>
              <button
                type="button"
                className="hg-sheet__x"
                onClick={closeTripModal}
                aria-label={t('placeDiscover', 'modalClose')}
              >
                <Icon name="close" size={22} />
              </button>
            </div>
            <p className="hg-sheet__place">{tripPickPlace.name}</p>
            <p className="hg-sheet__hint">{t('placeDiscover', 'addToTripHint')}</p>

            {tripModalLoading ? (
              <p className="hg-sheet__wait">{t('placeDiscover', 'tripsLoading')}</p>
            ) : tripModalTrips.length === 0 ? (
              <div className="hg-sheet__zero">
                <p>{t('placeDiscover', 'addToTripEmpty')}</p>
                <Link to="/plan" className="hg-sheet__primary">
                  {t('home', 'createTrip')}
                </Link>
              </div>
            ) : (
              <ul className="hg-sheet__trips">
                {tripModalTrips.map((tr) => (
                  <li key={tr.id}>
                    <button
                      type="button"
                      className="hg-sheet__trip"
                      disabled={tripAddSaving}
                      onClick={() => addPlaceToTripFirstDay(tr)}
                    >
                      <span className="hg-sheet__trip-txt">
                        <span className="hg-sheet__trip-name">{tr.name}</span>
                        <span className="hg-sheet__trip-when">{formatTripRange(tr, locale)}</span>
                      </span>
                      <Icon name="chevron_right" size={22} className="hg-sheet__trip-go" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="hg-sheet__foot">
              <Link to="/plan" className="hg-sheet__link">
                {t('placeDiscover', 'goToPlan')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {toast ? (
        <div className={`hg-snack hg-snack--${toast.kind}`} role="status">
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
