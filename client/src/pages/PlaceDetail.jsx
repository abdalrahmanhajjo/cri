import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import Icon from '../components/Icon';
import { getPlaceImageUrl } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import './Detail.css';

function InfoRow({ icon, label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="place-detail-info-row">
      <span className="place-detail-info-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <div className="place-detail-info-content">
        <span className="place-detail-info-label">{label}</span>
        <span className="place-detail-info-value">{value}</span>
      </div>
    </div>
  );
}

export default function PlaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavourite, setIsFavourite] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.places
      .get(id)
      .then((p) => {
        if (!cancelled) {
          setPlace(p);
          if (p?.name) document.title = `${p.name} | Visit Tripoli`;
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      document.title = 'Visit Tripoli';
    };
  }, [id]);

  useEffect(() => {
    if (!user || !place) {
      setIsFavourite(false);
      return;
    }
    api.user
      .favourites()
      .then((res) => {
        const ids = new Set((Array.isArray(res.placeIds) ? res.placeIds : []).map(String));
        setIsFavourite(ids.has(String(place.id)));
      })
      .catch(() => setIsFavourite(false));
  }, [user, place]);

  const toggleFavourite = useCallback(() => {
    if (!user) {
      navigate('/login', { state: { from: 'place' } });
      return;
    }
    if (!place) return;
    const placeId = String(place.id);
    if (isFavourite) {
      api.user.removeFavourite(placeId).catch(() => {});
      setIsFavourite(false);
    } else {
      api.user.addFavourite(placeId).catch(() => {});
      setIsFavourite(true);
    }
  }, [user, place, isFavourite, navigate]);

  const handleShare = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.share && place) {
      navigator.share({
        title: place.name,
        text: place.description || place.name,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href).then(() => {
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 2000);
      }).catch(() => {});
    }
  }, [place]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (loading) {
    return (
      <div className="place-detail place-detail--loading">
        <div className="place-detail-loading">
          <div className="place-detail-loading-spinner" aria-hidden="true" />
          <p>{t('detail', 'loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="place-detail place-detail--error">
        <div className="place-detail-container">
          <Link to="/" className="place-detail-back">
            <Icon name="arrow_back" size={20} /> {t('detail', 'backToExplore')}
          </Link>
          <div className="place-detail-error">
            <p>{t('detail', 'placeNotFound')}</p>
            <p className="place-detail-error-sub">{error || ''}</p>
          </div>
        </div>
      </div>
    );
  }

  const img = getPlaceImageUrl(place.image || (place.images && place.images[0]));
  const heroStyle = img ? { backgroundImage: `url(${img})` } : {};
  const coords = place.coordinates || (place.latitude != null && place.longitude != null ? { lat: place.latitude, lng: place.longitude } : null);
  const googleMapsUrl = coords
    ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
    : place.location
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.location + ', Tripoli, Lebanon')}`
      : null;

  const hours = place.hours;
  const hoursStr = typeof hours === 'string' ? hours : Array.isArray(hours) ? hours.join(' · ') : hours;

  return (
    <div className="place-detail">
      <div className="place-detail-container">
        <nav className="place-detail-breadcrumb" aria-label="Breadcrumb">
          <ol className="place-detail-breadcrumb-list">
            <li><Link to="/">{t('nav', 'home')}</Link></li>
            <li><Link to="/">{t('detail', 'discoverTripoli')}</Link></li>
            <li aria-current="page">{place.name}</li>
          </ol>
        </nav>

        <Link to="/" className="place-detail-back">
          <Icon name="arrow_back" size={20} /> {t('detail', 'backToExplore')}
        </Link>

        <article className="place-detail-article">
          <header className="place-detail-hero" style={img ? heroStyle : undefined}>
            {!img && (
              <div className="place-detail-hero-fallback">
                <Icon name="place" size={48} />
                <span>{t('detail', 'noImage')}</span>
              </div>
            )}
            <div className="place-detail-hero-overlay" />
            <div className="place-detail-hero-badge">{t('detail', 'officialInfo')}</div>
            <div className="place-detail-hero-content">
              <h1 className="place-detail-title">{place.name}</h1>
              {place.location && (
                <p className="place-detail-location">
                  <Icon name="location_on" size={18} /> {place.location}
                </p>
              )}
              <div className="place-detail-hero-meta">
                {place.rating != null && (
                  <span className="place-detail-rating">
                    <Icon name="star" size={18} /> {Number(place.rating).toFixed(1)}
                    {place.reviewCount != null && (
                      <span className="place-detail-reviews"> ({place.reviewCount} {t('detail', 'reviewsCount')})</span>
                    )}
                  </span>
                )}
                {place.category && <span className="place-detail-category">{place.category}</span>}
              </div>
            </div>
          </header>

          <div className="place-detail-actions">
            {googleMapsUrl && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="place-detail-btn place-detail-btn--primary"
              >
                <Icon name="map" size={20} /> {t('detail', 'viewOnGoogleMaps')}
              </a>
            )}
            <Link to="/map" className="place-detail-btn place-detail-btn--secondary">
              <Icon name="map" size={20} /> {t('home', 'viewMap')}
            </Link>
            <button
              type="button"
              className={`place-detail-btn place-detail-btn--icon ${isFavourite ? 'place-detail-btn--active' : ''}`}
              onClick={toggleFavourite}
              aria-label={isFavourite ? t('home', 'removeFromFavourites') : t('home', 'addToFavourites')}
            >
              <Icon name={isFavourite ? 'favorite' : 'favorite_border'} size={22} />
              <span className="place-detail-btn-label">{t('detail', 'saveToMyPlaces')}</span>
            </button>
            <button type="button" className="place-detail-btn place-detail-btn--icon" onClick={handleShare} aria-label={t('detail', 'share')}>
              <Icon name="share" size={22} />
              <span className="place-detail-btn-label">{t('detail', 'share')}</span>
            </button>
            <button type="button" className="place-detail-btn place-detail-btn--icon" onClick={handlePrint} aria-label={t('detail', 'print')}>
              <Icon name="print" size={22} />
              <span className="place-detail-btn-label">{t('detail', 'print')}</span>
            </button>
          </div>

          <div className="place-detail-info">
            <InfoRow icon="schedule" label={t('detail', 'openingHours')} value={hoursStr} />
            <InfoRow icon="location_on" label={t('detail', 'location')} value={place.location} />
            <InfoRow icon="category" label={t('detail', 'category')} value={place.category} />
            <InfoRow icon="wb_sunny" label={t('detail', 'bestTimeToVisit')} value={place.bestTime} />
            <InfoRow icon="schedule" label={t('detail', 'duration')} value={place.duration} />
            <InfoRow icon="payments" label={t('detail', 'priceRange')} value={place.price} />
          </div>

          {place.description && (
            <section className="place-detail-section" aria-labelledby="place-description-heading">
              <h2 id="place-description-heading" className="place-detail-section-title">{t('detail', 'description')}</h2>
              <div className="place-detail-description">
                {place.description.split(/\n\n+/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )}

          {place.tags && (Array.isArray(place.tags) ? place.tags.length > 0 : place.tags) && (
            <section className="place-detail-section place-detail-tags">
              <div className="place-detail-tags-list">
                {(Array.isArray(place.tags) ? place.tags : [place.tags]).map((tag, i) => (
                  <span key={i} className="place-detail-tag">{tag}</span>
                ))}
              </div>
            </section>
          )}

          <footer className="place-detail-footer">
            <p className="place-detail-footer-notice">{t('detail', 'footerNotice')}</p>
          </footer>
          {copyToast && (
            <div className="place-detail-toast" role="status">
              {t('detail', 'linkCopied') || 'Link copied!'}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
