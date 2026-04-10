import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import './Explore.css';
import './Events.css';
import './ActivitiesHub.css';

function normalizeHaystack(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function matchesQuery(obj, fields, qRaw) {
  const q = normalizeHaystack(qRaw.trim());
  if (!q) return true;
  const parts = fields.map((f) => (typeof f === 'function' ? f(obj) : obj[f]));
  const blob = normalizeHaystack(parts.filter((x) => x != null && x !== '').join(' '));
  return blob.includes(q);
}

function clipDescription(raw, maxLen = 110) {
  const s = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen).trim()}…`;
}

function TourCard({ tour }) {
  const img = getPlaceImageUrl(tour.image) || null;
  const tourDesc = clipDescription(tour.description, 100);
  return (
    <Link to={`/tour/${tour.id}`} className="vd-card vd-card--tour activities-hub-card">
      <div className="vd-card-media">
        {img ? <DeliveryImg url={img} preset="gridCard" alt="" /> : <span className="vd-card-fallback">Tour</span>}
        {tour.duration && <span className="vd-card-badge">{tour.duration}</span>}
      </div>
      <div className="vd-card-content">
        <h3 className="vd-card-title vd-card-title--dark">{tour.name}</h3>
        {tour.priceDisplay && <p className="vd-card-meta vd-card-price">{tour.priceDisplay}</p>}
        {tourDesc ? <p className="activities-hub-card-snippet">{tourDesc}</p> : null}
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
  const desc = clipDescription(event.description, 118);

  return (
    <Link to={`/event/${event.id}`} className="vd-card vd-card--event events-card activities-hub-card">
      <div className="vd-card-media">
        {img ? <DeliveryImg url={img} preset="gridCard" alt="" /> : <span className="vd-card-fallback">Event</span>}
        {status && <span className="events-status-pill events-status-pill--corner">{status}</span>}
        {date && <span className="vd-card-badge vd-card-date">{date}</span>}
      </div>
      <div className="vd-card-content events-card-content">
        <h3 className="vd-card-title vd-card-title--dark events-card-title">{event.name}</h3>
        {category && (
          <p className="events-card-category">
            <Icon name="event" size={16} /> {category}
          </p>
        )}
        {event.location && <p className="events-card-location">{event.location}</p>}
        {desc ? <p className="events-card-desc">{desc}</p> : null}
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

  const [expQuery, setExpQuery] = useState('');
  const [expDifficulty, setExpDifficulty] = useState('');
  const [expDuration, setExpDuration] = useState('');
  const [expSort, setExpSort] = useState('default');

  const [evtQuery, setEvtQuery] = useState('');
  const [evtCategory, setEvtCategory] = useState('');
  const [evtStatus, setEvtStatus] = useState('');
  const [evtSort, setEvtSort] = useState('dateDesc');

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

  const collator = useMemo(() => {
    try {
      return new Intl.Collator(lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en', { sensitivity: 'base' });
    } catch {
      return new Intl.Collator('en', { sensitivity: 'base' });
    }
  }, [lang]);

  const difficultyOptions = useMemo(() => {
    const set = new Set();
    tours.forEach((x) => {
      const d = String(x.difficulty ?? '').trim();
      if (d) set.add(d);
    });
    return [...set].sort((a, b) => collator.compare(a, b));
  }, [tours, collator]);

  const anyTourHasDurationHours = useMemo(
    () => tours.some((x) => x.durationHours != null && !Number.isNaN(Number(x.durationHours))),
    [tours]
  );

  const categoryOptions = useMemo(() => {
    const set = new Set();
    events.forEach((e) => {
      const c = String(e.category ?? '').trim();
      if (c) set.add(c);
    });
    return [...set].sort((a, b) => collator.compare(a, b));
  }, [events, collator]);

  const statusOptions = useMemo(() => {
    const set = new Set();
    events.forEach((e) => {
      const s = String(e.status ?? '').trim();
      if (s) set.add(s);
    });
    return [...set].sort((a, b) => collator.compare(a, b));
  }, [events, collator]);

  const filteredTours = useMemo(() => {
    let list = tours.filter((x) =>
      matchesQuery(x, ['name', 'duration', 'priceDisplay', 'badge', 'description', 'difficulty', 'locations', 'price'], expQuery)
    );

    if (expDifficulty) {
      const nd = normalizeHaystack(expDifficulty);
      list = list.filter((x) => normalizeHaystack(x.difficulty || '') === nd);
    }

    if (expDuration && expDuration !== 'any') {
      list = list.filter((x) => {
        const h = x.durationHours;
        if (h == null || Number.isNaN(Number(h))) return false;
        const n = Number(h);
        if (expDuration === 'short') return n <= 3;
        if (expDuration === 'half') return n > 3 && n <= 6;
        if (expDuration === 'full') return n > 6;
        return true;
      });
    }

    const out = [...list];
    if (expSort === 'name') out.sort((a, b) => collator.compare(a.name || '', b.name || ''));
    else if (expSort === 'durationAsc')
      out.sort((a, b) => (Number(a.durationHours) || 1e9) - (Number(b.durationHours) || 1e9));
    else if (expSort === 'durationDesc')
      out.sort((a, b) => (Number(b.durationHours) || -1e9) - (Number(a.durationHours) || -1e9));
    else if (expSort === 'priceAsc') out.sort((a, b) => (Number(a.price) || 1e9) - (Number(b.price) || 1e9));
    else if (expSort === 'ratingDesc') out.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));

    return out;
  }, [tours, expQuery, expDifficulty, expDuration, expSort, collator]);

  const filteredEvents = useMemo(() => {
    let list = events.filter((e) =>
      matchesQuery(e, ['name', 'category', 'location', 'organizer', 'priceDisplay', 'status', 'description', 'price'], evtQuery)
    );

    if (evtCategory) {
      const nc = normalizeHaystack(evtCategory);
      list = list.filter((e) => normalizeHaystack(e.category || '') === nc);
    }
    if (evtStatus) {
      const ns = normalizeHaystack(evtStatus);
      list = list.filter((e) => normalizeHaystack(e.status || '') === ns);
    }

    const out = [...list];
    if (evtSort === 'dateAsc')
      out.sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
    else if (evtSort === 'dateDesc')
      out.sort((a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
    else if (evtSort === 'name') out.sort((a, b) => collator.compare(a.name || '', b.name || ''));

    return out;
  }, [events, evtQuery, evtCategory, evtStatus, evtSort, collator]);

  const expFiltersActive = Boolean(expQuery.trim() || expDifficulty || (expDuration && expDuration !== 'any') || expSort !== 'default');
  const evtFiltersActive = Boolean(evtQuery.trim() || evtCategory || evtStatus || evtSort !== 'dateDesc');

  const clearExperiences = useCallback(() => {
    setExpQuery('');
    setExpDifficulty('');
    setExpDuration('');
    setExpSort('default');
  }, []);

  const clearEvents = useCallback(() => {
    setEvtQuery('');
    setEvtCategory('');
    setEvtStatus('');
    setEvtSort('dateDesc');
  }, []);

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
            <div className="activities-hub-intro-meta" aria-label={t('nav', 'activitiesHubTabsLabel')}>
              <span className="activities-hub-intro-pill">
                <Icon name="hiking" size={16} aria-hidden />
                {t('nav', 'activitiesExperiences')}: {counts.tours}
              </span>
              <span className="activities-hub-intro-pill">
                <Icon name="celebration" size={16} aria-hidden />
                {t('nav', 'eventsFestivals')}: {counts.events}
              </span>
              <Link to="/map" className="activities-hub-intro-link">
                {t('home', 'viewMap')} <Icon name="arrow_forward" size={16} />
              </Link>
            </div>
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

            <div className="activities-hub-toolbar" role="search">
              <label className="activities-hub-search">
                <Icon name="search" size={20} className="activities-hub-search-icon" aria-hidden />
                <input
                  type="search"
                  className="activities-hub-search-input"
                  placeholder={t('home', 'activitiesHubSearchTours')}
                  aria-label={t('home', 'activitiesHubSearchToursAria')}
                  value={expQuery}
                  onChange={(e) => setExpQuery(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className="activities-hub-filters">
                {difficultyOptions.length > 0 ? (
                  <select
                    className="activities-hub-select"
                    aria-label={t('home', 'activitiesHubDifficulty')}
                    value={expDifficulty}
                    onChange={(e) => setExpDifficulty(e.target.value)}
                  >
                    <option value="">{t('home', 'activitiesHubDifficultyAll')}</option>
                    {difficultyOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : null}
                {anyTourHasDurationHours ? (
                  <select
                    className="activities-hub-select"
                    aria-label={t('home', 'activitiesHubDuration')}
                    value={expDuration}
                    onChange={(e) => setExpDuration(e.target.value)}
                  >
                    <option value="">{t('home', 'activitiesHubDurationAll')}</option>
                    <option value="short">{t('home', 'activitiesHubDurationShort')}</option>
                    <option value="half">{t('home', 'activitiesHubDurationHalf')}</option>
                    <option value="full">{t('home', 'activitiesHubDurationFull')}</option>
                  </select>
                ) : null}
                <select
                  className="activities-hub-select"
                  aria-label={t('home', 'activitiesHubSort')}
                  value={expSort}
                  onChange={(e) => setExpSort(e.target.value)}
                >
                  <option value="default">{t('home', 'activitiesHubSortToursDefault')}</option>
                  <option value="name">{t('home', 'activitiesHubSortName')}</option>
                  {anyTourHasDurationHours ? (
                    <>
                      <option value="durationAsc">{t('home', 'activitiesHubSortDurationAsc')}</option>
                      <option value="durationDesc">{t('home', 'activitiesHubSortDurationDesc')}</option>
                    </>
                  ) : null}
                  <option value="priceAsc">{t('home', 'activitiesHubSortPriceAsc')}</option>
                  <option value="ratingDesc">{t('home', 'activitiesHubSortRating')}</option>
                </select>
                {expFiltersActive ? (
                  <button type="button" className="activities-hub-clear" onClick={clearExperiences}>
                    {t('home', 'activitiesHubClear')}
                  </button>
                ) : null}
              </div>
            </div>

            <p className="activities-hub-results-meta" aria-live="polite">
              {t('home', 'activitiesHubResultsOfTotal')
                .replace('{shown}', String(filteredTours.length))
                .replace('{total}', String(tours.length))}
            </p>

            {tours.length === 0 ? (
              <p className="vd-empty">{t('home', 'noTours')}</p>
            ) : filteredTours.length === 0 ? (
              <p className="vd-empty">{t('home', 'activitiesHubNoMatches')}</p>
            ) : (
              <div className="vd-grid vd-grid--4 activities-hub-grid">
                {filteredTours.map((tour) => (
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
            </div>

            <div className="activities-hub-toolbar" role="search">
              <label className="activities-hub-search">
                <Icon name="search" size={20} className="activities-hub-search-icon" aria-hidden />
                <input
                  type="search"
                  className="activities-hub-search-input"
                  placeholder={t('home', 'activitiesHubSearchEvents')}
                  aria-label={t('home', 'activitiesHubSearchEventsAria')}
                  value={evtQuery}
                  onChange={(e) => setEvtQuery(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className="activities-hub-filters">
                {categoryOptions.length > 0 ? (
                  <select
                    className="activities-hub-select"
                    aria-label={t('home', 'activitiesHubCategory')}
                    value={evtCategory}
                    onChange={(e) => setEvtCategory(e.target.value)}
                  >
                    <option value="">{t('home', 'activitiesHubCategoryAll')}</option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : null}
                {statusOptions.length > 0 ? (
                  <select
                    className="activities-hub-select"
                    aria-label={t('home', 'activitiesHubStatus')}
                    value={evtStatus}
                    onChange={(e) => setEvtStatus(e.target.value)}
                  >
                    <option value="">{t('home', 'activitiesHubStatusAll')}</option>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : null}
                <select
                  className="activities-hub-select"
                  aria-label={t('home', 'activitiesHubSort')}
                  value={evtSort}
                  onChange={(e) => setEvtSort(e.target.value)}
                >
                  <option value="dateDesc">{t('home', 'activitiesHubSortDateNew')}</option>
                  <option value="dateAsc">{t('home', 'activitiesHubSortDateOld')}</option>
                  <option value="name">{t('home', 'activitiesHubSortName')}</option>
                </select>
                {evtFiltersActive ? (
                  <button type="button" className="activities-hub-clear" onClick={clearEvents}>
                    {t('home', 'activitiesHubClear')}
                  </button>
                ) : null}
              </div>
            </div>

            <p className="activities-hub-results-meta" aria-live="polite">
              {t('home', 'activitiesHubResultsOfTotal')
                .replace('{shown}', String(filteredEvents.length))
                .replace('{total}', String(events.length))}
            </p>

            {events.length === 0 ? (
              <p className="vd-empty">{t('home', 'noEvents')}</p>
            ) : filteredEvents.length === 0 ? (
              <p className="vd-empty">{t('home', 'activitiesHubNoMatches')}</p>
            ) : (
              <div className="vd-grid vd-grid--4 activities-hub-grid activities-hub-events-grid">
                {filteredEvents.map((e) => (
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
