import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Icon from '../components/Icon';
import { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import './Explore.css';
import './Favourites.css';

function PlaceCardWithRemove({ place, onRemove, removeLabel }) {
  const img = getPlaceImageUrl(place.image || (place.images && place.images[0])) || null;
  return (
    <div className="vd-card-wrap vd-card-wrap--favourite">
      <Link to={`/place/${place.id}`} className="vd-card vd-card--place">
        <div className="vd-card-media">
          {img ? <DeliveryImg url={img} preset="gridCard" alt="" /> : <span className="vd-card-fallback">Place</span>}
          <div className="vd-card-overlay">
            <h3 className="vd-card-title">{place.name}</h3>
            {place.location && <p className="vd-card-meta">{place.location}</p>}
          </div>
          {place.rating != null && (
            <span className="vd-card-badge vd-card-rating"><Icon name="star" size={16} /> {Number(place.rating).toFixed(1)}</span>
          )}
        </div>
      </Link>
      <button
        type="button"
        className="vd-favourite-remove"
        onClick={(e) => { e.preventDefault(); onRemove(place.id); }}
        aria-label={removeLabel}
      >
        <Icon name="remove_circle_outline" size={24} />
      </button>
    </div>
  );
}

export default function Favourites() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFavourites = useCallback(() => {
    setLoading(true);
    setError(null);
    api.user
      .favourites()
      .then((res) => {
        const ids = Array.isArray(res.placeIds) ? res.placeIds.map(String) : [];
        if (ids.length === 0) {
          setPlaces([]);
          setLoading(false);
          return;
        }
        return Promise.all(ids.map((placeId) => api.places.get(placeId).catch(() => null))).then((results) => {
          setPlaces(results.filter(Boolean));
        });
      })
      .catch((err) => setError(err.message || 'Failed to load favourites'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadFavourites();
  }, [loadFavourites]);

  const handleRemove = useCallback(
    (placeId) => {
      const idStr = String(placeId);
      api.user
        .removeFavourite(idStr)
        .then(() => {
          setPlaces((prev) => prev.filter((p) => String(p.id) !== idStr));
          showToast(t('feedback', 'favouriteRemoved'), 'success');
        })
        .catch(() => showToast(t('feedback', 'favouriteUpdateFailed'), 'error'));
    },
    [showToast, t]
  );

  if (loading) {
    return (
      <div className="vd">
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
        <div className="vd-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="vd">
      <header className="vd-page-hero">
        <div className="vd-container vd-page-hero-inner">
          <h1 className="vd-page-hero-title">{t('nav', 'myFavourites')}</h1>
          <p className="vd-page-hero-sub">{t('home', 'topPicksSub')}</p>
        </div>
      </header>
      <section className="vd-section vd-spots">
        <div className="vd-container">
          {places.length === 0 ? (
            <p className="vd-empty">{t('home', 'favouritesEmpty')}</p>
          ) : (
            <div className="vd-grid vd-grid--4">
              {places.map((p) => (
                <PlaceCardWithRemove
                  key={p.id}
                  place={p}
                  onRemove={handleRemove}
                  removeLabel={t('home', 'removeFromFavourites')}
                />
              ))}
            </div>
          )}
          <p style={{ marginTop: 24 }}>
            <Link to="/" className="vd-btn vd-btn--secondary">{t('home', 'viewMap')} <Icon name="arrow_forward" size={20} /></Link>
          </p>
        </div>
      </section>
    </div>
  );
}
