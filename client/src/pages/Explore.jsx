import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import { getPlaceImageUrl } from '../api/client';
import { trackEvent } from '../utils/analytics';
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
          <span className="vd-widget-icon" aria-hidden="true" title="ساعة التل">
            <img src="/tripoli-clock-tower.svg" alt="" width="48" height="64" className="vd-tripoli-clock-tower-img" />
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

const TRIPOLI_LAT = 34.4367;
const TRIPOLI_LON = 35.8497;
const OPEN_METEO_URL = `https://api.open-meteo.com/v1/forecast?latitude=${TRIPOLI_LAT}&longitude=${TRIPOLI_LON}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min&timezone=Asia/Beirut`;

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
    fetch(OPEN_METEO_URL)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => { if (!cancelled) setError(String(err?.message ?? err ?? 'Failed to load')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
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
      <div
        className="vd-card-media"
        style={{ backgroundImage: safeImgUrl ? `url(${safeImgUrl})` : undefined }}
      >
        {!safeImgUrl && <span className="vd-card-fallback">Place</span>}
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
            {safePlaces.map((p) => {
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
              return (
                <Link
                  key={placeId}
                  to={`/place/${placeId}`}
                  className="vd-top-picks-card"
                >
                  <div
                    className="vd-top-picks-card-bg"
                    style={{ backgroundImage: safeImg ? `url(${safeImg})` : undefined }}
                  >
                    {!safeImg && <span className="vd-top-picks-fallback">Place</span>}
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
                    <div className="vd-top-picks-cta-row" onClick={(e) => e.preventDefault()}>
                      <span className="vd-top-picks-read-now">{t('home', 'readNow')} <Icon name="arrow_forward" size={18} /></span>
                      <button
                        type="button"
                        className={`vd-top-picks-action-btn vd-top-picks-action-btn--heart ${isFavourite ? 'vd-top-picks-action-btn--active' : ''}`}
                        aria-label={heartAria}
                        onClick={(e) => toggleFavourite(e, p.id)}
                      >
                        <Icon name={isFavourite ? 'favorite' : 'favorite_border'} size={22} />
                      </button>
                    </div>
                    <button type="button" className="vd-top-picks-scroll-top" aria-label="Scroll to top" onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Icon name="arrow_upward" size={22} /></button>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="vd-top-picks-dots" aria-hidden="true">
            {safePlaces.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`vd-top-picks-dot ${i === index ? 'vd-top-picks-dot--active' : ''}`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex(i); }}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ExperienceTripoliSection({ t, basePath }) {
  const safeT = (ns, key) => (t && typeof t === 'function' ? t(ns, key) : key);
  const ways = [
    { wayKey: 'explorer', titleKey: 'wayExplorer', descKey: 'wayExplorerDesc', icon: 'explore', size: 'large' },
    { wayKey: 'food', titleKey: 'wayFood', descKey: 'wayFoodDesc', icon: 'restaurant', size: 'small' },
    { wayKey: 'history', titleKey: 'wayHistory', descKey: 'wayHistoryDesc', icon: 'account_balance', size: 'small' },
    { wayKey: 'sea', titleKey: 'waySea', descKey: 'waySeaDesc', icon: 'waves', size: 'small' },
    { wayKey: 'family', titleKey: 'wayFamily', descKey: 'wayFamilyDesc', icon: 'family_restroom', size: 'small' },
  ];
  const getCardTo = (way) => (basePath ? `${basePath}#${way.wayKey}` : '/#experience');
  return (
    <section id="experience" className="vd-section vd-experience-tripoli vd-find-your-way">
      <div className="vd-container">
        <header className="vd-find-your-way-header">
          <h2 className="vd-find-your-way-title">{safeT('home', 'findYourWayTitle')}</h2>
          <p className="vd-find-your-way-sub">{safeT('home', 'findYourWaySub')}</p>
        </header>
        <div className="vd-find-your-way-bento">
          {ways.map((way) => (
            <Link
              key={way.wayKey}
              to={getCardTo(way)}
              className={`vd-find-your-way-card vd-find-your-way-card--${way.size}`}
            >
              <span className="vd-find-your-way-icon" aria-hidden="true">
                <Icon name={way.icon} size={way.size === 'large' ? 32 : 24} />
              </span>
              <h3 className="vd-find-your-way-card-title">{safeT('home', way.titleKey)}</h3>
              <p className="vd-find-your-way-card-desc">{safeT('home', way.descKey)}</p>
              <span className="vd-find-your-way-arrow" aria-hidden="true">
                <Icon name="arrow_forward" size={20} />
              </span>
            </Link>
          ))}
        </div>
        <div className="vd-find-your-way-cta-wrap">
          <Link to="/ways" className="vd-find-your-way-cta">
            {safeT('home', 'seeAllWays')}
            <Icon name="arrow_forward" size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}

const WHY_CARD_COUNT = 6;
const WHY_AUTO_SWIPE_MS = 5000;

export default function Explore() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [whyIndex, setWhyIndex] = useState(0);
  const whyScrollRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      setWhyIndex((i) => (i + 1) % WHY_CARD_COUNT);
    }, WHY_AUTO_SWIPE_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = whyScrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const safeWhyIndex = Math.max(0, Math.min(whyIndex, WHY_CARD_COUNT - 1));
    const child = el.children[safeWhyIndex];
    if (!child) return;
    const isTouchOrNarrow = window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 768px)').matches;
    if (isTouchOrNarrow) {
      el.scrollLeft = child.offsetLeft;
    } else {
      child.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  }, [whyIndex]);

  useEffect(() => {
    const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
    Promise.all([
      api.places.list({ lang: langParam }).then((r) => r.popular || r.locations || []),
      api.categories.list({ lang: langParam }).then((r) => r.categories || []),
    ])
      .then(([p, c]) => {
        setPlaces(Array.isArray(p) ? p : []);
        setCategories(Array.isArray(c) ? c : []);
      })
      .catch((err) => setError(String(err?.message ?? err ?? 'Failed to load')))
      .finally(() => setLoading(false));
  }, [lang]);

  useEffect(() => {
    if (loading || error) return;
    const hash = window.location.hash;
    const allowedHashes = ['#plan', '#experience', '#why', '#plan-trip', '#download-app'];
    if (hash && allowedHashes.includes(hash)) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, error]);

  useEffect(() => {
    trackEvent(user, 'page_view', { page: 'home' });
  }, [user]);

  if (loading) {
    return (
      <div className="vd">
        <section className="vd-hero">
          <h1 className="vd-hero-title">{t('home', 'heroTitle')}</h1>
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
      <div className="vd">
        <section className="vd-hero">
          <h1 className="vd-hero-title">{t('home', 'heroTitle')}</h1>
        </section>
        <div className="vd-error">{error}</div>
      </div>
    );
  }

  const placesList = Array.isArray(places) ? places : [];
  const topPicks = placesList.slice().sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0)).slice(0, 6);

  return (
    <div className="vd">
      {/* Hero + app download – single section */}
      <section id="download-app" className="vd-hero vd-hero--unified">
        <div className="vd-hero-bg" />
        <div className="vd-hero-unified-inner">
          <div className="vd-hero-content">
            <h1 className="vd-hero-title">{t('home', 'heroTitle')}</h1>
            <p className="vd-hero-tagline">{t('home', 'heroTagline')}</p>
            <div className="vd-hero-ctas">
              <Link to="/plan" className="vd-btn vd-btn--primary">
                {t('home', 'webTripPlannerCta')}
                <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />
              </Link>
            </div>
          </div>
          <div className="vd-hero-app-block">
            <div className="vd-download-app-content">
              <h2 className="vd-download-app-title">{t('home', 'downloadAppTitle')}</h2>
              <p className="vd-download-app-sub">{t('home', 'downloadAppSub')}</p>
              <div className="vd-download-app-badges">
                <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer" className="vd-download-app-badge vd-download-app-badge--apple" aria-label={t('home', 'getOnAppStore')}>
                  <Icon name="phone_iphone" size={28} />
                  <span>{t('home', 'getOnAppStore')}</span>
                </a>
                <a href="https://play.google.com" target="_blank" rel="noopener noreferrer" className="vd-download-app-badge vd-download-app-badge--google" aria-label={t('home', 'getOnGooglePlay')}>
                  <Icon name="android" size={24} />
                  <span>{t('home', 'getOnGooglePlay')}</span>
                </a>
              </div>
            </div>
            <div className="vd-download-app-phone" aria-hidden="true">
              <div className="vd-download-app-phone-mock">
                <span className="vd-download-app-phone-screen" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Visit Tripoli – reference layout: title, swipeable cards (icon, title, desc, arrow), dots, CTA */}
      <section id="why" className="vd-section vd-why">
        <div className="vd-container">
          <header className="vd-why-header vd-why-header--layout">
            <h2 className="vd-why-title vd-why-title--layout">{t('home', 'whyVisitTitle')}</h2>
            <p className="vd-why-subtitle">{t('home', 'whyVisitSub')}</p>
          </header>
          <div className="vd-highlights" ref={whyScrollRef} aria-label="Why Visit Tripoli reasons">
            {[
              { icon: 'account_balance', titleKey: 'whyCulture', descKey: 'whyCultureDesc', to: '/experiences' },
              { icon: 'restaurant', titleKey: 'whyFood', descKey: 'whyFoodDesc', to: '/spots' },
              { icon: 'waves', titleKey: 'whyCoast', descKey: 'whyCoastDesc', to: '/spots' },
              { icon: 'favorite', titleKey: 'whyHospitality', descKey: 'whyHospitalityDesc', to: '/ways' },
              { icon: 'store', titleKey: 'whyShopping', descKey: 'whyShoppingDesc', to: '/spots' },
              { icon: 'celebration', titleKey: 'whyEvents', descKey: 'whyEventsDesc', to: '/events' },
            ].map((item, i) => (
              <Link
                key={item.titleKey}
                to={item.to}
                className={`vd-highlight-card vd-highlight-card--${i % 2 === 0 ? 'primary' : 'light'}`}
              >
                <div className="vd-highlight-icon-wrap vd-highlight-icon-wrap--circle">
                  <Icon name={item.icon} className="vd-highlight-icon" size={24} />
                </div>
                <h3 className="vd-highlight-title">{t('home', item.titleKey)}</h3>
                <p className="vd-highlight-desc">{t('home', item.descKey)}</p>
                <span className="vd-highlight-arrow" aria-hidden="true">
                  <Icon name="arrow_forward" size={20} />
                </span>
              </Link>
            ))}
          </div>
          <div className="vd-why-footer">
            <div className="vd-why-dots" aria-hidden="true">
              {Array.from({ length: WHY_CARD_COUNT }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`vd-why-dot ${i === whyIndex ? 'vd-why-dot--active' : ''}`}
onClick={() => setWhyIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
            <Link to="/#experience" className="vd-btn vd-btn--primary vd-why-cta">
              {t('home', 'viewAllServices')}
              <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* Top picks – one card at a time, name + description + details, auto-swipe every 10s */}
      {topPicks.length > 0 && (
        <TopPicksCarousel places={topPicks} t={t} />
      )}

      {/* Experience Tripoli – visitor type pills + 2x3 grid + Curate button (reference design) */}
      <ExperienceTripoliSection t={t} basePath="/ways" />

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
              <Link to="/map" className="vd-plan-trip-cta vd-btn vd-btn--primary">
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
          <div className="vd-plan-ctas">
            <Link to="/map" className="vd-btn vd-btn--primary">
              {t('home', 'viewMapCta')}
              <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* Slim utility bar – Map, Plan, accessibility */}
      <div className="vd-utility-bar">
        <div className="vd-container vd-utility-inner">
          <Link to="/map" className="vd-utility-link">
            <Icon name="location_on" className="vd-utility-icon" size={20} />
            {t('home', 'map')}
          </Link>
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
            <Link to="/" className="vd-footer-logo">{t('nav', 'visitTripoli')}</Link>
            <span className="vd-footer-tagline">{t('nav', 'tripoliLebanon')}</span>
          </div>
          <div className="vd-footer-links">
            <Link to="/map">{t('home', 'map')}</Link>
            <Link to="/#experience">{t('nav', 'discoverTripoli')}</Link>
            <Link to="/login">{t('nav', 'signIn')}</Link>
            <Link to="/register">{t('nav', 'signUp')}</Link>
          </div>
          <p className="vd-footer-copy">© {new Date().getFullYear()} {t('nav', 'visitTripoli')}. {t('home', 'copyright')}</p>
        </div>
      </footer>
    </div>
  );
}
