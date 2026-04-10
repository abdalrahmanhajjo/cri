import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import Icon from '../components/Icon';
import {
  WAYS_CONFIG,
  groupPlacesByWay,
  FIND_YOUR_WAY_WAY_KEYS,
  formatFindYourWayThemeTitle,
} from '../utils/findYourWayGrouping';
import { COMMUNITY_PATH, DINING_PATH, HOTELS_PATH } from '../utils/discoverPaths';
import { filterGeneralDirectoryPlaces } from '../utils/placeGuideExclusions';
import './Explore.css';

function PlaceCard({ place }) {
  if (!place || place.id == null) return null;
  const placeId = String(place.id);
  const safeImg = getPlaceImageUrl(place.image || (Array.isArray(place.images) && place.images[0])) || null;
  const name = place.name != null ? String(place.name) : '';
  const location = place.location != null ? String(place.location) : '';
  const rating = place.rating != null ? Number(place.rating) : null;
  const validRating = rating != null && !Number.isNaN(rating);
  return (
    <Link to={`/place/${placeId}`} className="vd-card vd-card--place">
      <div className="vd-card-media">
        {safeImg ? (
          <DeliveryImg url={safeImg} preset="gridCard" alt="" />
        ) : (
          <span className="vd-card-fallback">Place</span>
        )}
        <div className="vd-card-overlay">
          <h3 className="vd-card-title">{name || 'Place'}</h3>
          {location && <p className="vd-card-meta">{location}</p>}
        </div>
        {validRating && (
          <span className="vd-card-badge vd-card-rating"><Icon name="star" size={16} /> {rating.toFixed(1)}</span>
        )}
      </div>
    </Link>
  );
}

export default function FindYourWay() {
  const { t, lang } = useLanguage();
  const location = useLocation();
  const safeT = (ns, key) => (t && typeof t === 'function' ? t(ns, key) : key);
  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const hash = (location.hash || '').replace(/^#/, '');
    if (hash && FIND_YOUR_WAY_WAY_KEYS.includes(hash)) {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, loading]);

  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  useEffect(() => {
    Promise.all([
      api.places.list({ lang: langParam }).then((r) => r.popular || r.locations || []),
      api.categories.list({ lang: langParam }).then((r) => r.categories || []),
    ])
      .then(([p, c]) => {
        const rawP = Array.isArray(p) ? p : [];
        const rawC = Array.isArray(c) ? c : [];
        setPlaces(filterGeneralDirectoryPlaces(rawP, rawC));
        setCategories(rawC);
      })
      .catch((err) => setError(String(err?.message ?? err ?? 'Failed to load')))
      .finally(() => setLoading(false));
  }, [langParam]);

  const placesByWay = groupPlacesByWay(places, categories);

  if (loading) {
    return (
      <div className="vd vd-page-find-your-way" role="document">
        <div className="vd-ways-loading" aria-live="polite" aria-busy="true">
          <div className="vd-loading-spinner" aria-hidden="true" />
          <span className="vd-ways-loading-text">{safeT('home', 'loading')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vd vd-page-find-your-way" role="document">
        <div className="vd-container vd-ways-error-wrap">
          <div className="vd-error" role="alert">{error}</div>
          <p className="vd-ways-error-cta">
            <Link to="/" className="vd-btn vd-btn--secondary">{safeT('home', 'viewMap')} <Icon name="arrow_forward" size={20} /></Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="vd vd-page-find-your-way" role="document">
      <header className="vd-ways-hero">
        <div className="vd-container vd-ways-hero-inner">
          <h1 className="vd-ways-hero-title">{safeT('home', 'findYourWayTitle')}</h1>
          <p className="vd-ways-hero-sub">{safeT('home', 'findYourWaySub')}</p>
          <p className="vd-find-your-way-community">
            <Link to={COMMUNITY_PATH} className="vd-find-your-way-community-link">
              {safeT('home', 'findYourWayCommunityHint')}
              <Icon name="arrow_forward" size={18} aria-hidden />
            </Link>
          </p>
        </div>
      </header>
      <div className="vd-container vd-ways-detail">
        <nav className="vd-ways-jump" aria-label={safeT('home', 'waysInThisPage')}>
          <ul className="vd-ways-jump-list">
            {WAYS_CONFIG.map((way) => {
              const count = (placesByWay.get(way.wayKey) || []).length;
              const jumpTitle =
                formatFindYourWayThemeTitle(way.wayKey, categories, lang, (n) =>
                  safeT('home', 'findYourWayThemeMore').split('{count}').join(String(n))
                ) || safeT('home', way.titleKey);
              return (
                <li key={way.wayKey}>
                  <a href={`#${way.wayKey}`} className="vd-ways-jump-link">
                    <Icon name={way.icon} size={20} aria-hidden />
                    <span>{jumpTitle}</span>
                    {count > 0 && <span className="vd-ways-jump-count" aria-label={`${count} places`}>{count}</span>}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="vd-ways-main" id="ways-main">
          {WAYS_CONFIG.map((way) => {
            const wayPlaces = placesByWay.get(way.wayKey) || [];
            const headingId = `way-heading-${way.wayKey}`;
            const sectionTitle =
              formatFindYourWayThemeTitle(way.wayKey, categories, lang, (n) =>
                safeT('home', 'findYourWayThemeMore').split('{count}').join(String(n))
              ) || safeT('home', way.titleKey);
            return (
              <section
                key={way.wayKey}
                id={way.wayKey}
                className="vd-section vd-ways-section"
                aria-labelledby={headingId}
              >
                <header className="vd-ways-section-header">
                  <span className="vd-ways-section-icon" aria-hidden="true">
                    <Icon name={way.icon} size={28} />
                  </span>
                  <h2 id={headingId} className="vd-ways-section-title">
                    {sectionTitle}
                    {wayPlaces.length > 0 && (
                      <span className="vd-ways-section-count"> ({wayPlaces.length})</span>
                    )}
                  </h2>
                  <p className="vd-ways-section-desc">{safeT('home', way.descKey)}</p>
                </header>
                {wayPlaces.length > 0 ? (
                  <div className="vd-grid vd-grid--4 vd-ways-grid">
                    {wayPlaces.map((p) => (
                      <PlaceCard key={p.id} place={p} />
                    ))}
                  </div>
                ) : way.wayKey === 'food' || way.wayKey === 'stay' ? (
                  <p className="vd-ways-empty vd-ways-empty--guide">
                    <Link to={way.wayKey === 'food' ? DINING_PATH : HOTELS_PATH} className="vd-btn vd-btn--secondary">
                      {way.wayKey === 'food' ? safeT('nav', 'diningNav') : safeT('nav', 'hotelsNav')}
                      <Icon name="arrow_forward" size={20} />
                    </Link>
                  </p>
                ) : (
                  <p className="vd-ways-empty">{safeT('home', 'noSpots')}</p>
                )}
              </section>
            );
          })}
        </main>
      </div>
    </div>
  );
}
