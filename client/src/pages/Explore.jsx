import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import Icon from '../components/Icon';
import { CommunityFeedStrip } from '../components/CommunityFeed';
import { trackEvent } from '../utils/analytics';
import { homeBentoDefaults, resolveHomeBentoVisuals, resolveBentoAvatarSlots, bentoCssUrl } from '../config/homeBentoVisuals';
import { getBentoHeroImgProps, getBentoHeroPreloadHref, normalizePreloadImageHref } from '../utils/bentoHeroImage';
import { resolveHeroTagline, resolveFooterTagline } from '../config/resolveSiteTagline';
import { COMMUNITY_PATH, PLACES_DISCOVER_PATH } from '../utils/discoverPaths';
import { getApiOrigin } from '../utils/apiOrigin';
import { WAYS_CONFIG, groupPlacesByWay, countDirectoryCategoriesForWay } from '../utils/findYourWayGrouping';
import './Explore.css';

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

function TopPicksCarousel({ places, t }) {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const [favouriteIds, setFavouriteIds] = useState(new Set());
  useEffect(() => {
    if (!user) {
      setFavouriteIds(new Set());
      return;
    }
    api.user.favourites()
      .then((res) => setFavouriteIds(new Set((Array.isArray(res.placeIds) ? res.placeIds : []).map(String))))
      .catch(() => setFavouriteIds(new Set()));
  }, [user]);

  const toggleFavourite = useCallback((e, placeId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: 'favourite' } });
      return;
    }
    const id = placeId != null ? String(placeId) : '';
    if (!id) return;
    const isFav = favouriteIds.has(id);
    const next = new Set(favouriteIds);
    if (isFav) {
      api.user.removeFavourite(id).catch(() => {});
      next.delete(id);
    } else {
      api.user.addFavourite(id).catch(() => {});
      next.add(id);
    }
    setFavouriteIds(next);
  }, [user, favouriteIds, navigate]);

  return (
    <section className="vd-section vd-top-picks">
      <div className="vd-container">
        <header className="vd-top-picks-header">
          <h2 className="vd-top-picks-title">{t('home', 'topPicks')}</h2>
          <p className="vd-top-picks-subtitle">{t('home', 'topPicksSub')}</p>
        </header>
        <div className="vd-top-picks-carousel">
          <div
            className="vd-top-picks-track"
            style={{ transform: `translateX(-${index * 100}%)`, direction: 'ltr' }}
          >
            {safePlaces.map((p, slideIndex) => {
              if (!p || p.id == null) return null;
              const placeId = String(p.id);
              const safeImg = getPlaceImageUrl(p.image || (p.images && p.images[0])) || null;
              const name = p.name != null ? String(p.name) : '';
              const desc = p.description != null ? String(p.description) : '';
              const loc = p.location != null ? String(p.location) : '';
              const cat = p.categoryName != null ? String(p.categoryName) : '';
              const ratingNum = Number(p.rating);
              const rating = Number.isFinite(ratingNum) ? ratingNum : null;
              const isFavourite = favouriteIds.has(String(p.id));
              const heartAria = user
                ? (isFavourite ? t('home', 'removeFromFavourites') : t('home', 'addToFavourites'))
                : t('home', 'signInToSave');
              const placeCardLabel = `${name}. ${t('home', 'readNow')}`;
              return (
                <article key={placeId} className="vd-top-picks-card vd-top-picks-card--split-hit">
                  <Link
                    to={`/place/${placeId}`}
                    className="vd-top-picks-card-hit"
                    style={{ display: 'contents' }}
                    aria-label={placeCardLabel}
                  >
                    <div className="vd-top-picks-card-bg">
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
                    </div>
                    <div className="vd-top-picks-card-overlay">
                      <span className="vd-top-picks-eyebrow">{t('home', 'topPickEyebrow')}</span>
                      <h3 className="vd-top-picks-name">{name}</h3>
                      {desc && (
                        <p className="vd-top-picks-desc">{desc}</p>
                      )}
                      <div className="vd-top-picks-details">
                        {rating != null && (
                          <span className="vd-top-picks-detail">
                            <Icon name="star" size={18} /> {rating.toFixed(1)}
                          </span>
                        )}
                        {loc && (
                          <span className="vd-top-picks-detail">
                            <Icon name="location_on" size={18} /> {loc}
                          </span>
                        )}
                        {cat && (
                          <span className="vd-top-picks-detail">{cat}</span>
                        )}
                      </div>
                      <div className="vd-top-picks-cta-row">
                        <span className="vd-top-picks-read-now">
                          {t('home', 'readNow')} <Icon name="arrow_forward" size={18} />
                        </span>
                      </div>
                    </div>
                  </Link>
                  <div className="vd-top-picks-card-floating-actions">
                    <button
                      type="button"
                      className={`vd-top-picks-action-btn vd-top-picks-action-btn--heart ${isFavourite ? 'vd-top-picks-action-btn--active' : ''}`}
                      aria-label={heartAria}
                      onClick={(e) => toggleFavourite(e, p.id)}
                    >
                      <Icon name={isFavourite ? 'favorite' : 'favorite_border'} size={22} />
                    </button>
                    <button
                      type="button"
                      className="vd-top-picks-scroll-top"
                      aria-label={t('home', 'scrollToTop')}
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    >
                      <Icon name="arrow_upward" size={22} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="vd-top-picks-dots" role="group" aria-label={t('home', 'topPicksCarouselLabel')}>
            {safePlaces.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`vd-top-picks-dot ${i === index ? 'vd-top-picks-dot--active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIndex(i);
                }}
                aria-label={`${t('home', 'topPicks')} — ${i + 1} / ${safePlaces.length}`}
                aria-current={i === index ? 'true' : undefined}
              />
            ))}
          </div>
        </div>
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

/** Home “Find your way” — themes + indirect category framing (no named places). */
export function ExperienceTripoliSection({ t, lang, places = [], categories = [] }) {
  const safeT = (ns, key) => (t && typeof t === 'function' ? t(ns, key) : key);
  const placesByWay = groupPlacesByWay(places, categories);
  const stepClass = ['vd-find-your-way-row--a', 'vd-find-your-way-row--b', 'vd-find-your-way-row--c', 'vd-find-your-way-row--d'];
  return (
    <section id="experience" className="vd-section vd-experience-tripoli vd-find-your-way vd-find-your-way--deck">
      <div className="vd-container">
        <header className="vd-find-your-way-header">
          <h2 className="vd-find-your-way-title">{safeT('home', 'findYourWayTitle')}</h2>
          <p className="vd-find-your-way-sub">{safeT('home', 'findYourWaySub')}</p>
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
            return (
              <Link
                key={way.wayKey}
                to={PLACES_DISCOVER_PATH}
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
                  <h3 className="vd-find-your-way-row-title">{safeT('home', way.titleKey)}</h3>
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
          <Link to={PLACES_DISCOVER_PATH} className="vd-find-your-way-cta">
            {safeT('home', 'seeAllWays')}
            <Icon name="arrow_forward" size={20} />
          </Link>
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
  const [loadNonce, setLoadNonce] = useState(0);

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
    const allowedHashes = ['#plan', '#experience', '#why', '#plan-trip', '#download-app', '#community'];
    if (hash && allowedHashes.includes(hash)) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, error]);

  useEffect(() => {
    trackEvent(user, 'page_view', { page: 'home' });
  }, [user]);

  useEffect(() => {
    const d = settings.metaDescription?.trim();
    if (!d) return;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', d);
  }, [settings.metaDescription]);

  const bentoHeroUrl = useMemo(() => resolveHomeBentoVisuals(settings).hero, [settings]);

  useEffect(() => {
    const id = 'tripoli-preload-bento-hero';
    const heroTrim = (bentoHeroUrl || '').trim();
    const defaultHero = (homeBentoDefaults.hero || '').trim();
    /* index.html preloads default /city.png; skip JS tag to avoid duplicate requests */
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

  const heroTitle = settings.siteName?.trim() || t('home', 'heroTitle');
  const heroTagline = resolveHeroTagline(settings, t);
  const appStoreHref = settings.appStoreUrl?.trim() || 'https://apps.apple.com';
  const playStoreHref = settings.playStoreUrl?.trim() || 'https://play.google.com';
  const showMap = settings.showMap !== false;

  const placesList = Array.isArray(places) ? places : [];
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

  const placeCountStr = formatDirectoryCount(placesList.length, lang);
  const categoryCountStr = formatDirectoryCount(categoryCount, lang);
  const topPicks = placesList.slice().sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0)).slice(0, 6);
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
                <img
                  className="vd-bento-hero-main-photo"
                  alt=""
                  draggable={false}
                  {...getBentoHeroImgProps(bentoV.hero)}
                />
                <div className="vd-bento-hero-main-scrim" aria-hidden="true" />
                <div className="vd-bento-hero-main-content">
                  <h1 className="vd-bento-hero-title">{heroTitle}</h1>
                  <p className="vd-bento-hero-tagline">{heroTagline}</p>
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
                            style={slot.href ? { backgroundImage: bentoCssUrl(slot.href) } : undefined}
                          >
                            {!slot.href && <Icon name="travel_explore" size={22} aria-hidden />}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="vd-bento-card vd-bento-why-intro">
                <h2 className="vd-bento-why-intro-title">{t('home', 'whyVisitTitle')}</h2>
                <p className="vd-bento-why-intro-sub">{t('home', 'whyVisitSub')}</p>
                <div className="vd-bento-why-intro-footer">
                  <Link to={PLACES_DISCOVER_PATH} className="vd-bento-why-intro-link">
                    <span>{t('home', 'seeAllWays')}</span>
                    <Icon name="arrow_forward" size={20} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>

            <Link
              to="/plan"
              className="vd-bento-card vd-bento-hero-side vd-bento-web-hub"
            >
              <div className="vd-bento-web-hub-inner">
                <p className="vd-bento-web-hub-kicker">{t('home', 'useWebCta')}</p>
                <div className="vd-bento-web-hub-header">
                  <div className="vd-bento-web-hub-icon" aria-hidden="true">
                    <Icon name="map" size={26} />
                  </div>
                  <div className="vd-bento-web-hub-titles">
                    <p className="vd-bento-web-hub-name">{t('home', 'bentoWebHubTitle')}</p>
                    <p className="vd-bento-web-hub-sub">{t('home', 'bentoWebHubSub')}</p>
                    <p className="vd-bento-web-hub-footnote">{t('home', 'bentoWebHubFootnote')}</p>
                  </div>
                </div>
                <span className="vd-bento-web-hub-cta">
                  <span className="vd-bento-web-hub-cta-label">{t('home', 'bentoWebHubCta')}</span>
                  <Icon name="arrow_forward" size={20} aria-hidden="true" />
                </span>
              </div>
            </Link>

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
                    <p className="vd-bento-panel-lead vd-bento-panel-lead--desktop">{t('home', 'bentoSiteGuideLead')}</p>
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

      {/* Highlights — curated picks before thematic browsing (DMO-style flow) */}
      {topPicks.length > 0 && (
        <TopPicksCarousel places={topPicks} t={t} />
      )}

      <ExperienceTripoliSection t={t} lang={lang} places={placesList} categories={categories} />

      {communityPosts.length > 0 && (
        <CommunityFeedStrip posts={communityPosts} t={t} moreTo={COMMUNITY_PATH} layout="bento" />
      )}

      {/* Plan your trip – one section: areas, getting there, stay, tips */}
      <section id="plan-trip" className="vd-section vd-plan-trip-one">
        <div className="vd-container">
          <header className="vd-plan-trip-header">
            <h2 className="vd-plan-trip-section-title">{t('home', 'planTitle')}</h2>
            <p className="vd-plan-trip-section-sub">{t('home', 'planTripSectionSub')}</p>
          </header>
          <div className="vd-plan-trip-grid">
            <div className="vd-plan-trip-block">
              <h3 className="vd-plan-trip-block-title">{t('home', 'areasTitle')}</h3>
              <p className="vd-plan-trip-block-desc">{t('home', 'areasSub')}</p>
              <div className="vd-plan-trip-areas">
                <div className="vd-plan-trip-area">
                  <span className="vd-plan-trip-area-name">{t('home', 'areaOldCity')}</span>
                  <span className="vd-plan-trip-area-desc">{t('home', 'areaOldCityDesc')}</span>
                </div>
                <div className="vd-plan-trip-area">
                  <span className="vd-plan-trip-area-name">{t('home', 'areaMina')}</span>
                  <span className="vd-plan-trip-area-desc">{t('home', 'areaMinaDesc')}</span>
                </div>
                <div className="vd-plan-trip-area">
                  <span className="vd-plan-trip-area-name">{t('home', 'areaTel')}</span>
                  <span className="vd-plan-trip-area-desc">{t('home', 'areaTelDesc')}</span>
                </div>
              </div>
            </div>
            <div className="vd-plan-trip-block">
              <h3 className="vd-plan-trip-block-title">{t('home', 'gettingThereTitle')}</h3>
              <p className="vd-plan-trip-block-desc">{t('home', 'gettingThereSub')}</p>
              <Link to="/#plan" className="vd-plan-trip-cta vd-btn vd-btn--primary">
                {t('home', 'gettingThereCta')}
                <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />
              </Link>
            </div>
            <div className="vd-plan-trip-block">
              <h3 className="vd-plan-trip-block-title">{t('home', 'stayTitle')}</h3>
              <p className="vd-plan-trip-block-desc">{t('home', 'staySub')}</p>
              <Link to={showMap ? '/map' : '/plan'} className="vd-plan-trip-cta vd-btn vd-btn--primary">
                {t('home', 'stayCta')}
                <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />
              </Link>
            </div>
            {user?.showTips !== false && (
              <div className="vd-plan-trip-block">
                <h3 className="vd-plan-trip-block-title">{t('home', 'tipsTitle')}</h3>
                <p className="vd-plan-trip-block-desc">{t('home', 'tipsSub')}</p>
                <a href="#plan" className="vd-plan-trip-link vd-link-arrow">{t('home', 'tipsCta')} <Icon name="arrow_forward" size={18} /></a>
              </div>
            )}
          </div>
        </div>
      </section>

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
