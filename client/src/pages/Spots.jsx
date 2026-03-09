import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import { getPlaceImageUrl } from '../api/client';
import { filterPlacesByQuery } from '../utils/searchFilter';
import './Explore.css';
import './Spots.css';

function SpotCard({ place, viewMode, onMapClick, viewDetailsLabel }) {
  const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
  const rating = place.rating != null ? Number(place.rating).toFixed(1) : null;
  const isList = viewMode === 'list';

  return (
    <Link to={`/place/${place.id}`} className={`spots-card spots-card--${viewMode}`}>
      <div className="spots-card-media" style={{ backgroundImage: img ? `url(${img})` : undefined }}>
        {!img && <span className="spots-card-fallback"><Icon name="place" size={32} /></span>}
        <div className="spots-card-overlay" />
        {rating && (
          <span className="spots-card-rating">
            <Icon name="star" size={14} /> {rating}
          </span>
        )}
      </div>
      <div className="spots-card-body">
        <h3 className="spots-card-title">{place.name}</h3>
        {place.location && <p className="spots-card-location">{place.location}</p>}
        <div className="spots-card-actions">
          <Link to={`/place/${place.id}`} className="spots-card-link">
            {isList ? <Icon name="arrow_forward" size={18} /> : null}
            <span>{viewDetailsLabel}</span>
          </Link>
          {onMapClick && (
            <button
              type="button"
              className="spots-card-map-btn"
              onClick={(e) => { e.preventDefault(); onMapClick(place); }}
              aria-label="View on map"
            >
              <Icon name="map" size={18} />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}

function groupPlacesByCategory(places, categories) {
  const byId = new Map();
  (categories || []).forEach((c) => byId.set(c.id, { id: c.id, name: c.name, places: [] }));
  const uncategorized = [];
  places.forEach((p) => {
    const catId = p.categoryId ?? p.category_id;
    const cat = catId ? byId.get(catId) : null;
    if (cat) cat.places.push(p);
    else uncategorized.push(p);
  });
  const sections = [];
  (categories || []).forEach((c) => {
    const list = byId.get(c.id)?.places ?? [];
    if (list.length > 0) {
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      sections.push({ id: c.id, name: c.name, places: list });
    }
  });
  if (uncategorized.length > 0) {
    uncategorized.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    sections.push({ id: 'other', name: 'Other', places: uncategorized });
  }
  return sections;
}

export default function Spots() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [sortBy, setSortBy] = useState('rating');
  const [viewMode, setViewMode] = useState('grid');
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featuredRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.places.list({ lang: langParam }).then((r) => r.popular || r.locations || []),
      api.categories.list({ lang: langParam }).then((r) => r.categories || []),
    ])
      .then(([p, c]) => {
        setPlaces(Array.isArray(p) ? p : []);
        setCategories(Array.isArray(c) ? c : []);
      })
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [langParam]);

  const filteredPlaces = useMemo(() => {
    let list = filterPlacesByQuery(places, searchQuery);
    if (selectedCategory) {
      const catId = selectedCategory;
      list = list.filter((p) => (p.categoryId ?? p.category_id) === catId);
    }
    if (sortBy === 'rating') {
      list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sortBy === 'name') {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return list;
  }, [places, searchQuery, selectedCategory, sortBy]);

  const sections = useMemo(
    () => groupPlacesByCategory(filteredPlaces, categories),
    [filteredPlaces, categories]
  );

  const featuredPlaces = useMemo(() => {
    const sorted = [...places].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return sorted.slice(0, 5);
  }, [places]);

  useEffect(() => {
    if (featuredPlaces.length <= 1) return;
    const id = setInterval(() => {
      setFeaturedIndex((i) => (i + 1) % featuredPlaces.length);
    }, 5000);
    return () => clearInterval(id);
  }, [featuredPlaces.length]);

  const handleViewOnMap = useCallback((place) => {
    navigate('/map', { state: { tripPlaceIds: [place.id], tripDays: [{ placeIds: [place.id] }], tripName: place.name } });
  }, [navigate]);

  const spotsCountStr = (t('home', 'spotsCount') || '{{count}} spots').replace('{{count}}', String(filteredPlaces.length));

  if (loading) {
    return (
      <div className="vd spots-page">
        <div className="spots-hero spots-hero--skeleton">
          <div className="spots-hero-inner">
            <div className="spots-skeleton-title" />
            <div className="spots-skeleton-sub" />
          </div>
        </div>
        <div className="vd-container spots-content">
          <div className="spots-skeleton-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="spots-skeleton-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vd spots-page">
        <div className="vd-page-hero">
          <div className="vd-container vd-page-hero-inner">
            <h1 className="vd-page-hero-title">{t('home', 'spotsToExplore')}</h1>
          </div>
        </div>
        <div className="vd-container" style={{ padding: 48, textAlign: 'center' }}>
          <p className="vd-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vd spots-page" role="main">
      {/* Hero – full-height, gradient, search */}
      <header className="spots-hero">
        <div className="spots-hero-bg" />
        <div className="spots-hero-inner">
          <h1 className="spots-hero-title">{t('home', 'spotsToExplore')}</h1>
          <p className="spots-hero-sub">{t('home', 'spotsSub')}</p>
          <div className="spots-search-wrap">
            <Icon name="search" size={22} className="spots-search-icon" />
            <input
              type="search"
              className="spots-search-input"
              placeholder={t('home', 'spotsSearch')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search spots"
            />
            {searchQuery && (
              <button type="button" className="spots-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear">
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="vd-container spots-content">
        {/* Featured carousel */}
        {featuredPlaces.length > 0 && (
          <section className="spots-featured" aria-label={t('home', 'spotsFeatured')}>
            <h2 className="spots-section-title">
              <Icon name="star" size={24} />
              {t('home', 'spotsFeatured')}
            </h2>
            <div className="spots-featured-carousel" ref={featuredRef}>
              <div className="spots-featured-track" style={{ transform: `translateX(-${featuredIndex * 100}%)` }}>
                {featuredPlaces.map((p) => {
                  const img = getPlaceImageUrl(p.image || (p.images && p.images[0]));
                  return (
                    <Link key={p.id} to={`/place/${p.id}`} className="spots-featured-card">
                      <div className="spots-featured-media" style={{ backgroundImage: img ? `url(${img})` : undefined }}>
                        {!img && <span className="spots-featured-fallback">Place</span>}
                        <div className="spots-featured-overlay" />
                        <div className="spots-featured-content">
                          <h3 className="spots-featured-title">{p.name}</h3>
                          {p.location && <p className="spots-featured-location">{p.location}</p>}
                          {p.rating != null && (
                            <span className="spots-featured-rating">
                              <Icon name="star" size={16} /> {Number(p.rating).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {featuredPlaces.length > 1 && (
                <div className="spots-featured-dots">
                  {featuredPlaces.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`spots-featured-dot ${i === featuredIndex ? 'spots-featured-dot--active' : ''}`}
                      onClick={() => setFeaturedIndex(i)}
                      aria-label={`Slide ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Toolbar: category filter, sort, view toggle */}
        <div className="spots-toolbar">
          <div className="spots-toolbar-left">
            <div className="spots-category-pills">
              <button
                type="button"
                className={`spots-pill ${!selectedCategory ? 'spots-pill--active' : ''}`}
                onClick={() => setSelectedCategory(null)}
              >
                {t('home', 'spotsAllCategories')}
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`spots-pill ${selectedCategory === c.id ? 'spots-pill--active' : ''}`}
                  onClick={() => setSelectedCategory(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <span className="spots-count">{spotsCountStr}</span>
          </div>
          <div className="spots-toolbar-right">
            <div className="spots-sort-wrap">
              <span className="spots-sort-label">{t('home', 'spotsSortBy')}</span>
              <select
                className="spots-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort by"
              >
                <option value="rating">{t('home', 'spotsSortRating')}</option>
                <option value="name">{t('home', 'spotsSortName')}</option>
              </select>
            </div>
            <div className="spots-view-toggle">
              <button
                type="button"
                className={`spots-view-btn ${viewMode === 'grid' ? 'spots-view-btn--active' : ''}`}
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                aria-label={t('home', 'spotsViewGrid')}
              >
                <Icon name="grid_view" size={20} />
              </button>
              <button
                type="button"
                className={`spots-view-btn ${viewMode === 'list' ? 'spots-view-btn--active' : ''}`}
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                aria-label={t('home', 'spotsViewList')}
              >
                <Icon name="view_list" size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Jump nav – scroll to category */}
        {sections.length > 1 && (
          <nav className="spots-jump" aria-label="Jump to category">
            {sections.map((sec) => (
              <a
                key={sec.id}
                href={`#spots-cat-${sec.id}`}
                className="spots-jump-link"
              >
                {sec.name}
                <span className="spots-jump-count">{sec.places.length}</span>
              </a>
            ))}
          </nav>
        )}

        {/* Category sections */}
        {sections.length === 0 ? (
          <p className="vd-empty spots-empty">{t('home', 'noSpots')}</p>
        ) : (
          <div className="spots-sections">
            {sections.map((sec) => (
              <section
                key={sec.id}
                id={`spots-cat-${sec.id}`}
                className="spots-category"
                aria-labelledby={`spots-cat-title-${sec.id}`}
              >
                <h2 id={`spots-cat-title-${sec.id}`} className="spots-category-title">
                  {sec.name}
                </h2>
                <div className={`spots-grid spots-grid--${viewMode}`}>
                  {sec.places.map((p) => (
                    <SpotCard
                      key={p.id}
                      place={p}
                      viewMode={viewMode}
                      onMapClick={user ? handleViewOnMap : undefined}
                      viewDetailsLabel={t('home', 'viewDetails')}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p style={{ marginTop: 32, textAlign: 'center' }}>
          <Link to="/map" className="vd-btn vd-btn--primary">
            {t('home', 'viewMap')} <Icon name="arrow_forward" size={20} />
          </Link>
        </p>
      </div>
    </div>
  );
}
