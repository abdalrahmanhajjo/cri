import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import Icon from '../components/Icon';
import { getDeliveryImgProps } from '../utils/responsiveImages.js';
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

function eventDateRangeLabel(startIso, endIso) {
  if (!startIso) return '';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  if (!end || Number.isNaN(end.getTime())) {
    return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) {
    return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const a = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const b = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${a} – ${b}`;
}

function eventTimeRangeLabel(startIso, endIso) {
  if (!startIso) return '';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const st = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (!end || Number.isNaN(end.getTime())) return st;
  const en = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${st} – ${en}`;
}

function collectPlaceImageUrls(place) {
  if (!place) return [];
  const raw = [];
  if (place.image) raw.push(place.image);
  if (Array.isArray(place.images)) raw.push(...place.images);
  const seen = new Set();
  const out = [];
  for (const im of raw) {
    if (im == null || im === '') continue;
    const u = getPlaceImageUrl(im) || String(im);
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

export default function EventDetail() {
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const [event, setEvent] = useState(null);
  const [venue, setVenue] = useState(null);
  const [eventsList, setEventsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.events
      .get(id)
      .then((data) => {
        if (cancelled) return;
        setEvent(data);
        const pid = data?.placeId ?? data?.place_id;
        if (pid == null || pid === '') {
          setVenue(null);
          return;
        }
        return api.places.get(String(pid)).then((p) => {
          if (!cancelled) setVenue(p || null);
        }).catch(() => { if (!cancelled) setVenue(null); });
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    api.events.list({ lang: langParam })
      .then((r) => setEventsList(Array.isArray(r?.events) ? r.events : []))
      .catch(() => setEventsList([]));
  }, [langParam]);

  const similarEvents = useMemo(() => {
    if (!event) return [];
    return eventsList
      .filter((e) => String(e.id) !== String(id) && e.category === event.category)
      .slice(0, 8);
  }, [eventsList, event, id]);

  const isLiveUrl =
    event &&
    String(event.category || '').trim().toLowerCase() === 'live' &&
    String(event.location || '').trim().toLowerCase().startsWith('http');

  const hasEventMapPin =
    event &&
    Number.isFinite(Number(event.latitude)) &&
    Number.isFinite(Number(event.longitude));

  const canShowEventMapTab = Boolean(
    event &&
      (event.placeId ||
        venue ||
        hasEventMapPin ||
        (event.location && !isLiveUrl))
  );

  useEffect(() => {
    if (!event) return;
    if (tab === 'map' && !canShowEventMapTab) setTab('overview');
  }, [event, canShowEventMapTab, tab]);

  const openVenueOnMap = useCallback(() => {
    if (!event?.placeId && !venue) return;
    const returnTo = `${location.pathname}${location.search}${location.hash || ''}`;
    if (!user) {
      navigate('/login', { state: { from: returnTo } });
      return;
    }
    const pid = String(event?.placeId || venue?.id);
    navigate('/map', {
      state: {
        tripPlaceIds: [pid],
        tripDays: [{ placeIds: [pid] }],
        tripName: event?.name || t('detail', 'eventBadge'),
        tripStartDate: '',
      },
    });
  }, [navigate, event, venue, t, user, location.pathname, location.search, location.hash]);

  const openEventPinOnMap = useCallback(() => {
    if (!event || !hasEventMapPin) return;
    const returnTo = `${location.pathname}${location.search}${location.hash || ''}`;
    if (!user) {
      navigate('/login', { state: { from: returnTo } });
      return;
    }
    navigate('/map', {
      state: {
        mapFocus: {
          lat: Number(event.latitude),
          lng: Number(event.longitude),
          label: event.name || event.location || 'Event',
          zoom: 15,
        },
      },
    });
  }, [navigate, event, user, location.pathname, location.search, location.hash, hasEventMapPin]);

  const openSiteMapBrowse = useCallback(() => {
    const returnTo = `${location.pathname}${location.search}${location.hash || ''}`;
    if (!user) {
      navigate('/login', { state: { from: returnTo } });
      return;
    }
    navigate('/map');
  }, [navigate, user, location.pathname, location.search, location.hash]);

  const openPrimaryMap = useCallback(() => {
    if (event?.placeId || venue) {
      openVenueOnMap();
    } else if (hasEventMapPin) {
      openEventPinOnMap();
    } else {
      openSiteMapBrowse();
    }
  }, [event?.placeId, venue, hasEventMapPin, openVenueOnMap, openEventPinOnMap, openSiteMapBrowse]);

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
          <Link to="/activities?tab=events" className="place-detail-back">
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
  const dateLabel = eventDateRangeLabel(event.startDate, event.endDate);
  const timeStr = eventTimeRangeLabel(event.startDate, event.endDate);
  const hasEventCategory = Boolean(event.category && String(event.category).trim());
  const eventPriceDisplayValue = (() => {
    const pd = event.priceDisplay != null && String(event.priceDisplay).trim() !== '' ? String(event.priceDisplay).trim() : '';
    if (pd) return pd;
    if (event.price != null && event.price !== '' && !Number.isNaN(Number(event.price))) return String(event.price);
    return null;
  })();
  const showEventPriceHero = Boolean(eventPriceDisplayValue);
  const organizerDisplay = event.organizer != null && String(event.organizer).trim() !== '' ? String(event.organizer).trim() : null;
  const statusDisplay = event.status != null && String(event.status).trim() !== '' ? String(event.status).trim() : null;
  const venueImgs = collectPlaceImageUrls(venue);

  return (
    <div className="place-detail place-detail--tabs place-detail--experience">
      <div className="place-detail-container place-detail-container--experience">
        <nav className="place-detail-breadcrumb" aria-label="Breadcrumb">
          <ol className="place-detail-breadcrumb-list">
            <li><Link to="/">{t('nav', 'home')}</Link></li>
            <li><Link to="/activities?tab=events">{t('nav', 'eventsFestivals')}</Link></li>
            <li aria-current="page">{event.name}</li>
          </ol>
        </nav>

        <Link to="/activities?tab=events" className="place-detail-back">
          <Icon name="arrow_back" size={20} /> {t('detail', 'backToExplore')}
        </Link>

        <article className="place-detail-article">
          <header className="place-detail-hero place-detail-hero--event">
            {img && (
              <img
                key={img}
                className="place-detail-hero__img"
                alt=""
                loading="eager"
                decoding="async"
                fetchPriority="high"
                {...getDeliveryImgProps(img, 'detailHero')}
              />
            )}
            {!img && (
              <div className="place-detail-hero-fallback">
                <Icon name="event" size={48} />
                <span>{t('detail', 'noImage')}</span>
              </div>
            )}
            <div className="place-detail-hero-overlay" />
            {hasEventCategory ? (
              <div className="place-detail-hero-badge place-detail-hero-badge--event">{String(event.category).trim()}</div>
            ) : null}
            {showEventPriceHero ? (
              <div className="place-detail-hero-price-pill">{eventPriceDisplayValue}</div>
            ) : null}
            <div className="place-detail-hero-content">
              <h1 className="place-detail-title">{event.name}</h1>
              {event.location && !isLiveUrl && (
                <p className="place-detail-location">
                  <Icon name="location_on" size={18} /> {event.location}
                </p>
              )}
              <div className="place-detail-hero-meta">
                {dateLabel ? <span className="place-detail-category">{dateLabel}</span> : null}
                {timeStr ? <span className="place-detail-category">{timeStr}</span> : null}
              </div>
            </div>
          </header>

          <div className="detail-tab-bar" role="tablist" aria-label={t('detail', 'eventBadge')}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'overview'}
              className={`detail-tab ${tab === 'overview' ? 'detail-tab--active' : ''}`}
              onClick={() => setTab('overview')}
            >
              {t('detail', 'eventOverviewTab')}
            </button>
            {canShowEventMapTab ? (
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'map'}
                className={`detail-tab ${tab === 'map' ? 'detail-tab--active' : ''}`}
                onClick={() => setTab('map')}
              >
                {t('detail', 'eventMapTab')}
              </button>
            ) : null}
          </div>

          {tab === 'overview' && (
            <div className="detail-tab-panel" role="tabpanel">
              {isLiveUrl && (
                <p className="detail-live-cta">
                  <a href={event.location} target="_blank" rel="noopener noreferrer" className="place-detail-btn place-detail-btn--primary">
                    <Icon name="open_in_new" size={20} /> {t('detail', 'openLink')}
                  </a>
                </p>
              )}

              <div className="place-detail-actions detail-tab-actions">
                {(event.placeId || venue || hasEventMapPin || (event.location && !isLiveUrl)) && (
                  <button type="button" className="place-detail-btn place-detail-btn--primary" onClick={openPrimaryMap}>
                    <Icon name="map" size={20} /> {t('detail', 'viewOnMap')}
                  </button>
                )}
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
                <InfoRow icon="calendar" label={t('detail', 'date')} value={dateLabel} />
                <InfoRow icon="clock" label={t('detail', 'time')} value={timeStr} />
                {!isLiveUrl && <InfoRow icon="map-pin" label={t('detail', 'location')} value={event.location} />}
                <InfoRow icon="grid" label={t('detail', 'category')} value={hasEventCategory ? String(event.category).trim() : null} />
                <InfoRow icon="users" label={t('detail', 'organizer')} value={organizerDisplay} />
                <InfoRow icon="credit-card" label={t('detail', 'priceRange')} value={eventPriceDisplayValue} />
                <InfoRow icon="info" label={t('detail', 'status')} value={statusDisplay} />
              </div>

              {event.description && (
                <section className="place-detail-section" aria-labelledby="event-description-heading">
                  <h2 id="event-description-heading" className="place-detail-section-title">{t('detail', 'description')}</h2>
                  <div className="place-detail-description place-detail-description--card">
                    {event.description.split(/\n\n+/).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </section>
              )}

              {venue && (
                <section className="place-detail-section" aria-labelledby="event-venue-heading">
                  <h2 id="event-venue-heading" className="place-detail-section-title">{t('detail', 'eventVenueTitle')}</h2>
                  <div className="event-venue-card">
                    {venueImgs.length > 0 && (
                      <div className="event-venue-gallery">
                        {venueImgs.slice(0, 6).map((src, gi) => (
                          <Link key={gi} to={`/place/${venue.id}`} className="event-venue-gallery-item">
                            <img
                              className="event-venue-gallery-img"
                              alt=""
                              loading="lazy"
                              decoding="async"
                              {...getDeliveryImgProps(src, 'venueThumb')}
                            />
                          </Link>
                        ))}
                      </div>
                    )}
                    <div className="event-venue-body">
                      <Link to={`/place/${venue.id}`} className="event-venue-name">{venue.name}</Link>
                      {venue.location && <p className="event-venue-loc">{venue.location}</p>}
                      <div className="event-venue-actions">
                        <Link to={`/place/${venue.id}`} className="detail-text-link">{t('detail', 'venueProfile')} →</Link>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {similarEvents.length > 0 && (
                <section className="place-detail-section" aria-labelledby="event-sim-heading">
                  <h2 id="event-sim-heading" className="place-detail-section-title">{t('detail', 'eventSimilar')}</h2>
                  <div className="detail-similar-scroll">
                    {similarEvents.map((ev) => {
                      const eImg = getPlaceImageUrl(ev.image);
                      return (
                        <Link key={ev.id} to={`/event/${ev.id}`} className="detail-similar-card">
                          <div className="detail-similar-card-media">
                            {eImg ? <DeliveryImg url={eImg} preset="similarStrip" alt="" /> : null}
                          </div>
                          <span className="detail-similar-card-title">{ev.name}</span>
                          {ev.startDate && (
                            <span className="detail-similar-card-meta">
                              {eventDateRangeLabel(ev.startDate, ev.endDate)}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              <p className="detail-plan-hint">
                <Link to="/plan">{t('detail', 'eventPlanHint')}</Link>
              </p>
            </div>
          )}

          {tab === 'map' && (
            <div className="detail-tab-panel" role="tabpanel">
              <p className="detail-map-intro">{t('detail', 'eventMapIntro')}</p>
              <div className="place-detail-actions">
                {(event.placeId || venue || hasEventMapPin || (event.location && !isLiveUrl)) && (
                  <button type="button" className="place-detail-btn place-detail-btn--primary" onClick={openPrimaryMap}>
                    <Icon name="map" size={20} /> {t('detail', 'viewOnMap')}
                  </button>
                )}
              </div>
              {!event.placeId && !venue && !hasEventMapPin && (!event.location || isLiveUrl) && (
                <p className="detail-empty-tab">{t('detail', 'eventNoVenueMap')}</p>
              )}
            </div>
          )}

          <footer className="place-detail-footer">
            <p className="place-detail-footer-notice">{t('detail', 'footerNotice')}</p>
          </footer>
        </article>
      </div>
    </div>
  );
}
