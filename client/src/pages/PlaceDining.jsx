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
import { placeQualityScore, searchMatchScore, sortDiscoverPlaces } from '../utils/placeDiscoverRank';
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
  return `${a.toLocaleDateString(locale, opts)} - ${b.toLocaleDateString(locale, opts)}`;
}

function uniqStrings(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((item) => String(item || '').trim()).filter(Boolean))];
}

function titleizeToken(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function diningSignals(place) {
  const dp = place?.diningProfile && typeof place.diningProfile === 'object' ? place.diningProfile : {};
  const cuisines = uniqStrings(dp.cuisines).map(titleizeToken);
  const bestFor = uniqStrings(dp.bestFor).map(titleizeToken);
  const serviceModes = uniqStrings([
    ...(Array.isArray(dp.serviceModes) ? dp.serviceModes : []),
    ...(dp.delivery ? ['delivery'] : []),
    ...(dp.takeaway ? ['takeaway'] : []),
    ...(dp.reservations ? ['reservations'] : []),
    ...(dp.outdoorSeating ? ['outdoor seating'] : []),
  ]).map(titleizeToken);
  const dietaryOptions = uniqStrings(dp.dietaryOptions).map(titleizeToken);
  const signatureDishes = uniqStrings(dp.signatureDishes).map(titleizeToken);
  const menuSections = Array.isArray(dp.menuSections) ? dp.menuSections.filter(Boolean) : [];
  return {
    cuisines,
    bestFor,
    serviceModes,
    dietaryOptions,
    signatureDishes,
    menuSections,
    hasMenu: menuSections.length > 0 || signatureDishes.length > 0 || Boolean(String(dp.menuNote || '').trim()),
    hasHours: Boolean(String(place?.hours || '').trim()),
    hasContact:
      Boolean(String(dp.contactPhone || '').trim()) ||
      Boolean(String(dp.contactEmail || '').trim()) ||
      Boolean(String(dp.contactAddress || '').trim()),
    menuDepth: menuSections.reduce((sum, section) => sum + (Array.isArray(section?.items) ? section.items.length : 0), 0),
  };
}

function isLikelyDiningPlace(place, foodCategoryIds) {
  const categoryId = String(place?.categoryId ?? place?.category_id ?? '').trim();
  if (categoryId && foodCategoryIds.has(categoryId)) return true;
  const hay = [
    place?.category,
    categoryId,
    ...(Array.isArray(place?.tags) ? place.tags : place?.tags ? [place.tags] : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /(restaurant|food|dining|cafe|café|coffee|bakery|sweet|dessert|cuisine|breakfast|lunch|dinner)/.test(hay);
}

function diningSmartScore(place, { query = '', activeCategoryId = '', featuredIds = new Set() } = {}) {
  const signals = diningSignals(place);
  const reviews = Number(place?.reviewCount ?? place?.reviews_count ?? place?.reviewsCount ?? 0) || 0;
  let score = placeQualityScore(place) * 2.4 + searchMatchScore(place, query) * 22;
  score += featuredIds.has(String(place?.id)) ? 48 : 0;
  score += signals.hasMenu ? 22 : 0;
  score += Math.min(signals.menuDepth, 12) * 1.4;
  score += Math.min(signals.signatureDishes.length, 4) * 5;
  score += Math.min(signals.serviceModes.length, 4) * 4;
  score += Math.min(signals.cuisines.length, 4) * 4;
  score += Math.min(signals.bestFor.length, 3) * 3;
  score += signals.hasHours ? 6 : 0;
  score += signals.hasContact ? 4 : 0;
  score += getPlaceImageUrl(place?.image || (place?.images && place.images[0])) ? 10 : 0;
  score += reviews > 0 ? Math.log1p(reviews) * 5 : 0;
  if (activeCategoryId && String(place?.categoryId ?? place?.category_id) === String(activeCategoryId)) score += 8;
  return score;
}

function localDiningCopy(lang, t) {
  const pick = (key, fallback) => {
    const value = t('diningGuide', key);
    return value && value !== key ? value : fallback;
  };
  return {
    smartTitle: 'Smart dining picks',
    smartSub: 'A stronger ranking blends place quality, menu richness, visuals, services, and search intent behind the scenes.',
    guideBadge: 'Curated pick',
    menuBadge: 'Menu-ready',
    contactBadge: 'Contact available',
    openNowBadge: 'Visit info',
    cuisinesTitle: 'Browse by cuisine or mood',
    cuisinesSub: 'We group places by cuisine, occasion, and visit style so first-time users can decide faster.',
    browseCluster: 'Browse selection',
    smartReasons: 'Why it stands out',
    menuReady: 'Menu or signature dishes available',
    menuSoon: 'Profile is ready for a full menu',
    collectionTitle: 'All dining places',
    collectionSub: 'A clearer restaurant directory with richer cards that help people decide faster.',
    filtersTitle: 'Refine your dining search',
    heroStatPlaces: 'Dining places',
    heroStatCurated: 'Smart picks',
    heroStatStyles: 'Styles & moods',
    mapCta: pick('heroMapCta', 'Open map'),
    discoverCta: pick('browseDiscover', 'Browse full guide'),
  };
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
  const copy = useMemo(() => localDiningCopy(lang, t), [lang, t]);

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

  const sponsoredDiningEnabled = settings?.sponsoredPlacesEnabled?.dining !== false;

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
    if (!sponsoredDiningEnabled) {
      setSponsoredItems([]);
      return undefined;
    }
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
  }, [langParam, sponsoredDiningEnabled]);

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
        (p) => isLikelyDiningPlace(p, foodCategoryIds) && !hiddenPlaceIdSet.has(String(p.id))
      ),
    [places, foodCategoryIds, hiddenPlaceIdSet]
  );

  const diningPlaceIdSet = useMemo(() => new Set(diningPlacesAll.map((p) => String(p.id))), [diningPlacesAll]);
  const featuredIdSet = useMemo(
    () => new Set((diningGuide.featuredPlaceIds || []).map((id) => String(id))),
    [diningGuide.featuredPlaceIds]
  );

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

  const rankedDiningPlaces = useMemo(
    () =>
      [...diningPlacesAll].sort(
        (a, b) =>
          diningSmartScore(b, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet }) -
          diningSmartScore(a, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet })
      ),
    [diningPlacesAll, qParam, fcatParam, featuredIdSet]
  );

  const smartSpotlight = useMemo(() => rankedDiningPlaces.slice(0, 3), [rankedDiningPlaces]);

  const smartCuisineClusters = useMemo(() => {
    const clusterMap = new Map();
    rankedDiningPlaces.forEach((place) => {
      const signals = diningSignals(place);
      const labels = [...signals.cuisines, ...signals.bestFor].slice(0, 4);
      if (labels.length === 0 && place.category) labels.push(String(place.category));
      labels.forEach((label) => {
        const key = String(label || '').trim();
        if (!key) return;
        if (!clusterMap.has(key)) clusterMap.set(key, []);
        const items = clusterMap.get(key);
        if (items.length < 4) items.push(place);
      });
    });
    return [...clusterMap.entries()]
      .map(([label, items]) => ({
        label,
        items,
        score: items.reduce(
          (sum, item) =>
            sum + diningSmartScore(item, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet }),
          0
        ),
      }))
      .filter((cluster) => cluster.items.length >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [rankedDiningPlaces, qParam, fcatParam, featuredIdSet]);

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
    const sorted =
      sort === 'recommended'
        ? [...base].sort(
            (a, b) =>
              diningSmartScore(b, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet }) -
              diningSmartScore(a, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet })
          )
        : sortDiscoverPlaces(base, { query: qParam, sort });
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
  }, [diningPlacesAll, diningGuide.featuredPlaceIds, featuredIdSet, fcatParam, qParam, sortParam]);

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
  const cuisinesCount = useMemo(() => {
    const set = new Set();
    diningPlacesAll.forEach((place) => diningSignals(place).cuisines.forEach((item) => set.add(item)));
    return set.size;
  }, [diningPlacesAll]);

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
          <div className="dg-hero__stats" aria-label={copy.smartTitle}>
            <div className="dg-hero-stat">
              <span className="dg-hero-stat__value">{diningPlacesAll.length}</span>
              <span className="dg-hero-stat__label">{copy.heroStatPlaces}</span>
            </div>
            <div className="dg-hero-stat">
              <span className="dg-hero-stat__value">{smartSpotlight.length}</span>
              <span className="dg-hero-stat__label">{copy.heroStatCurated}</span>
            </div>
            <div className="dg-hero-stat">
              <span className="dg-hero-stat__value">{Math.max(cuisinesCount, foodCategories.length)}</span>
              <span className="dg-hero-stat__label">{copy.heroStatStyles}</span>
            </div>
          </div>
          <div className="dg-hero__actions-top">
            <Link to="/map" className="dg-hero__link">
              <Icon name="map" size={20} aria-hidden />
              <span>{copy.mapCta}</span>
            </Link>
            <Link to={PLACES_DISCOVER_PATH} className="dg-hero__link dg-hero__link--ghost">
              <span>{copy.discoverCta}</span>
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
          <div className="dg-hero-cats" role="group" aria-label="Quick category filter">
            <button
              type="button"
              className={`dg-hero-cat ${!fcatParam ? 'dg-hero-cat--on' : ''}`}
              onClick={() => setParam('fcat', '')}
            >
              All
            </button>
            {foodCategories.slice(0, 10).map((c) => (
              <button
                key={c.id}
                type="button"
                className={`dg-hero-cat ${String(fcatParam) === String(c.id) ? 'dg-hero-cat--on' : ''}`}
                onClick={() => setParam('fcat', String(fcatParam) === String(c.id) ? '' : String(c.id))}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="dg-container dg-body">
        {sponsoredDining.length > 0 ? (
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

        {topPicks.length > 0 ? (
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

        {smartSpotlight.length > 0 ? (
          <section className="dg-smart" aria-labelledby="dg-smart-title">
            <div className="dg-section-head">
              <h2 id="dg-smart-title" className="dg-section-title">
                {copy.smartTitle}
              </h2>
              <p className="dg-section-sub">{copy.smartSub}</p>
            </div>
            <div className="dg-smart-grid">
              {smartSpotlight.map((place, index) => {
                const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
                const signals = diningSignals(place);
                const reasons = [...signals.cuisines, ...signals.bestFor, ...signals.serviceModes].slice(0, 4);
                return (
                  <Link
                    key={place.id}
                    to={`/place/${place.id}`}
                    className={`dg-smart-card ${index === 0 ? 'dg-smart-card--lead' : ''}`}
                  >
                    <div className="dg-smart-card__media">
                      {img ? (
                        <DeliveryImg url={img} preset="discoverCard" alt="" />
                      ) : (
                        <span className="dg-smart-card__fallback">
                          <Icon name="restaurant" size={36} />
                        </span>
                      )}
                      <div className="dg-smart-card__scrim" aria-hidden />
                      <div className="dg-smart-card__badges">
                        <span className="dg-smart-card__badge">{copy.guideBadge}</span>
                        {signals.hasMenu ? (
                          <span className="dg-smart-card__badge dg-smart-card__badge--soft">{copy.menuBadge}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="dg-smart-card__body">
                      <h3 className="dg-smart-card__title">{place.name}</h3>
                      {place.location ? <p className="dg-smart-card__loc">{place.location}</p> : null}
                      {reasons.length > 0 ? (
                        <div className="dg-smart-card__facts">
                          {reasons.map((item) => (
                            <span key={`${place.id}-${item}`} className="dg-smart-card__fact">
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="dg-smart-card__meta">
                        {place.rating != null ? (
                          <span>
                            <Icon name="star" size={14} aria-hidden /> {Number(place.rating).toFixed(1)}
                          </span>
                        ) : null}
                        {signals.hasContact ? (
                          <span>
                            <Icon name="call" size={14} aria-hidden /> {copy.contactBadge}
                          </span>
                        ) : null}
                        {signals.hasHours ? (
                          <span>
                            <Icon name="schedule" size={14} aria-hidden /> {copy.openNowBadge}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {smartCuisineClusters.length > 0 ? (
          <section className="dg-clusters" aria-labelledby="dg-clusters-title">
            <div className="dg-section-head">
              <h2 id="dg-clusters-title" className="dg-section-title">
                {copy.cuisinesTitle}
              </h2>
              <p className="dg-section-sub">{copy.cuisinesSub}</p>
            </div>
            <div className="dg-clusters-grid">
              {smartCuisineClusters.map((cluster) => (
                <article key={cluster.label} className="dg-cluster-card">
                  <div className="dg-cluster-card__head">
                    <div>
                      <h3 className="dg-cluster-card__title">{cluster.label}</h3>
                      <p className="dg-cluster-card__count">
                        {(t('placeDiscover', 'resultCount') || '{count} places').replace('{count}', String(cluster.items.length))}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="dg-cluster-card__cta"
                      onClick={() => setQDraft(cluster.label)}
                    >
                      {copy.browseCluster}
                    </button>
                  </div>
                  <div className="dg-cluster-card__stack">
                    {cluster.items.slice(0, 3).map((place) => {
                      const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
                      return (
                        <Link key={place.id} to={`/place/${place.id}`} className="dg-cluster-card__item">
                          <span className="dg-cluster-card__thumb">
                            {img ? <DeliveryImg url={img} preset="avatar" alt="" /> : <Icon name="restaurant" size={18} />}
                          </span>
                          <span className="dg-cluster-card__item-text">
                            <strong>{place.name}</strong>
                            <span>{place.location}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="dg-panel" ref={toolbarRef} aria-label={t('diningGuide', 'openFilters')}>
          <div className="dg-panel__heading">
            <h2 className="dg-panel__title">{copy.filtersTitle}</h2>
            <p className="dg-panel__intro">{copy.collectionSub}</p>
          </div>
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
          <section className="dg-place-list" aria-labelledby="dg-collection-title">
            {mainListPlaces.map((place) => {
              const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
              const rating = place.rating != null ? Number(place.rating).toFixed(1) : null;
              const signals = diningSignals(place);
              const chips = [...signals.cuisines, ...signals.bestFor].slice(0, 3);
              return (
                <article key={place.id} className="dg-place-row">
                  <Link to={`/place/${place.id}`} className="dg-place-row__link">
                    <div className="dg-place-row__img">
                      {img ? (
                        <DeliveryImg url={img} preset="gridCard" alt="" />
                      ) : (
                        <span className="dg-place-row__fallback"><Icon name="restaurant" size={32} /></span>
                      )}
                      {rating && (
                        <span className="dg-place-row__rating">
                          <Icon name="star" size={12} /> {rating}
                        </span>
                      )}
                    </div>
                    <div className="dg-place-row__body">
                      <h3 className="dg-place-row__name">{place.name}</h3>
                      {place.location && (
                        <p className="dg-place-row__loc">
                          <Icon name="location_on" size={12} />
                          {place.location}
                        </p>
                      )}
                      {chips.length > 0 && (
                        <div className="dg-place-row__chips">
                          {chips.map(c => <span key={c} className="dg-place-row__chip">{c}</span>)}
                        </div>
                      )}
                      <div className="dg-place-row__meta">
                        {signals.serviceModes.slice(0, 2).map(mode => (
                          <span key={mode}>
                            <Icon name="room_service" size={12} /> {mode}
                          </span>
                        ))}
                        {signals.hasMenu && (
                          <span>
                            <Icon name="menu_book" size={12} /> {copy.menuReady}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <div className="dg-place-row__actions">
                    {openAddToTrip && (
                      <button
                        type="button"
                        className="dg-place-row__btn"
                        onClick={() => openAddToTrip(place)}
                        aria-label={t('placeDiscover', 'addToTrip')}
                      >
                        <Icon name="event_note" size={20} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="dg-place-row__btn"
                      onClick={() => handleViewOnMap(place)}
                      aria-label={t('placeDiscover', 'viewOnMap')}
                    >
                      <Icon name="map" size={20} />
                    </button>
                  </div>
                </article>
              );
            })}
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



