import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import './Explore.css';
import './Events.css';

function EventCard({ event }) {
  const img = getPlaceImageUrl(event.image) || null;
  const date = event.startDate
    ? new Date(event.startDate).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
  const category = event.category || '';
  const status = event.status || '';
  const organizer = event.organizer || '';
  const price = event.priceDisplay || event.price || '';

  return (
    <Link to={`/event/${event.id}`} className="vd-card vd-card--event events-card">
      <div className="vd-card-media">
        {img ? <DeliveryImg url={img} preset="gridCard" alt="" /> : <span className="vd-card-fallback">Event</span>}
        {date && <span className="vd-card-badge vd-card-date">{date}</span>}
        {status && <span className="events-status-pill">{status}</span>}
      </div>
      <div className="vd-card-content events-card-content">
        <h3 className="vd-card-title vd-card-title--dark events-card-title">{event.name}</h3>
        {category && (
          <p className="events-card-category">
            <Icon name="event" size={16} /> {category}
          </p>
        )}
        {event.location && <p className="events-card-location">{event.location}</p>}
        <div className="events-card-meta-row">
          {organizer && (
            <span className="events-card-meta">
              <Icon name="account_circle" size={16} /> {organizer}
            </span>
          )}
          {price && (
            <span className="events-card-meta events-card-meta--accent">
              <Icon name="payments" size={16} /> {price}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

const EVENT_SECTIONS = [
  { id: 'events', titleKey: 'megaEvents', descKey: 'megaEventsDesc' },
  { id: 'whats-on', titleKey: 'megaWhatsOn', descKey: 'megaWhatsOnDesc' },
  { id: 'festivals', titleKey: 'megaFestivals', descKey: 'megaFestivalsDesc' },
  { id: 'cultural', titleKey: 'megaCulturalEvents', descKey: 'megaCulturalEventsDesc' },
];

export default function Events() {
  const { t, lang } = useLanguage();
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.events.list({ lang: langParam })
      .then((r) => setEvents(Array.isArray(r.events) ? r.events : []))
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [langParam]);

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
    <div className="vd events-page">
      <header className="vd-page-hero">
        <div className="vd-container vd-page-hero-inner">
          <h1 className="vd-page-hero-title">{t('home', 'eventsFestivals')}</h1>
          <p className="vd-page-hero-sub">{t('home', 'eventsSub')}</p>
        </div>
      </header>
      <div className="vd-container">
        <div className="events-summary-bar">
          <p className="events-summary-text">
            <strong>{events.length}</strong> {t('home', 'eventsFestivals').toLowerCase()}
          </p>
        </div>
        {EVENT_SECTIONS.map((sec, idx) => (
          <section key={sec.id} id={sec.id} className="vd-section vd-events-section" style={{ scrollMarginTop: '100px' }}>
            <h2 className="vd-section-title">{t('nav', sec.titleKey)}</h2>
            <p className="vd-section-subtitle">{t('nav', sec.descKey)}</p>
            {idx === 0 ? (
              events.length === 0 ? (
                <p className="vd-empty">{t('home', 'noEvents')}</p>
              ) : (
                <div className="events-grid">
                  {events.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              )
            ) : null}
          </section>
        ))}
        <p style={{ marginTop: 24 }}>
          <Link to="/map" className="vd-btn vd-btn--secondary">{t('home', 'viewMap')} <Icon name="arrow_forward" size={20} /></Link>
        </p>
      </div>
    </div>
  );
}
