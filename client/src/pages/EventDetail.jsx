import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import Icon from '../components/Icon';
import { getPlaceImageUrl } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
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

export default function EventDetail() {
  const { id } = useParams();
  const { t } = useLanguage();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.events
      .get(id)
      .then(setEvent)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.share && event) {
      navigator.share({
        title: event.name,
        text: event.description || event.name,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href).catch(() => {});
    }
  }, [event]);

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

  if (error || !event) {
    return (
      <div className="place-detail place-detail--error">
        <div className="place-detail-container">
          <Link to="/events" className="place-detail-back">
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

  const img = getPlaceImageUrl(event.image);
  const heroStyle = img ? { backgroundImage: `url(${img})` } : {};
  const startDate = event.startDate
    ? new Date(event.startDate).toLocaleDateString(undefined, { dateStyle: 'long' })
    : '';
  const startTime = event.startDate
    ? new Date(event.startDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';
  const endTime = event.endDate
    ? new Date(event.endDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';
  const timeStr = startTime && endTime ? `${startTime} – ${endTime}` : startTime || endTime;
  const googleMapsUrl = event.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location + ', Tripoli, Lebanon')}`
    : null;

  return (
    <div className="place-detail">
      <div className="place-detail-container">
        <nav className="place-detail-breadcrumb" aria-label="Breadcrumb">
          <ol className="place-detail-breadcrumb-list">
            <li><Link to="/">{t('nav', 'home')}</Link></li>
            <li><Link to="/events">{t('nav', 'eventsFestivals')}</Link></li>
            <li aria-current="page">{event.name}</li>
          </ol>
        </nav>

        <Link to="/events" className="place-detail-back">
          <Icon name="arrow_back" size={20} /> {t('detail', 'backToExplore')}
        </Link>

        <article className="place-detail-article">
          <header className="place-detail-hero" style={img ? heroStyle : undefined}>
            {!img && (
              <div className="place-detail-hero-fallback">
                <Icon name="event" size={48} />
                <span>{t('detail', 'noImage')}</span>
              </div>
            )}
            <div className="place-detail-hero-overlay" />
            <div className="place-detail-hero-badge">{t('detail', 'eventBadge')}</div>
            <div className="place-detail-hero-content">
              <h1 className="place-detail-title">{event.name}</h1>
              {event.location && (
                <p className="place-detail-location">
                  <Icon name="location_on" size={18} /> {event.location}
                </p>
              )}
              <div className="place-detail-hero-meta">
                {startDate && <span className="place-detail-category">{startDate}</span>}
                {event.category && <span className="place-detail-category">{event.category}</span>}
                {event.priceDisplay && <span className="place-detail-category">{event.priceDisplay}</span>}
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
            <InfoRow icon="calendar_today" label={t('detail', 'date')} value={startDate} />
            <InfoRow icon="schedule" label={t('detail', 'time')} value={timeStr} />
            <InfoRow icon="location_on" label={t('detail', 'location')} value={event.location} />
            <InfoRow icon="category" label={t('detail', 'category')} value={event.category} />
            <InfoRow icon="group" label={t('detail', 'organizer')} value={event.organizer} />
            <InfoRow icon="payments" label={t('detail', 'priceRange')} value={event.priceDisplay || event.price} />
            <InfoRow icon="info" label={t('detail', 'status')} value={event.status} />
          </div>

          {event.description && (
            <section className="place-detail-section" aria-labelledby="event-description-heading">
              <h2 id="event-description-heading" className="place-detail-section-title">{t('detail', 'description')}</h2>
              <div className="place-detail-description">
                {event.description.split(/\n\n+/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
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
