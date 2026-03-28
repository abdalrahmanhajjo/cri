import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import './Explore.css';
import './Events.css';
import './ActivitiesHub.css';

function TourCard({ tour }) {
  const img = getPlaceImageUrl(tour.image) || null;
  return (
    <Link to={`/tour/${tour.id}`} className="vd-card vd-card--tour activities-hub-card">
      <div className="vd-card-media">
        {img ? <DeliveryImg url={img} preset="gridCard" alt="" /> : <span className="vd-card-fallback">Tour</span>}
        {tour.duration && <span className="vd-card-badge">{tour.duration}</span>}
      </div>
      <div className="vd-card-content">
        <h3 className="vd-card-title vd-card-title--dark">{tour.name}</h3>
        {tour.priceDisplay && <p className="vd-card-meta vd-card-price">{tour.priceDisplay}</p>}
      </div>
    </Link>
  );
}

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
    <Link to={`/event/${event.id}`} className="vd-card vd-card--event events-card activities-hub-card">
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

export default function ActivitiesHub() {
  const { t, lang } = useLanguage();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'events' ? 'events' : 'experiences';

  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const [tours, setTours] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.tours.list({ lang: langParam }).then((r) => (Array.isArray(r.featured) ? r.featured : [])),
      api.events.list({ lang: langParam }).then((r) => (Array.isArray(r.events) ? r.events : [])),
    ])
      .then(([tList, eList]) => {
        if (!cancelled) {
          setTours(tList);
          setEvents(eList);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [langParam]);

  const title = tab === 'events' ? t('nav', 'eventsFestivals') : t('nav', 'activitiesExperiences');
  const subtitle = tab === 'events' ? t('home', 'eventsSub') : t('home', 'experiencesSub');

  useEffect(() => {
    document.title = `${title} | Visit Tripoli`;
    return () => {
      document.title = 'Visit Tripoli';
    };
  }, [title]);

  const counts = useMemo(
    () => ({ tours: tours.length, events: events.length }),
    [tours.length, events.length]
  );

  if (loading) {
    return (
      <div className="vd activities-hub">
        <div className="vd-loading">
          <div className="vd-loading-spinner" aria-hidden="true" />
          <span>{t('home', 'loading')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vd activities-hub">
        <div className="vd-error" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`vd activities-hub ${tab === 'events' ? 'activities-hub--events' : 'activities-hub--experiences'}`}>
      <header className="activities-hub-hero">
        <div className="vd-container activities-hub-hero-inner">
          <nav className="activities-hub-tabs" aria-label={t('nav', 'activitiesHubTabsLabel')}>
            <Link
              to="/activities"
              replace
              className={`activities-hub-tab ${tab === 'experiences' ? 'activities-hub-tab--active' : ''}`}
              aria-current={tab === 'experiences' ? 'page' : undefined}
            >
              <Icon name="hiking" size={22} aria-hidden />
              <span className="activities-hub-tab-label">{t('nav', 'activitiesExperiences')}</span>
              <span className="activities-hub-tab-count" aria-hidden="true">
                {counts.tours}
              </span>
            </Link>
            <Link
              to="/activities?tab=events"
              replace
              className={`activities-hub-tab ${tab === 'events' ? 'activities-hub-tab--active' : ''}`}
              aria-current={tab === 'events' ? 'page' : undefined}
            >
              <Icon name="celebration" size={22} aria-hidden />
              <span className="activities-hub-tab-label">{t('nav', 'eventsFestivals')}</span>
              <span className="activities-hub-tab-count" aria-hidden="true">
                {counts.events}
              </span>
            </Link>
          </nav>
          <div className="activities-hub-intro">
            <h1 className="activities-hub-title">{title}</h1>
            <p className="activities-hub-sub">{subtitle}</p>
          </div>
        </div>
      </header>

      <div className="vd-container activities-hub-body">
        {tab === 'experiences' ? (
          <section className="activities-hub-panel" aria-labelledby="hub-experiences-heading">
            <div className="activities-hub-panel-head">
              <h2 id="hub-experiences-heading" className="activities-hub-panel-kicker">
                {t('nav', 'megaExperiences')}
              </h2>
              <p className="activities-hub-panel-desc">{t('nav', 'megaExperiencesDesc')}</p>
            </div>
            {tours.length === 0 ? (
              <p className="vd-empty">{t('home', 'noTours')}</p>
            ) : (
              <div className="vd-grid vd-grid--4 activities-hub-grid">
                {tours.map((tour) => (
                  <TourCard key={tour.id} tour={tour} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="activities-hub-panel" aria-labelledby="hub-events-heading">
            <div className="activities-hub-panel-head">
              <h2 id="hub-events-heading" className="activities-hub-panel-kicker">
                {t('nav', 'megaEvents')}
              </h2>
              <p className="activities-hub-panel-desc">{t('nav', 'megaEventsDesc')}</p>
              <div className="events-summary-bar activities-hub-summary">
                <p className="events-summary-text">
                  <strong>{events.length}</strong> {t('home', 'eventsList').toLowerCase()}
                </p>
              </div>
            </div>
            {events.length === 0 ? (
              <p className="vd-empty">{t('home', 'noEvents')}</p>
            ) : (
              <div className="events-grid activities-hub-events-grid">
                {events.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            )}
          </section>
        )}

        <p className="activities-hub-footer-cta">
          <Link to="/map" className="vd-btn vd-btn--secondary">
            {t('home', 'viewMap')} <Icon name="arrow_forward" size={20} />
          </Link>
        </p>
      </div>
    </div>
  );
}
