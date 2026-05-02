import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import EventsAndToursSection from '../components/EventsAndToursSection';
import { trackEvent } from '../utils/analytics';
import { homeBentoDefaults, resolveHomeBentoVisuals, resolveBentoAvatarSlots } from '../config/homeBentoVisuals';
import {
  getBentoHeroPreloadHref,
  normalizePreloadImageHref,
} from '../utils/bentoHeroImage';
import { resolveHeroTagline } from '../config/resolveSiteTagline';
import {
  COMMUNITY_PATH,
  PLACES_DISCOVER_PATH,
} from '../utils/discoverPaths';
import { applyHomeSeoFromSettings } from '../utils/siteSeo';
import {
  formatDirectoryCount,
} from '../utils/findYourWayGrouping';
import {
  filterGeneralDirectoryPlaces,
  getFoodAndStayCategoryIdSets,
  isDedicatedGuideListing,
} from '../utils/placeGuideExclusions';

// Home Section Components
import HomeBento from '../components/home/HomeBento';
import TopPicksSection from '../components/home/TopPicksSection';
import SponsoredSection from '../components/home/SponsoredSection';
import CommunitySection from '../components/home/CommunitySection';
import PracticalSection from '../components/home/PracticalSection';
import PlanVisitSection from '../components/home/PlanVisitSection';
import BrowseThemesSection from '../components/home/BrowseThemesSection';
import HomeUtilityBar from '../components/home/HomeUtilityBar';
import HomeFooter from '../components/home/HomeFooter';

import './css/Explore.css';
import './css/CommunityFeedRedesign.css';
import './css/PlanYourVisitRedesign.css';
import './css/FindYourWayRedesign.css';
import './css/BrowseThemesRedesign.css';

export default function Explore() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryCount, setCategoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [sponsoredHome, setSponsoredHome] = useState([]);
  const [homeEvents, setHomeEvents] = useState([]);
  const [homeTours, setHomeTours] = useState([]);
  const [loadNonce, setLoadNonce] = useState(0);

  const sponsoredHomeEnabled = settings?.sponsoredPlacesEnabled?.home !== false;

  useEffect(() => {
    const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.allSettled([api.places.list({ lang: langParam }), api.categories.list({ lang: langParam })])
      .then((results) => {
        if (cancelled) return;
        const [pRes, cRes] = results;
        if (pRes.status === 'rejected') {
          const err = pRes.reason;
          const apiErr = err?.data?.error || err?.message;
          const detail =
            import.meta.env.DEV && err?.data?.detail ? `\n\n${err.data.detail}` : '';
          setError(String(apiErr || err || 'Failed to load') + detail);
          return;
        }
        const pr = pRes.value;
        const pl = pr.popular || pr.locations || [];
        setPlaces(Array.isArray(pl) ? pl : []);
        if (cRes.status === 'fulfilled') {
          const cats = cRes.value?.categories || [];
          const arr = Array.isArray(cats) ? cats : [];
          setCategories(arr);
          setCategoryCount(arr.length);
        } else {
          setCategories([]);
          setCategoryCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, loadNonce]);

  useEffect(() => {
    if (loading || error) return;
    const hash = window.location.hash;
    const allowedHashes = ['#plan', '#experience', '#why', '#plan-trip', '#download-app', '#community', '#areas'];
    if (hash && allowedHashes.includes(hash)) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, error]);

  useEffect(() => {
    trackEvent(user, 'page_view', { page: 'home' });
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.events.list({ lang }), api.tours.list({ lang })])
      .then(([evRes, toRes]) => {
        if (cancelled) return;
        if (evRes.status === 'fulfilled') {
          const ev = evRes.value?.events || [];
          setHomeEvents(Array.isArray(ev) ? ev.slice(0, 8) : []);
        }
        if (toRes.status === 'fulfilled') {
          const to = toRes.value?.featured || [];
          setHomeTours(Array.isArray(to) ? to.slice(0, 8) : []);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lang]);

  useEffect(() => {
    applyHomeSeoFromSettings(settings);
  }, [settings.metaDescription, settings.siteName]);

  const bentoHeroUrl = useMemo(() => resolveHomeBentoVisuals(settings).hero, [settings]);

  useEffect(() => {
    const id = 'tripoli-preload-bento-hero';
    const heroTrim = (bentoHeroUrl || '').trim();
    const defaultHero = (homeBentoDefaults.hero || '').trim();
    if (heroTrim === defaultHero) {
      document.getElementById(id)?.remove();
      return undefined;
    }
    const raw = getBentoHeroPreloadHref(bentoHeroUrl);
    const href = normalizePreloadImageHref(raw);
    if (!href) {
      document.getElementById(id)?.remove();
      return undefined;
    }
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'preload';
      link.as = 'image';
      document.head.appendChild(link);
    }
    link.href = href;
    link.setAttribute('fetchpriority', 'high');
    return () => {
      link?.remove();
    };
  }, [bentoHeroUrl]);

  useEffect(() => {
    let cancelled = false;
    api
      .communityFeed({ limit: 48, sort: 'smart' })
      .then((r) => {
        if (!cancelled) setCommunityPosts(Array.isArray(r.posts) ? r.posts : []);
      })
      .catch(() => {
        if (!cancelled) setCommunityPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
    let cancelled = false;
    if (!sponsoredHomeEnabled) {
      setSponsoredHome([]);
      return undefined;
    }
    api
      .sponsoredPlaces({ surface: 'home', lang: langParam })
      .then((r) => {
        if (cancelled) return;
        setSponsoredHome(Array.isArray(r.items) ? r.items : []);
      })
      .catch(() => {
        if (!cancelled) setSponsoredHome([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, sponsoredHomeEnabled]);

  const heroTitle = settings.siteName?.trim() || t('home', 'heroTitle');
  const heroTagline = resolveHeroTagline(settings, t);
  const appStoreHref = settings.appStoreUrl?.trim() || 'https://apps.apple.com';
  const playStoreHref = settings.playStoreUrl?.trim() || 'https://play.google.com';
  const showMap = settings.showMap !== false;

  const placesList = Array.isArray(places) ? places : [];
  const directoryPlaces = useMemo(
    () => filterGeneralDirectoryPlaces(placesList, categories),
    [placesList, categories]
  );

  const sponsoredHomeVisible = useMemo(() => {
    if (!Array.isArray(sponsoredHome) || sponsoredHome.length === 0) return [];
    const { foodCategoryIds, stayCategoryIds } = getFoodAndStayCategoryIdSets(categories);
    return sponsoredHome.filter((item) => {
      const pid = item.placeId ?? item.place?.id;
      if (pid == null) return false;
      const pl = placesList.find((x) => String(x.id) === String(pid)) || item.place;
      if (!pl) return false;
      return !isDedicatedGuideListing(pl, foodCategoryIds, stayCategoryIds);
    });
  }, [sponsoredHome, categories, placesList]);

  const placeNameById = useMemo(() => {
    const m = new Map();
    for (const p of placesList) {
      if (p?.id == null) continue;
      const nm = p?.name != null ? String(p.name).trim() : '';
      m.set(String(p.id), nm);
    }
    return m;
  }, [placesList]);

  const bentoAvatarLinkLabel = useCallback(
    (slot) => {
      if (slot.placeId) {
        const name = placeNameById.get(String(slot.placeId)) || '';
        if (name) return t('home', 'bentoAvatarPlaceLink').replace(/\{name\}/g, name);
        return t('home', 'bentoAvatarPlaceLinkNoName');
      }
      return t('home', 'bentoAvatarCommunityLink');
    },
    [placeNameById, t]
  );

  const topPicks = useMemo(
    () =>
      directoryPlaces
        .slice()
        .sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0))
        .slice(0, 6),
    [directoryPlaces]
  );

  if (loading) {
    return (
      <div className="vd vd-home">
        <section className="vd-hero">
          <h1 className="vd-hero-title">{heroTitle}</h1>
        </section>
        <div className="vd-loading">
          <div className="vd-loading-spinner" aria-hidden="true" />
          <span>{t('home', 'loading')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vd vd-home">
        <section className="vd-hero">
          <h1 className="vd-hero-title">{heroTitle}</h1>
        </section>
        <div className="vd-error vd-error-panel" role="alert">
          <h2 className="vd-error-panel-title">{t('home', 'loadErrorTitle')}</h2>
          <p className="vd-error-panel-hint">{t('home', 'loadErrorHint')}</p>
          <p className="vd-error-panel-detail" style={{ textAlign: 'center' }}>
            {error}
          </p>
          <div className="vd-error-actions">
            <button
              type="button"
              className="vd-btn vd-btn--primary"
              onClick={() => setLoadNonce((n) => n + 1)}
            >
              {t('home', 'loadErrorRetry')}
            </button>
            <Link to={PLACES_DISCOVER_PATH} className="vd-btn vd-btn--outline">
              {t('home', 'loadErrorBrowse')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const placeCountStr = formatDirectoryCount(directoryPlaces.length, lang);
  const categoryCountStr = formatDirectoryCount(categoryCount, lang);
  const bentoV = resolveHomeBentoVisuals(settings);
  const bentoAvatarSlots = resolveBentoAvatarSlots(settings, placesList, (p) =>
    getPlaceImageUrl(p?.image || (Array.isArray(p?.images) && p.images[0]))
  );
  const showBentoAvatarStack = bentoAvatarSlots.some((s) => s.href || s.placeId);

  return (
    <div className="vd vd-home">
      <HomeBento
        t={t}
        heroTitle={heroTitle}
        heroTagline={heroTagline}
        bentoV={bentoV}
        showBentoAvatarStack={showBentoAvatarStack}
        bentoAvatarSlots={bentoAvatarSlots}
        bentoAvatarLinkLabel={bentoAvatarLinkLabel}
        placeCountStr={placeCountStr}
        categoryCountStr={categoryCountStr}
        appStoreHref={appStoreHref}
        playStoreHref={playStoreHref}
      />

      {/* 
      <BrowseThemesSection
        t={t}
        lang={lang}
        places={directoryPlaces}
        categories={categories}
      />
      */}


      <TopPicksSection 
        places={topPicks} 
        t={t} 
        moreTo={PLACES_DISCOVER_PATH} 
      />

      <SponsoredSection
        enabled={sponsoredHomeEnabled}
        items={sponsoredHomeVisible}
        t={t}
      />

      <EventsAndToursSection 
        events={homeEvents} 
        tours={homeTours} 
        t={t} 
      />

      <CommunitySection 
        posts={communityPosts} 
        t={t} 
      />

      <PracticalSection
        t={t}
        places={placesList}
        showMap={showMap}
        userTips={user?.showTips !== false}
      />

      <PlanVisitSection
        t={t}
        lang={lang}
        showMap={showMap}
      />

      <HomeUtilityBar 
        t={t} 
        showMap={showMap} 
      />

      <HomeFooter 
        settings={settings} 
        t={t} 
        showMap={showMap} 
      />
    </div>
  );
}
