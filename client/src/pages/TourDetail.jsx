import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import Icon from '../components/Icon';
import { getPlaceImageUrl } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import './Detail.css';

function InfoRow({ icon, label, value }) {
  if (value == null || value === '') return null;
  const display = Array.isArray(value) ? value.join(', ') : value;
  if (display === '') return null;
  return (
    <div className="place-detail-info-row">
      <span className="place-detail-info-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <div className="place-detail-info-content">
        <span className="place-detail-info-label">{label}</span>
        <span className="place-detail-info-value">{display}</span>
      </div>
    </div>
  );
}

export default function TourDetail() {
  const { id } = useParams();
  const { t } = useLanguage();
  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.tours
      .get(id)
      .then(setTour)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.share && tour) {
      navigator.share({
        title: tour.name,
        text: tour.description || tour.name,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href).catch(() => {});
    }
  }, [tour]);

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

  if (error || !tour) {
    return (
      <div className="place-detail place-detail--error">
        <div className="place-detail-container">
          <Link to="/tours" className="place-detail-back">
            <Icon name="arrow_back" size={20} /> {t('detail', 'backToExplore')}
          </Link>
          <div className="place-detail-error">
            <p>{t('detail', 'notFound')}</p>
            <p className="place-detail-error-sub">{error || ''}</p>
          </div>
        </div>
      </div>
    );
  }

  const img = getPlaceImageUrl(tour.image);
  const heroStyle = img ? { backgroundImage: `url(${img})` } : {};
  const locationsStr = Array.isArray(tour.locations) ? tour.locations.join(', ') : tour.locations;
  const languagesStr = Array.isArray(tour.languages) && tour.languages.length > 0
    ? tour.languages.join(', ')
    : null;

  return (
    <div className="place-detail">
      <div className="place-detail-container">
        <nav className="place-detail-breadcrumb" aria-label="Breadcrumb">
          <ol className="place-detail-breadcrumb-list">
            <li><Link to="/">{t('nav', 'home')}</Link></li>
            <li><Link to="/tours">{t('nav', 'experiencesTours')}</Link></li>
            <li aria-current="page">{tour.name}</li>
          </ol>
        </nav>

        <Link to="/tours" className="place-detail-back">
          <Icon name="arrow_back" size={20} /> {t('detail', 'backToExplore')}
        </Link>

        <article className="place-detail-article">
          <header className="place-detail-hero" style={img ? heroStyle : undefined}>
            {!img && (
              <div className="place-detail-hero-fallback">
                <Icon name="explore" size={48} />
                <span>{t('detail', 'noImage')}</span>
              </div>
            )}
            <div className="place-detail-hero-overlay" />
            <div className="place-detail-hero-badge">{t('detail', 'tourBadge')}</div>
            <div className="place-detail-hero-content">
              <h1 className="place-detail-title">{tour.name}</h1>
              {locationsStr && (
                <p className="place-detail-location">
                  <Icon name="location_on" size={18} /> {locationsStr}
                </p>
              )}
              <div className="place-detail-hero-meta">
                {tour.duration && <span className="place-detail-category">{tour.duration}</span>}
                {tour.priceDisplay && <span className="place-detail-category">{tour.priceDisplay}</span>}
                {tour.difficulty && <span className="place-detail-category">{tour.difficulty}</span>}
              </div>
            </div>
          </header>

          <div className="place-detail-actions">
            <Link to="/map" className="place-detail-btn place-detail-btn--primary">
              <Icon name="map" size={20} /> {t('detail', 'viewOnMap')}
            </Link>
            <button
              type="button"
              className="place-detail-btn place-detail-btn--icon"
              onClick={handleShare}
              aria-label={t('detail', 'share')}
            >
              <Icon name="share" size={22} />
              <span className="place-detail-btn-label">{t('detail', 'share')}</span>
            </button>
            <button
              type="button"
              className="place-detail-btn place-detail-btn--icon"
              onClick={handlePrint}
              aria-label={t('detail', 'print')}
            >
              <Icon name="print" size={22} />
              <span className="place-detail-btn-label">{t('detail', 'print')}</span>
            </button>
          </div>

          <div className="place-detail-info">
            <InfoRow icon="schedule" label={t('detail', 'duration')} value={tour.duration} />
            <InfoRow icon="payments" label={t('detail', 'priceRange')} value={tour.priceDisplay} />
            <InfoRow icon="terrain" label={t('detail', 'difficulty')} value={tour.difficulty} />
            <InfoRow icon="translate" label={t('detail', 'languages')} value={languagesStr || (Array.isArray(tour.languages) ? tour.languages : null)} />
            <InfoRow icon="location_on" label={t('detail', 'location')} value={locationsStr} />
          </div>

          {tour.description && (
            <section className="place-detail-section" aria-labelledby="tour-description-heading">
              <h2 id="tour-description-heading" className="place-detail-section-title">{t('detail', 'description')}</h2>
              <div className="place-detail-description">
                {tour.description.split(/\n\n+/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )}

          {tour.highlights && Array.isArray(tour.highlights) && tour.highlights.length > 0 && (
            <section className="place-detail-section" aria-labelledby="tour-highlights-heading">
              <h2 id="tour-highlights-heading" className="place-detail-section-title">{t('detail', 'highlights')}</h2>
              <ul className="place-detail-description" style={{ paddingLeft: '1.25em', margin: 0 }}>
                {tour.highlights.map((item, i) => (
                  <li key={i} style={{ marginBottom: '6px' }}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          <footer className="place-detail-footer">
            <p className="place-detail-footer-notice">{t('detail', 'footerNotice')}</p>
          </footer>
        </article>
      </div>
    </div>
  );
}
