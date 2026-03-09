import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/client';
import Icon from '../components/Icon';
import { getPlaceImageUrl } from '../api/client';
import './Explore.css';

/* Section names and keywords aligned for a clear divide; keywords are non-overlapping so each category maps to one section. */
const WAYS_CONFIG = [
  { wayKey: 'explorer', titleKey: 'wayExplorer', descKey: 'wayExplorerDesc', icon: 'explore', keywords: ['attraction', 'landmark', 'souq', 'souk', 'market', 'explore', 'sightseeing', 'old city', 'shopping', 'bazaar'] },
  { wayKey: 'food', titleKey: 'wayFood', descKey: 'wayFoodDesc', icon: 'restaurant', keywords: ['restaurant', 'food', 'cafe', 'café', 'dining', 'cuisine', 'sweet', 'sweets', 'bakery', 'coffee', 'eat', 'meal'] },
  { wayKey: 'history', titleKey: 'wayHistory', descKey: 'wayHistoryDesc', icon: 'account_balance', keywords: ['history', 'heritage', 'culture', 'citadel', 'mosque', 'museum', 'historic', 'monument', 'religious', 'archaeology'] },
  { wayKey: 'sea', titleKey: 'waySea', descKey: 'waySeaDesc', icon: 'waves', keywords: ['beach', 'sea', 'coast', 'corniche', 'nature', 'mina', 'water', 'port', 'marina', 'outdoors'] },
  { wayKey: 'family', titleKey: 'wayFamily', descKey: 'wayFamilyDesc', icon: 'family_restroom', keywords: ['family', 'park', 'kids', 'children', 'relax', 'garden', 'playground'] },
];

/** Map a category (name + tags) to a way key using keyword match. */
function matchCategoryToWay(categoryName, categoryTags) {
  const name = (categoryName || '').toLowerCase();
  const tagStr = Array.isArray(categoryTags) ? categoryTags.join(' ').toLowerCase() : '';
  const combined = `${name} ${tagStr}`;
  for (const way of WAYS_CONFIG) {
    for (const kw of way.keywords) {
      if (combined.includes(kw.toLowerCase())) return way.wayKey;
    }
  }
  return 'explorer';
}

/** Group places into sections by their real category (each place in the section that matches its category). */
function groupPlacesByWay(places, categories) {
  const categoryToWay = new Map();
  (categories || []).forEach((c) => {
    const wayKey = matchCategoryToWay(c.name, c.tags);
    categoryToWay.set(c.id, wayKey);
  });
  const byWay = new Map();
  WAYS_CONFIG.forEach((w) => byWay.set(w.wayKey, []));
  (places || []).forEach((p) => {
    const catId = p.categoryId ?? p.category_id;
    let wayKey = catId ? categoryToWay.get(catId) : null;
    if (!wayKey && (p.categoryName != null || p.category != null)) {
      const name = String(p.categoryName ?? p.category ?? '');
      wayKey = matchCategoryToWay(name, []);
    }
    wayKey = wayKey || 'explorer';
    const list = byWay.get(wayKey);
    if (list) list.push(p);
  });
  byWay.forEach((list) => list.sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0)));
  return byWay;
}

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
      <div className="vd-card-media" style={{ backgroundImage: safeImg ? `url(${safeImg})` : undefined }}>
        {!safeImg && <span className="vd-card-fallback">Place</span>}
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

const WAY_IDS = WAYS_CONFIG.map((w) => w.wayKey);

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
    if (hash && WAY_IDS.includes(hash)) {
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
        setPlaces(Array.isArray(p) ? p : []);
        setCategories(Array.isArray(c) ? c : []);
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
        </div>
      </header>
      <div className="vd-container vd-ways-detail">
        <nav className="vd-ways-jump" aria-label={safeT('home', 'waysInThisPage')}>
          <ul className="vd-ways-jump-list">
            {WAYS_CONFIG.map((way) => {
              const count = (placesByWay.get(way.wayKey) || []).length;
              return (
                <li key={way.wayKey}>
                  <a href={`#${way.wayKey}`} className="vd-ways-jump-link">
                    <Icon name={way.icon} size={20} aria-hidden />
                    <span>{safeT('home', way.titleKey)}</span>
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
                    {safeT('home', way.titleKey)}
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
