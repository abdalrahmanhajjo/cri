import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import Icon from '../components/Icon';
import { CommunityFeedStrip } from '../components/CommunityFeed';
import FindYourWayMap from '../components/FindYourWayMap';
import SponsoredPlaceCard from '../components/SponsoredPlaceCard';
import { trackEvent } from '../utils/analytics';
import { homeBentoDefaults, resolveHomeBentoVisuals, resolveBentoAvatarSlots, bentoCssUrl } from '../config/homeBentoVisuals';
import {
  getBentoHeroImgProps,
  getBentoHeroPreloadHref,
  isDefaultCityHeroPath,
  normalizePreloadImageHref,
} from '../utils/bentoHeroImage';
import { cityHeroWebpSrcSet, CITY_HERO_SIZES } from '../constants/cityHero';
import { resolveHeroTagline, resolveFooterTagline } from '../config/resolveSiteTagline';
import {
  COMMUNITY_PATH,
  PLACES_DISCOVER_PATH,
  DINING_PATH,
  HOTELS_PATH,
  discoverSearchUrl,
} from '../utils/discoverPaths';
import { applyHomeSeoFromSettings } from '../utils/siteSeo';
import { getApiOrigin } from '../utils/apiOrigin';
import {
  WAYS_CONFIG,
  groupPlacesByWay,
  countDirectoryCategoriesForWay,
  formatFindYourWayThemeTitle,
} from '../utils/findYourWayGrouping';
import {
  filterGeneralDirectoryPlaces,
  getFoodAndStayCategoryIdSets,
  isDedicatedGuideListing,
} from '../utils/placeGuideExclusions';
import { supabaseOptimizeForThumbnail } from '../utils/supabaseImage.js';
import { beginFavouritesRead, shouldApplyFavouritesRead } from '../utils/favouritesReadGate';
import './Explore.css';
import './CommunityFeedRedesign.css';
import './PlanYourVisitRedesign.css';
import './FindYourWayRedesign.css';
import './BrowseThemesRedesign.css';

const TRIPOLI_TIMEZONE = 'Asia/Beirut';

function TripoliClock({ title, condition, locale, dateLabel, timezoneLabel }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const opts = { timeZone: TRIPOLI_TIMEZONE };
  const safeLocale = typeof locale === 'string' ? locale : 'en-GB';
  const timeStr = now.toLocaleTimeString(safeLocale, { ...opts, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString(safeLocale, { ...opts, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const safeTitle = title ?? '';
  const safeCondition = condition ?? '';
  const safeDateLabel = dateLabel ?? 'Date';
  const safeTimezoneLabel = timezoneLabel ?? 'Time zone';
  return (
    <div className="vd-widget vd-widget--open vd-tripoli-clock" aria-live="polite" aria-label={safeTitle || 'Tripoli local time'}>
      <div className="vd-widget-left">
        <h3 className="vd-widget-title">{safeTitle}</h3>
        <div className="vd-widget-main">
          <span className="vd-widget-value vd-tripoli-clock-time">{timeStr}</span>
          <span className="vd-widget-icon vd-tripoli-clock-icon" aria-hidden="true" title="Tripoli local time">
            <svg width="34" height="34" viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <p className="vd-widget-condition">{safeCondition}</p>
      </div>
      <div className="vd-widget-right">
        <div className="vd-widget-details">
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{safeDateLabel}</span>
            <span className="vd-widget-detail-value">{dateStr}</span>
          </div>
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{safeTimezoneLabel}</span>
            <span className="vd-widget-detail-value">Asia/Beirut</span>
        </div>
      </div>
      </div>
    </div>
  );
}

/** Latin digits for stat tiles (consistent with mixed-language UI). */
function formatDirectoryCount(n, lang) {
  const safe = Number.isFinite(n) ? Math.max(0, Math.floor(Number(n))) : 0;
  const locale = lang === 'fr' ? 'fr' : 'en';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(safe);
}

function tripoliWeatherApiUrl() {
  const base = getApiOrigin();
  const path = '/api/public/weather/tripoli';
  return base ? `${base}${path}` : path;
}

function wmoToConditionKey(code) {
  if (code === 0 || code === 1) return 'weatherSunny';
  if (code === 2) return 'weatherPartlyCloudy';
  if (code === 3) return 'weatherCloudy';
  if (code === 45 || code === 48) return 'weatherFog';
  if (code >= 51 && code <= 57) return 'weatherDrizzle';
  if (code >= 61 && code <= 67 || (code >= 80 && code <= 82)) return 'weatherRain';
  if (code >= 71 && code <= 77) return 'weatherSnow';
  if (code >= 95 && code <= 99) return 'weatherThunderstorm';
  return 'weatherSunny';
}

function WeatherTripoli({
  title,
  sunriseLabel,
  sunsetLabel,
  lowLabel,
  highLabel,
  humidityLabel,
  windLabel,
  celsiusLabel,
  fahrenheitLabel,
  t,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unit, setUnit] = useState('c');
  useEffect(() => {
    let cancelled = false;
    const url = tripoliWeatherApiUrl();
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status === 502 ? 'Weather temporarily unavailable' : `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message ?? err ?? 'Failed to load'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || error || !data || !data.current || !data.daily) {
    return (
      <div className="vd-widget vd-widget--open vd-weather-tripoli">
        <h3 className="vd-widget-title">{title ?? 'Weather'}</h3>
        <div className="vd-widget-loading">
          {loading ? t('home', 'loading') : '—'}
        </div>
      </div>
    );
  }

  const cur = data.current;
  const daily = data.daily;
  const tempC = cur && typeof cur.temperature_2m === 'number' ? cur.temperature_2m : 0;
  const tempF = (tempC * 9) / 5 + 32;
  const displayTemp = unit === 'c' ? `${Number(tempC).toFixed(1)}°` : `${Number(tempF).toFixed(1)}°`;
  const conditionKey = wmoToConditionKey(cur && typeof cur.weather_code === 'number' ? cur.weather_code : 0);
  const lowC = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null;
  const highC = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null;
  const lowF = lowC != null && typeof lowC === 'number' ? (lowC * 9) / 5 + 32 : null;
  const highF = highC != null && typeof highC === 'number' ? (highC * 9) / 5 + 32 : null;
  const sunriseArr = Array.isArray(daily.sunrise) ? daily.sunrise[0] : null;
  const sunsetArr = Array.isArray(daily.sunset) ? daily.sunset[0] : null;
  const sunrise = typeof sunriseArr === 'string' && sunriseArr.length >= 16 ? sunriseArr.slice(11, 16) : '—';
  const sunset = typeof sunsetArr === 'string' && sunsetArr.length >= 16 ? sunsetArr.slice(11, 16) : '—';
  const humidity = cur && typeof cur.relative_humidity_2m === 'number' ? `${cur.relative_humidity_2m}%` : '—';
  const wind = cur && (typeof cur.wind_speed_10m === 'number' || typeof cur.wind_speed_10m === 'string') ? `${cur.wind_speed_10m} km/h` : '—';

  return (
    <div className="vd-widget vd-widget--open vd-weather-tripoli" aria-label={title || 'Weather in Tripoli'}>
      <div className="vd-widget-left">
        <h3 className="vd-widget-title">{title}</h3>
        <div className="vd-widget-main">
          <span className="vd-widget-value vd-weather-temp">{displayTemp}</span>
          <span className="vd-widget-icon vd-weather-icon" aria-hidden="true">
            <WeatherIcon code={cur.weather_code} />
          </span>
        </div>
        <p className="vd-widget-condition">{t('home', conditionKey)}</p>
        <div className="vd-widget-units">
          <button type="button" className={unit === 'c' ? 'vd-widget-unit vd-widget-unit--active' : 'vd-widget-unit'} onClick={() => setUnit('c')}>{celsiusLabel}</button>
          <button type="button" className={unit === 'f' ? 'vd-widget-unit vd-widget-unit--active' : 'vd-widget-unit'} onClick={() => setUnit('f')}>{fahrenheitLabel}</button>
        </div>
      </div>
      <div className="vd-widget-right">
        <div className="vd-widget-details">
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{sunriseLabel}</span>
            <span className="vd-widget-detail-value">{sunrise}</span>
          </div>
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{sunsetLabel}</span>
            <span className="vd-widget-detail-value">{sunset}</span>
          </div>
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{lowLabel}</span>
            <span className="vd-widget-detail-value">{unit === 'c' ? (lowC != null ? `${Number(lowC).toFixed(1)}°` : '—') : (lowF != null ? `${Number(lowF).toFixed(1)}°` : '—')}</span>
          </div>
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{highLabel}</span>
            <span className="vd-widget-detail-value">{unit === 'c' ? (highC != null ? `${Number(highC).toFixed(1)}°` : '—') : (highF != null ? `${Number(highF).toFixed(1)}°` : '—')}</span>
          </div>
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{humidityLabel}</span>
            <span className="vd-widget-detail-value">{humidity}</span>
          </div>
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{windLabel}</span>
            <span className="vd-widget-detail-value">{wind}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeatherIcon({ code }) {
  if (code === 0 || code === 1) return <span className="vd-weather-sun" aria-hidden="true" />;
  if (code === 2) return <span className="vd-weather-partly-cloudy" aria-hidden="true" />;
  if (code === 3) return <span className="vd-weather-cloudy" aria-hidden="true" />;
  if (code >= 51 && code <= 67 || (code >= 80 && code <= 82)) return <span className="vd-weather-rain" aria-hidden="true" />;
  if (code >= 95 && code <= 99) return <span className="vd-weather-storm" aria-hidden="true" />;
  return <span className="vd-weather-sun" aria-hidden="true" />;
}

function PlaceCard({ place, size }) {
  if (!place || place.id == null) return null;
  const placeId = String(place.id);
  const safeImgUrl = getPlaceImageUrl(place.image || (Array.isArray(place.images) && place.images[0])) || null;
  const isFeatured = size === 'featured';
  const name = place.name != null ? String(place.name) : '';
  const location = place.location != null ? String(place.location) : '';
  const rating = place.rating != null ? Number(place.rating) : null;
  return (
    <Link
      to={`/place/${placeId}`}
      className={`vd-card vd-card--place ${isFeatured ? 'vd-card--featured' : ''}`}
    >
      <div className="vd-card-media">
        {safeImgUrl ? (
          <DeliveryImg
            url={safeImgUrl}
            preset={isFeatured ? 'gridCardFeatured' : 'gridCard'}
            alt=""
          />
        ) : (
          <span className="vd-card-fallback">Place</span>
        )}
        <div className="vd-card-overlay">
          <h3 className="vd-card-title">{name || 'Place'}</h3>
          {location && <p className="vd-card-meta">{location}</p>}
        </div>
        {rating != null && !Number.isNaN(rating) && (
          <span className="vd-card-badge vd-card-rating"><Icon name="star" size={16} /> {rating.toFixed(1)}</span>
        )}
      </div>
    </Link>
  );
}

function TopPicksCarousel({ places, t, moreTo }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const safePlaces = Array.isArray(places) ? places : [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (safePlaces.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % safePlaces.length);
    }, 10000);
    return () => clearInterval(id);
  }, [safePlaces.length]);

  useEffect(() => {
    setIndex((i) => (safePlaces.length ? Math.min(i, safePlaces.length - 1) : 0));
  }, [safePlaces.length]);

  const handlePrev = useCallback((e) => {
    e?.preventDefault();
    setIndex((i) => (i - 1 + safePlaces.length) % safePlaces.length);
  }, [safePlaces.length]);

  const handleNext = useCallback((e) => {
    e?.preventDefault();
    setIndex((i) => (i + 1) % safePlaces.length);
  }, [safePlaces.length]);

  const onCarouselKeyDown = useCallback(
    (e) => {
      if (safePlaces.length <= 1) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex((i) => (i + 1) % safePlaces.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => (i - 1 + safePlaces.length) % safePlaces.length);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setIndex(safePlaces.length - 1);
      }
    },
    [safePlaces.length]
  );

  const [favouriteIds, setFavouriteIds] = useState(new Set());
  useEffect(() => {
    if (!user) {
      setFavouriteIds(new Set());
      return;
    }
    const rid = beginFavouritesRead();
    api.user
      .favourites()
      .then((res) => {
        if (!shouldApplyFavouritesRead(rid)) return;
        setFavouriteIds(new Set((Array.isArray(res.placeIds) ? res.placeIds : []).map(String)));
      })
      .catch(() => {
        if (shouldApplyFavouritesRead(rid)) setFavouriteIds(new Set());
      });
  }, [user]);

  const toggleFavourite = useCallback(
    (e, placeId) => {
      e.preventDefault();
      e.stopPropagation();
      if (!user) {
        navigate('/login', { state: { from: 'favourite' } });
        return;
      }
      const id = placeId != null ? String(placeId) : '';
      if (!id) return;
      const isFav = favouriteIds.has(id);
      if (isFav) {
        api.user
          .removeFavourite(id)
          .then(() => {
            setFavouriteIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            showToast(t('feedback', 'favouriteRemoved'), 'success');
          })
          .catch(() => showToast(t('feedback', 'favouriteUpdateFailed'), 'error'));
      } else {
        api.user
          .addFavourite(id)
          .then(() => {
            setFavouriteIds((prev) => new Set(prev).add(id));
            showToast(t('feedback', 'favouriteAdded'), 'success');
          })
          .catch(() => showToast(t('feedback', 'favouriteUpdateFailed'), 'error'));
      }
    },
    [user, favouriteIds, navigate, showToast, t]
  );

  return (
    <section className="vd-section vd-top-picks">
      <div className="vd-container">
        <header className="vd-top-picks-header">
          <div className="vd-top-picks-header-row">
            <div className="vd-top-picks-heading-text">
              <h2 className="vd-top-picks-title">{t('home', 'topPicks')}</h2>
              <p className="vd-top-picks-subtitle">{t('home', 'topPicksSub')}</p>
            </div>
            {moreTo ? (
              <Link to={moreTo} className="vd-community-feed-more">
                {t('discover', 'seeAllDiscover')}
                <Icon name="arrow_forward" size={18} />
              </Link>
            ) : null}
          </div>
        </header>

        <div
          className="vd-top-picks-carousel"
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label={t('home', 'topPicksCarouselLabel')}
          onKeyDown={onCarouselKeyDown}
        >
          <div
            className="vd-top-picks-track"
            style={{ 
              transform: `translateX(calc(-${index} * (100% + 24px)))`, 
              gap: '24px',
              direction: 'ltr' 
            }}
          >
            {safePlaces.map((p, slideIndex) => {
              if (!p || p.id == null) return null;
              const placeId = String(p.id);
              const safeImg = getPlaceImageUrl(p.image || (p.images && p.images[0])) || null;
              const name = p.name != null ? String(p.name) : '';
              const desc = p.description != null ? String(p.description) : '';
              const ratingNum = Number(p.rating);
              const rating = Number.isFinite(ratingNum) ? ratingNum : null;
              const isFavourite = favouriteIds.has(String(p.id));
              const heartAria = user
                ? (isFavourite ? t('home', 'removeFromFavourites') : t('home', 'addToFavourites'))
                : t('home', 'signInToSave');
              const titleId = `vd-top-picks-title-${placeId}`;
              return (
                <article key={placeId} className="vd-top-picks-card vd-top-picks-card--split-hit">
                  <Link
                    to={`/place/${placeId}`}
                    className="vd-top-picks-card-bg vd-top-picks-card-bg--hit"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    {safeImg ? (
                      <DeliveryImg
                        url={safeImg}
                        preset="topPicks"
                        alt=""
                        loading={slideIndex === 0 ? 'eager' : 'lazy'}
                        fetchPriority={slideIndex === 0 ? 'high' : undefined}
                      />
                    ) : (
                      <span className="vd-top-picks-fallback">Place</span>
                    )}
                  </Link>
                  <div className="vd-top-picks-card-body">
                    <div className="vd-top-picks-card-content">
                      <Link
                        to={`/place/${placeId}`}
                        className="vd-top-picks-card-text-hit"
                        aria-labelledby={titleId}
                        aria-describedby={desc ? `${titleId}-desc` : undefined}
                      >
                        <span className="vd-top-picks-eyebrow">{t('home', 'topPickEyebrow')}</span>
                        <h3 id={titleId} className="vd-top-picks-name">
                          {name}
                        </h3>
                        {desc ? (
                          <p id={`${titleId}-desc`} className="vd-top-picks-desc">
                            {desc}
                          </p>
                        ) : null}
                        <div className="vd-top-picks-details">
                          {rating != null && rating > 0 && (
                            <span className="vd-top-picks-detail vd-top-picks-detail--rating">
                              <Icon name="star" size={16} /> {rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </Link>
                    </div>
                    <div className="vd-top-picks-glass-footer">
                      <div className="vd-top-picks-cta-row">
                        <Link to={`/place/${placeId}`} className="vd-top-picks-read-now">
                          {t('home', 'topPicksReadMore')}
                          <Icon name="arrow_forward" size={18} className="vd-btn-arrow" />
                        </Link>
                        <div className="vd-top-picks-card-floating-actions">
                          <button
                            type="button"
                            className={`vd-top-picks-action-btn vd-top-picks-action-btn--heart ${isFavourite ? 'vd-top-picks-action-btn--active' : ''}`}
                            onClick={(e) => toggleFavourite(e, placeId)}
                            aria-label={heartAria}
                          >
                            <Icon name={isFavourite ? 'favorite' : 'favorite_border'} size={24} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {safePlaces.length > 1 && (
            <div className="vd-top-picks-nav" aria-hidden="true">
              <button
                type="button"
                className="vd-top-picks-arrow vd-top-picks-arrow--prev"
                onClick={handlePrev}
                aria-label={t('home', 'prevSlide')}
              >
                <Icon name="chevron_left" size={28} />
              </button>
              <button
                type="button"
                className="vd-top-picks-arrow vd-top-picks-arrow--next"
                onClick={handleNext}
                aria-label={t('home', 'nextSlide')}
              >
                <Icon name="chevron_right" size={28} />
              </button>
            </div>
          )}
        </div>

        <footer className="vd-top-picks-carousel-footer">
          <div className="vd-top-picks-counter">
            <span className="vd-top-picks-counter-label">{t('home', 'topPicksCounterLabel')}</span>
            <div className="vd-top-picks-counter-nums">
              <span className="vd-top-picks-counter-current">{String(index + 1).padStart(2, '0')}</span>
              <span className="vd-top-picks-counter-sep">/</span>
              <span className="vd-top-picks-counter-total">{String(safePlaces.length).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="vd-top-picks-dots" role="tablist">
            {safePlaces.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={t('home', 'goToSlide').replace('{n}', i + 1)}
                className={`vd-top-picks-dot ${i === index ? 'vd-top-picks-dot--active' : ''}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </footer>
      </div>
    </section>
  );
}

/** How many distinct directory categories appear in a theme bucket (via listing metadata). */
function themeCategoryStats(bucket, categories) {
  const ids = new Set();
  for (const p of bucket || []) {
    const id = p.categoryId ?? p.category_id;
    if (id != null) ids.add(String(id));
  }
  const known = new Set((categories || []).map((c) => String(c.id)));
  let resolved = 0;
  ids.forEach((id) => {
    if (known.has(id)) resolved += 1;
  });
  return { categoryCount: resolved, listingCount: (bucket || []).length };
}

/** Discover browse by theme — links go to `/discover` with `q` (not the map). */
function BrowseMapByThemeSection({
  t,
  lang,
  places = [],
  categories = [],
  diningGuideEnabled = true,
  hotelsGuideEnabled = true,
}) {
  const safeT = (ns, key) => (t && typeof t === 'function' ? t(ns, key) : key);
  const placesByWay = groupPlacesByWay(places, categories);
  const stepClass = ['vd-find-your-way-row--a', 'vd-find-your-way-row--b', 'vd-find-your-way-row--c', 'vd-find-your-way-row--d'];
  return (
    <section
      id="experience"
      className="vd-section vd-experience-tripoli vd-find-your-way vd-find-your-way--deck vd-find-your-way--map-themes"
      aria-labelledby="browse-map-themes-title"
    >
      <div className="vd-container">
        <header className="vd-find-your-way-header">
          <h2 id="browse-map-themes-title" className="vd-find-your-way-title">
            {safeT('home', 'findYourWayThemeDeckLabel')}
          </h2>
        </header>

        <div className="vd-find-your-way-deck" role="list">
          {WAYS_CONFIG.map((way, i) => {
            const bucket = placesByWay.get(way.wayKey) || [];
            const { categoryCount: categoriesWithListings, listingCount } = themeCategoryStats(bucket, categories);
            const directoryCategoryCount = countDirectoryCategoriesForWay(way.wayKey, categories);
            const categoryCount = Math.max(directoryCategoryCount, categoriesWithListings);
            const idx = String(i + 1).padStart(2, '0');
            const stagger = stepClass[i % stepClass.length];
            const asideNumber =
              categoryCount > 0
                ? formatDirectoryCount(categoryCount, lang)
                : listingCount > 0
                  ? formatDirectoryCount(listingCount, lang)
                  : null;
            const asideLabel =
              categoryCount > 0
                ? safeT('home', 'findYourWayCategoriesUnit')
                : listingCount > 0
                  ? safeT('home', 'findYourWayThemeEntriesLabel')
                  : null;
            const titleFromCategories = formatFindYourWayThemeTitle(
              way.wayKey,
              categories,
              lang,
              (n) => safeT('home', 'findYourWayThemeMore').split('{count}').join(String(n))
            );
            const rowTitle = titleFromCategories || safeT('home', way.titleKey);
            const discoverTo =
              way.wayKey === 'food'
                ? diningGuideEnabled
                  ? DINING_PATH
                  : discoverSearchUrl('restaurant')
                : way.wayKey === 'stay'
                  ? hotelsGuideEnabled
                    ? HOTELS_PATH
                    : discoverSearchUrl('hotel')
                  : way.discoverQ
                    ? discoverSearchUrl(way.discoverQ)
                    : discoverSearchUrl('');
            return (
              <Link
                key={way.wayKey}
                to={discoverTo}
                className={`vd-find-your-way-row ${stagger}`}
                role="listitem"
              >
                <span className="vd-find-your-way-row-index" aria-hidden="true">
                  {idx}
                </span>
                <span className="vd-find-your-way-row-glyph" aria-hidden="true">
                  <Icon name={way.icon} size={26} />
                </span>
                <div className="vd-find-your-way-row-copy">
                  <span className="vd-find-your-way-row-theme">{safeT('home', 'findYourWayRowKicker')}</span>
                  <h3 className="vd-find-your-way-row-title">{rowTitle}</h3>
                  <p className="vd-find-your-way-row-desc">{safeT('home', way.descKey)}</p>
                  <p className="vd-find-your-way-row-detail">{safeT('home', way.detailKey)}</p>
                </div>
                <div className="vd-find-your-way-row-aside">
                  {asideNumber != null ? (
                    <span className="vd-find-your-way-count">
                      <strong>{asideNumber}</strong>
                      <span className="vd-find-your-way-count-label">{asideLabel}</span>
                    </span>
                  ) : (
                    <span className="vd-find-your-way-count vd-find-your-way-count--empty">
                      {safeT('home', 'findYourWayComingSoon')}
                    </span>
                  )}
                  <span className="vd-find-your-way-row-chevron" aria-hidden="true">
                    <Icon name="arrow_forward" size={22} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="vd-find-your-way-cta-wrap">
          <Link to={discoverSearchUrl('')} className="vd-find-your-way-cta">
            {safeT('home', 'seeAllWaysDiscover')}
            <Icon name="arrow_forward" size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Areas map + transport/stay/tips — below featured picks and community on the home page. */
function FindYourWayPracticalSection({ t, places = [], showMap = true, showTips: _showTips = true }) {
  const safeT = (ns, key) => (t && typeof t === 'function' ? t(ns, key) : key);
  return (
    <section
      className="vd-section vd-experience-tripoli vd-find-your-way vd-find-your-way--practical"
      aria-labelledby="find-your-way-practical-title"
    >
      <div className="vd-container">
        <header className="vd-find-your-way-header">
          <h2 id="find-your-way-practical-title" className="vd-find-your-way-title">
            Find your way — navigation & maps
          </h2>
        </header>

        <div className="vd-find-your-way-main-grid">
          <div className="vd-find-your-way-areas-panel">
            <div id="areas" className="vd-plan-trip-block vd-find-your-way-areas-card vd-find-your-way-areas-card--map">
              <h3 className="vd-plan-trip-block-title">{safeT('home', 'areasTitle')}</h3>
              <p className="vd-plan-trip-block-desc">{safeT('home', 'areasMapSub')}</p>
              <FindYourWayMap places={places} t={t} />
            </div>
          </div>
          <div className="vd-find-your-way-side-stack">
            <div className="vd-plan-trip-block vd-plan-trip-block--compact vd-find-your-way-side-card">
              <h3 className="vd-plan-trip-block-title">{safeT('home', 'stayTitle')}</h3>
              <p className="vd-plan-trip-block-desc">{safeT('home', 'staySub')}</p>
              <div className="vd-plan-trip-inline-actions">
                <Link to={HOTELS_PATH} className="vd-plan-trip-cta vd-btn vd-btn--primary">
                  {safeT('home', 'stayBrowseHotels')}
                  <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />
                </Link>
                {showMap && (
                  <Link to="/map?q=hotel" className="vd-plan-trip-inline-link">
                    {safeT('home', 'stayCta')}
                    <Icon name="arrow_forward" size={18} aria-hidden />
                  </Link>
                )}
              </div>
            </div>

            <div className="vd-plan-trip-block vd-plan-trip-block--compact vd-find-your-way-side-card">
              <h3 className="vd-plan-trip-block-title">{safeT('home', 'diningTitle')}</h3>
              <p className="vd-plan-trip-block-desc">{safeT('home', 'diningSub')}</p>
              <div className="vd-plan-trip-inline-actions">
                <Link to={DINING_PATH} className="vd-plan-trip-cta vd-btn vd-btn--primary">
                  {safeT('home', 'diningCta')}
                  <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />
                </Link>
                {showMap && (
                  <Link to="/map?q=dining" className="vd-plan-trip-inline-link">
                    {safeT('home', 'viewMapCta')}
                    <Icon name="arrow_forward" size={18} aria-hidden />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

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
  const [loadNonce, setLoadNonce] = useState(0);

  const diningGuideEnabled = settings?.diningGuide?.enabled !== false;
  const hotelsGuideEnabled = settings?.hotelsGuide?.enabled !== false;
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
    applyHomeSeoFromSettings(settings);
  }, [settings.metaDescription, settings.siteName]);

  const bentoHeroUrl = useMemo(() => resolveHomeBentoVisuals(settings).hero, [settings]);

  useEffect(() => {
    const id = 'tripoli-preload-bento-hero';
    const heroTrim = (bentoHeroUrl || '').trim();
    const defaultHero = (homeBentoDefaults.hero || '').trim();
    /* index.html preloads default city WebP srcset; skip JS tag to avoid duplicate requests */
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
  const topPicks = directoryPlaces
    .slice()
    .sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0))
    .slice(0, 6);
  const bentoV = resolveHomeBentoVisuals(settings);
  const bentoAvatarSlots = resolveBentoAvatarSlots(settings, placesList, (p) =>
    getPlaceImageUrl(p?.image || (Array.isArray(p?.images) && p.images[0]))
  );
  const showBentoAvatarStack = bentoAvatarSlots.some((s) => s.href || s.placeId);

  return (
    <div className="vd vd-home">
      {/* Gateway — bento (hero, discover, why, directory snapshot) */}
      <section id="download-app" className="vd-home-bento">
        <div className="vd-container vd-home-bento-inner">
          <div className="vd-home-bento-grid">
            <div className="vd-bento-hero-why-bundle">
              <div className="vd-bento-card vd-bento-hero-main">
                {isDefaultCityHeroPath(bentoV.hero) ? (
                  <picture>
                    <source media="(max-width: 767px)" srcSet="/oscar-niemeyer-arch.jpg" />
                    <source media="(min-width: 768px)" srcSet="/oscar-niemeyer-arch-wide.jpg" />
                    <source type="image/webp" srcSet={cityHeroWebpSrcSet()} sizes={CITY_HERO_SIZES} />
                    <img
                      className="vd-bento-hero-main-photo"
                      alt=""
                      draggable={false}
                      {...getBentoHeroImgProps(bentoV.hero)}
                    />
                  </picture>
                ) : (
                  <img
                    className="vd-bento-hero-main-photo"
                    alt=""
                    draggable={false}
                    {...getBentoHeroImgProps(bentoV.hero)}
                  />
                )}
                <div className="vd-bento-hero-main-scrim" aria-hidden="true" />
                <div className="vd-bento-hero-main-content">
                  <div className="vd-bento-hero-copy">
                    <h1 className="vd-bento-hero-title">{heroTitle}</h1>
                    <p className="vd-bento-hero-tagline">{heroTagline}</p>
                  </div>
                  <div className="vd-bento-hero-meta">
                    <div className="vd-bento-hero-ctas">
                      <Link to="/plan" className="vd-bento-btn vd-bento-btn--primary">
                        {t('home', 'webTripPlannerCta')}
                        <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />
                      </Link>
                    </div>
                    {showBentoAvatarStack && (
                      <div
                        className="vd-bento-avatar-stack"
                        role="group"
                        aria-label={t('home', 'bentoAvatarStackAria')}
                      >
                        {bentoAvatarSlots.map((slot, i) => {
                          const to = slot.placeId ? `/place/${slot.placeId}` : COMMUNITY_PATH;
                          const key = slot.placeId ? `bento-av-${slot.placeId}` : `bento-av-${i}`;
                          return (
                            <Link
                              key={key}
                              to={to}
                              className="vd-bento-avatar"
                              aria-label={bentoAvatarLinkLabel(slot)}
                              style={
                                slot.href
                                  ? { backgroundImage: bentoCssUrl(supabaseOptimizeForThumbnail(slot.href, 120)) }
                                  : undefined
                              }
                            >
                              {!slot.href && <Icon name="travel_explore" size={22} aria-hidden />}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="vd-bento-card vd-bento-why-intro">
                <div className="vd-bento-why-intro-top">
                  <h2 className="vd-bento-why-intro-title">{t('home', 'whyVisitTitle')}</h2>
                </div>
                <p className="vd-bento-why-intro-sub">{t('home', 'whyVisitSub')}</p>
                <div className="vd-bento-why-intro-footer">
                  <Link to={PLACES_DISCOVER_PATH} className="vd-bento-why-intro-link">
                    <span>{t('home', 'seeAllWays')}</span>
                    <Icon name="arrow_forward" size={20} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="vd-bento-card vd-bento-hero-side vd-bento-web-hub">
              <div className="vd-bento-web-hub-inner">
                <p className="vd-bento-web-hub-kicker">{t('home', 'useWebCta')}</p>
                <div className="vd-bento-web-hub-header">
                  <div className="vd-bento-web-hub-icon" aria-hidden="true">
                    <Icon name="map" size={26} />
                  </div>
                  <div className="vd-bento-web-hub-titles">
                    <p className="vd-bento-web-hub-name">{t('home', 'bentoWebHubTitle')}</p>
                    <p className="vd-bento-web-hub-sub">{t('home', 'bentoWebHubSub')}</p>
                  </div>
                </div>
                <ul className="vd-bento-web-hub-facts">
                  <li>{t('home', 'bentoWebHubFact1')}</li>
                  <li>{t('home', 'bentoWebHubFact2')}</li>
                  <li>{t('home', 'bentoWebHubFact3')}</li>
                </ul>
                <p className="vd-bento-web-hub-footnote">{t('home', 'bentoWebHubFootnote')}</p>
                <Link to="/plan" className="vd-bento-web-hub-cta">
                  <span className="vd-bento-web-hub-cta-label">{t('home', 'bentoWebHubCta')}</span>
                  <Icon name="arrow_forward" size={20} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div
              id="why"
              className="vd-bento-card vd-bento-mosaic"
              style={{ '--bento-mosaic-img': bentoCssUrl(bentoV.mosaic) }}
            >
              <div className="vd-bento-mosaic-bg" aria-hidden="true" />
              <div className="vd-bento-mosaic-top">
                <Link
                  to={COMMUNITY_PATH}
                  className="vd-bento-mosaic-snap vd-bento-mosaic-snap--phone"
                  aria-label={`${t('home', 'bentoMosaicSnapAria')}: ${placeCountStr} ${t('home', 'bentoMosaicSnapPlacesUnit')}, ${categoryCountStr} ${t('home', 'bentoMosaicSnapCategoriesUnit')}`}
                >
                  <span className="vd-bento-mosaic-snap-glow" aria-hidden="true" />
                  <span className="vd-bento-mosaic-snap-body">
                    <span className="vd-bento-mosaic-snap-line">
                      <strong className="vd-bento-mosaic-snap-n">{placeCountStr}</strong>
                      <span className="vd-bento-mosaic-snap-u">{t('home', 'bentoMosaicSnapPlacesUnit')}</span>
                      <span className="vd-bento-mosaic-snap-sep" aria-hidden="true">
                        ·
                      </span>
                      <strong className="vd-bento-mosaic-snap-n">{categoryCountStr}</strong>
                      <span className="vd-bento-mosaic-snap-u">{t('home', 'bentoMosaicSnapCategoriesUnit')}</span>
                    </span>
                    <span className="vd-bento-mosaic-snap-sub">{t('home', 'bentoMosaicSnapSub')}</span>
                  </span>
                  <span className="vd-bento-mosaic-snap-arrow" aria-hidden="true">
                    <Icon name="arrow_forward" size={18} />
                  </span>
                </Link>
                <div className="vd-bento-stat-grid vd-bento-mosaic-stats-desktop">
                  <Link
                    to={COMMUNITY_PATH}
                    className="vd-bento-stat vd-bento-stat--dark vd-bento-stat--link"
                    aria-label={`${placeCountStr} ${t('home', 'bentoStatPlaces')}`}
                  >
                    <strong className="vd-bento-stat-num">{placeCountStr}</strong>
                    <span className="vd-bento-stat-label">{t('home', 'bentoStatPlaces')}</span>
                  </Link>
                  <Link
                    to={PLACES_DISCOVER_PATH}
                    className="vd-bento-stat vd-bento-stat--light vd-bento-stat--link"
                    aria-label={`${categoryCountStr} ${t('home', 'bentoStatCategories')}`}
                  >
                    <strong className="vd-bento-stat-num">{categoryCountStr}</strong>
                    <span className="vd-bento-stat-label">{t('home', 'bentoStatCategories')}</span>
                    <span className="vd-bento-stat-cta" aria-hidden="true">
                      <Icon name="arrow_forward" size={16} />
                    </span>
                  </Link>
                </div>
              </div>

              <div className="vd-bento-mosaic-panel">
                <p className="vd-bento-panel-kicker vd-bento-panel-kicker--desktop">{t('home', 'bentoMosaicKicker')}</p>
                <div className="vd-bento-mosaic-panel-grid">
                  <div className="vd-bento-mosaic-panel-copy">
                    <p className="vd-bento-panel-note vd-bento-panel-note--desktop">{t('home', 'bentoSiteGuideAppNote')}</p>
                    <p className="vd-bento-panel-lead-short">{t('home', 'bentoSiteGuideLeadShort')}</p>
                  </div>
                  <div className="vd-bento-mosaic-panel-apps">
                    <p className="vd-bento-panel-badges-label">{t('home', 'bentoSiteGuideAppStoreLabel')}</p>
                    <div className="vd-bento-panel-badges">
                      <a
                        href={appStoreHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vd-download-app-badge vd-download-app-badge--apple"
                        aria-label={t('home', 'getOnAppStore')}
                      >
                        <Icon name="phone_iphone" size={24} />
                        <span>{t('home', 'getOnAppStore')}</span>
                      </a>
                      <a
                        href={playStoreHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vd-download-app-badge vd-download-app-badge--google"
                        aria-label={t('home', 'getOnGooglePlay')}
                      >
                        <Icon name="android" size={22} />
                        <span>{t('home', 'getOnGooglePlay')}</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="vd-bento-mosaic-footer">
                <Link to={PLACES_DISCOVER_PATH} className="vd-bento-mosaic-cta">
                  {t('home', 'seeAllWays')}
                  <Icon name="arrow_forward" className="vd-btn-arrow" size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Discover by theme — first; #experience hash targets this block */}
      <BrowseMapByThemeSection
        t={t}
        lang={lang}
        places={directoryPlaces}
        categories={categories}
        diningGuideEnabled={diningGuideEnabled}
        hotelsGuideEnabled={hotelsGuideEnabled}
      />

      {/* Featured picks first; community feed directly below */}
      {topPicks.length > 0 && (
        <TopPicksCarousel places={topPicks} t={t} moreTo={PLACES_DISCOVER_PATH} />
      )}

      {sponsoredHomeEnabled && sponsoredHomeVisible.length > 0 && (
        <section className="vd-section vd-sponsored" aria-label={t('discover', 'sponsoredSectionTitle')}>
          <div className="vd-container">
            <header className="vd-section-head vd-sponsored-head">
              <h2 className="vd-section-title">{t('discover', 'sponsoredSectionTitle')}</h2>
              <p className="vd-section-subtitle vd-sponsored-sub">{t('discover', 'sponsoredSectionSub')}</p>
            </header>
            <div className="vd-sponsored-grid">
              {sponsoredHomeVisible.slice(0, 6).map((item) => (
                <SponsoredPlaceCard key={item.id || item.placeId} item={item} t={t} variant="tile" />
              ))}
            </div>
          </div>
        </section>
      )}

      {communityPosts.length > 0 && (
        <CommunityFeedStrip posts={communityPosts} t={t} moreTo={COMMUNITY_PATH} layout="bento" />
      )}

      <FindYourWayPracticalSection
        t={t}
        places={directoryPlaces}
        showMap={showMap}
        showTips={user?.showTips !== false}
      />

      {user?.showTips === false && (
        <section id="plan-trip" className="vd-section vd-plan-trip-one vd-plan-trip-one--tips">
          <div className="vd-container">
            <header className="vd-plan-trip-header">
              <h2 className="vd-plan-trip-section-title">{t('home', 'planTripTipsSectionTitle')}</h2>
              <p className="vd-plan-trip-section-sub">{t('home', 'planTripTipsSectionSub')}</p>
            </header>
            <div className="vd-plan-trip-block vd-plan-trip-block--compact">
              <p className="vd-plan-trip-block-desc">{t('home', 'planTripTipsFallback')}</p>
              <div className="vd-plan-trip-inline-actions">
                <Link to="/plan" className="vd-plan-trip-inline-link">
                  {t('home', 'gettingThereCta')}
                  <Icon name="arrow_forward" size={18} />
                </Link>
                <Link to={PLACES_DISCOVER_PATH} className="vd-plan-trip-inline-link">
                  {t('home', 'seeAllWays')}
                  <Icon name="arrow_forward" size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Plan your visit – one card: time + weather, then description & View map */}
      <section id="plan" className="vd-section vd-plan">
        <div className="vd-container vd-plan-inner">
          <h2 className="vd-plan-title">{t('home', 'planTitle')}</h2>
          <div className="vd-plan-card">
            <div className="vd-widgets-row">
            <TripoliClock
              title={t('home', 'tripoliClockLabel')}
              condition={t('home', 'tripoliClockCondition')}
              locale={lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-FR' : 'en-GB'}
              dateLabel={t('home', 'tripoliClockDate')}
              timezoneLabel={t('home', 'tripoliClockTimezone')}
            />
            <WeatherTripoli
              title={t('home', 'weatherInTripoli')}
              sunriseLabel={t('home', 'weatherSunrise')}
              sunsetLabel={t('home', 'weatherSunset')}
              lowLabel={t('home', 'weatherLow')}
              highLabel={t('home', 'weatherHigh')}
              humidityLabel={t('home', 'weatherHumidity')}
              windLabel={t('home', 'weatherWind')}
              celsiusLabel={t('home', 'weatherCelsius')}
              fahrenheitLabel={t('home', 'weatherFahrenheit')}
              t={t}
            />
            </div>
          </div>
          <p className="vd-plan-text">{t('home', 'planText')}</p>
          {showMap && (
            <div className="vd-plan-ctas">
              <Link to="/map" className="vd-btn vd-btn--primary">
                {t('home', 'viewMapCta')}
                <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Slim utility bar – Map, Plan, accessibility */}
      <div className="vd-utility-bar">
        <div className="vd-container vd-utility-inner">
          {showMap && (
            <Link to="/map" className="vd-utility-link">
              <Icon name="location_on" className="vd-utility-icon" size={20} />
              {t('home', 'map')}
            </Link>
          )}
          <a href="#plan" className="vd-utility-link">
            <Icon name="schedule" className="vd-utility-icon" size={20} />
            {t('home', 'planTitle')}
          </a>
          <a href="#experience" className="vd-utility-link vd-utility-a11y" aria-label={t('home', 'accessibility')}>
            <Icon name="accessibility" className="vd-utility-icon" size={20} />
            {t('home', 'accessibility')}
          </a>
        </div>
      </div>

      <footer className="vd-footer">
        <div className="vd-container vd-footer-inner">
          <div className="vd-footer-brand">
            <Link to="/" className="vd-footer-logo">{settings.siteName?.trim() || t('nav', 'visitTripoli')}</Link>
            <span className="vd-footer-tagline">{resolveFooterTagline(settings, t)}</span>
          </div>
          {(settings.contactEmail || settings.contactPhone) && (
            <p className="vd-footer-contact-line">
              {settings.contactEmail?.trim() && (
                <a href={`mailto:${settings.contactEmail.trim()}`}>{settings.contactEmail.trim()}</a>
              )}
              {settings.contactEmail?.trim() && settings.contactPhone?.trim() && ' · '}
              {settings.contactPhone?.trim() && <span>{settings.contactPhone.trim()}</span>}
            </p>
          )}
          {(settings.socialFacebook?.trim() || settings.socialInstagram?.trim() || settings.socialTwitterX?.trim()) && (
            <div className="vd-footer-social">
              {settings.socialFacebook?.trim() && (
                <a href={settings.socialFacebook.trim()} target="_blank" rel="noopener noreferrer">
                  Facebook
                </a>
              )}
              {settings.socialInstagram?.trim() && (
                <a href={settings.socialInstagram.trim()} target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
              )}
              {settings.socialTwitterX?.trim() && (
                <a href={settings.socialTwitterX.trim()} target="_blank" rel="noopener noreferrer">
                  X
                </a>
              )}
            </div>
          )}
          <div className="vd-footer-links">
            {showMap && <Link to="/map">{t('home', 'map')}</Link>}
            <Link to={COMMUNITY_PATH}>{t('nav', 'discoverTripoli')}</Link>
            <Link to="/login">{t('nav', 'signIn')}</Link>
            <Link to="/register">{t('nav', 'signUp')}</Link>
            {settings.supportUrl?.trim() && (
              <a href={settings.supportUrl.trim()} target="_blank" rel="noopener noreferrer">
                {t('home', 'contactUs')}
              </a>
            )}
          </div>
          <p className="vd-footer-copy">
            © {new Date().getFullYear()} {settings.siteName?.trim() || t('nav', 'visitTripoli')}. {t('home', 'copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
}
