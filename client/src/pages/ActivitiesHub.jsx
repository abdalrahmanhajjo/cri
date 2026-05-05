import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import './css/Explore.css';
import './css/Events.css';
import './css/ActivitiesHub.css';
import { DateRangeCalendar } from '../components/Calendar';

// Modularized Components
import { ActivitiesHubHero } from '../components/activities/ActivitiesHubHero';
import { ActivitiesHubSidebar } from '../components/activities/ActivitiesHubSidebar';
import { ActivitiesHubGrid } from '../components/activities/ActivitiesHubGrid';
import { ActivitiesHubCard } from '../components/activities/ActivitiesHubCard';
import { 
  MobileDateStrip, 
  DatePickerFilter, 
  ActivitiesHubHorizontalReel 
} from '../components/activities/ActivitiesHubDateFilters';

// Hooks & Helpers
import { useMobile, useHubDesktop } from '../hooks/useActivitiesHubLayout';
import { 
  normalizeHaystack, 
  matchesQuery 
} from '../utils/activitiesHubHelpers';

export default function ActivitiesHub() {
  const { t, lang } = useLanguage();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'events';
  const isMobile = useMobile();
  const isHubDesktop = useHubDesktop();

  const showEventsHubView = tab === 'events' && isHubDesktop;

  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const [tours, setTours] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [expQuery, setExpQuery] = useState('');
  const [expCategory, setExpCategory] = useState('');
  const [expDifficulty, setExpDifficulty] = useState('');
  const [expDuration, setExpDuration] = useState('');
  const [expSort, setExpSort] = useState('default');
  const [expDate, setExpDate] = useState(null);

  const [evtQuery, setEvtQuery] = useState('');
  const [evtCategory, setEvtCategory] = useState('');
  const [evtStatus, setEvtStatus] = useState('');
  const [evtDuration, setEvtDuration] = useState('');
  const [evtSort, setEvtSort] = useState('dateDesc');
  const [evtDate, setEvtDate] = useState(null);

  // Default to today's events when first opening the events tab
  const initialDateSet = useRef(false);
  useEffect(() => {
    if (tab === 'events' && !evtDate && !initialDateSet.current) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setEvtDate(`${yyyy}-${mm}-${dd}`);
      initialDateSet.current = true;
    }
  }, [tab, evtDate]);

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
    document.title = `${title} | ${t('nav', 'visitTripoli')}`;
    return () => {
      document.title = 'Visit Tripoli';
    };
  }, [title, t]);

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

  const experienceCategories = useMemo(() => {
    const set = new Set();
    tours.forEach((x) => {
      const c = String(x.category ?? '').trim();
      if (c) set.add(c);
    });
    const list = [...set].sort((a, b) => collator.compare(a, b));
    return list.map(name => ({ id: name, name, slug: name }));
  }, [tours, collator]);

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

    if (expCategory) {
      const nc = normalizeHaystack(expCategory);
      list = list.filter((x) => normalizeHaystack(x.category || '') === nc);
    }

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
  }, [tours, expQuery, expCategory, expDifficulty, expDuration, expSort, collator]);

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

    if (evtDate) {
      list = list.filter((e) => {
        if (!e.startDate) return false;
        const startYMD = e.startDate.split('T')[0];
        const endYMD = (e.endDate || e.startDate).split('T')[0];
        return evtDate >= startYMD && evtDate <= endYMD;
      });
    }

    const out = [...list];
    if (evtSort === 'dateAsc')
      out.sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
    else if (evtSort === 'dateDesc')
      out.sort((a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
    else if (evtSort === 'name') out.sort((a, b) => collator.compare(a.name || '', b.name || ''));

    return out;
  }, [events, evtQuery, evtCategory, evtStatus, evtSort, evtDate, collator]);

  const calendarFilteredEvents = useMemo(() => {
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
    return list;
  }, [events, evtQuery, evtCategory, evtStatus]);

  const eventDays = useMemo(() => {
    const set = new Set();
    calendarFilteredEvents.forEach(e => {
      if (!e.startDate) return;
      const start = new Date(e.startDate);
      const end = e.endDate ? new Date(e.endDate) : start;
      const current = new Date(start);
      let safety = 0;
      while (current <= end && safety < 100) {
        set.add(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
        safety++;
      }
    });
    return set;
  }, [calendarFilteredEvents]);

  const calendarDayMetadata = useMemo(() => {
    const map = {};
    calendarFilteredEvents.forEach(e => {
      if (!e.startDate) return;
      const start = new Date(e.startDate);
      const end = e.endDate ? new Date(e.endDate) : start;
      const current = new Date(start);
      let safety = 0;
      while (current <= end && safety < 100) {
        const dStr = current.toISOString().split('T')[0];
        if (!map[dStr]) map[dStr] = [];
        if (!map[dStr].includes(e.name)) map[dStr].push(e.name);
        current.setDate(current.getDate() + 1);
        safety++;
      }
    });
    return map;
  }, [calendarFilteredEvents]);

  const expFiltersActive = Boolean(expQuery.trim() || expDifficulty || (expDuration && expDuration !== 'any') || expSort !== 'default' || expDate);
  const evtFiltersActive = Boolean(evtQuery.trim() || evtCategory || evtStatus || evtSort !== 'dateDesc' || evtDate);

  const clearExperiences = useCallback(() => {
    setExpQuery('');
    setExpCategory('');
    setExpDifficulty('');
    setExpDuration('');
    setExpSort('default');
    setExpDate(null);
  }, []);

  const clearEvents = useCallback(() => {
    setEvtQuery('');
    setEvtCategory('');
    setEvtStatus('');
    setEvtDuration('');
    setEvtSort('dateDesc');
    setEvtDate(null);
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
    <div className={`vd activities-hub ${tab === 'events' ? 'activities-hub--events' : 'activities-hub--experiences'} ${showEventsHubView ? 'activities-hub--events-hub-view' : ''}`}>
      <ActivitiesHubHero tab={tab} counts={counts} title={title} subtitle={subtitle} />

      <div className="vd-container activities-hub-body">
        <div className="activities-hub-layout">
          <ActivitiesHubSidebar 
            tab={tab}
            showEventsHubView={showEventsHubView}
            evtDate={evtDate}
            setEvtDate={setEvtDate}
            eventDays={eventDays}
            calendarDayMetadata={calendarDayMetadata}
            evtCategory={evtCategory}
            setEvtCategory={setEvtCategory}
            categoryOptions={categoryOptions}
            evtStatus={evtStatus}
            setEvtStatus={setEvtStatus}
            statusOptions={statusOptions}
            difficultyOptions={difficultyOptions}
            expDifficulty={expDifficulty}
            setExpDifficulty={setExpDifficulty}
            anyTourHasDurationHours={anyTourHasDurationHours}
            evtDuration={evtDuration}
            setEvtDuration={setEvtDuration}
            expDuration={expDuration}
            setExpDuration={setExpDuration}
            clearEvents={clearEvents}
            clearExperiences={clearExperiences}
            evtFiltersActive={evtFiltersActive}
            expFiltersActive={expFiltersActive}
            experienceCategories={experienceCategories}
            expCategory={expCategory}
            setExpCategory={setExpCategory}
          />

          {showEventsHubView && (
            <div className="activities-hub-calendar-col">
               <DateRangeCalendar 
                  startDate={evtDate}
                  endDate={evtDate}
                  onChange={(s) => setEvtDate(s)}
                  showHint={false}
                  isRange={false}
                  className="calendar--hub"
                  specialDays={Array.from(eventDays)}
                  dayMetadata={calendarDayMetadata}
                  renderHeader={({ month, year, goPrev, goNext, canPrev, canNext }) => {
                    const monthName = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' }).format(new Date(year, month));
                    const currentMonthEventsCount = calendarFilteredEvents.filter(ev => {
                      const d = new Date(ev.date || ev.startDate);
                      return d.getMonth() === month && d.getFullYear() === year;
                    }).length;

                    return (
                      <div className="calendar-header-custom">
                        <div className="calendar-header-top">
                          <button type="button" className="calendar-nav-btn" onClick={goPrev} disabled={!canPrev}>
                            <Icon name="chevron_left" size={20} />
                          </button>
                          <div className="calendar-header-monthyear">
                            <span className="calendar-header-month">{monthName}</span>
                            <span className="calendar-header-year">{year}</span>
                          </div>
                          <button type="button" className="calendar-nav-btn" onClick={goNext} disabled={!canNext}>
                            <Icon name="chevron_right" size={20} />
                          </button>
                        </div>
                        <div className="calendar-header-subtitle">
                          {currentMonthEventsCount} {t('home', 'eventsThisMonth') || 'EVENTS THIS MONTH'}
                        </div>
                        <div className="calendar-header-dots">
                          <span className="calendar-header-dot" />
                          <span className="calendar-header-dot" />
                          <span className="calendar-header-dot calendar-header-dot--active" />
                          <span className="calendar-header-dot" />
                          <span className="calendar-header-dot" />
                        </div>
                      </div>
                    );
                  }}
                />
            </div>
          )}

          <main className="activities-hub-main">
            {tab === 'experiences' ? (
              <section className="activities-hub-panel" aria-labelledby="hub-experiences-heading">
                <header className="activities-hub-panel-header">
                  <div className="activities-hub-panel-hgroup">
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
                      <select
                        className="activities-hub-select"
                        aria-label={t('home', 'activitiesHubSort')}
                        value={expSort}
                        onChange={(e) => setExpSort(e.target.value)}
                      >
                        <option value="default">{t('home', 'activitiesHubSortToursDefault')}</option>
                        <option value="name">{t('home', 'activitiesHubSortName')}</option>
                        {anyTourHasDurationHours && (
                          <option value="durationAsc">{t('home', 'activitiesHubSortDurationAsc')}</option>
                        )}
                        <option value="durationDesc">{t('home', 'activitiesHubSortDurationDesc') || 'Duration (Longest)'}</option>
                        <option value="priceAsc">{t('home', 'activitiesHubSortPriceAsc')}</option>
                        <option value="ratingDesc">{t('home', 'activitiesHubSortRating')}</option>
                      </select>
                      
                      {isMobile && (
                        <select
                          className="activities-hub-select"
                          value={expCategory}
                          onChange={(e) => setExpCategory(e.target.value)}
                        >
                          <option value="">{t('home', 'activitiesHubCategoryAll')}</option>
                          {experienceCategories.map((cat) => (
                            <option key={cat.id} value={cat.slug}>{cat.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </header>

                {isMobile && (
                  <MobileDateStrip 
                    selectedDate={expDate} 
                    onChange={setExpDate} 
                    t={t} 
                    lang={lang} 
                    dayMetadata={calendarDayMetadata} 
                  />
                )}

                <p className="activities-hub-results-meta" aria-live="polite">
                  {(t('home', 'activitiesHubResultsOfTotal') || '{shown} of {total} shown')
                    .replace('{shown}', String(filteredTours.length))
                    .replace('{total}', String(tours.length))}
                </p>

                <ActivitiesHubGrid items={filteredTours} type="experience" />
                {tours.length === 0 && <p className="vd-empty">{t('home', 'noTours')}</p>}
                {tours.length > 0 && filteredTours.length === 0 && (
                   <p className="vd-empty">{t('home', 'activitiesHubNoMatches')}</p>
                )}
              </section>
            ) : tab === 'calendar' ? (
              /* Fallback if CalendarPanel is defined elsewhere; if not, this will error in runtime as before */
              typeof CalendarPanel !== 'undefined' ? (
                <CalendarPanel events={events} tours={tours} t={t} />
              ) : (
                <p className="vd-empty">Calendar View Unavailable</p>
              )
            ) : (
              <section className={`activities-hub-panel ${showEventsHubView ? 'activities-hub-panel--hub' : ''}`} aria-labelledby="hub-events-heading">
                {!showEventsHubView && (
                  <header className="activities-hub-panel-header">
                    <div className="activities-hub-panel-hgroup">
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

                        {isMobile && (
                          <select
                            className="activities-hub-select"
                            value={evtCategory}
                            onChange={(e) => setEvtCategory(e.target.value)}
                          >
                            <option value="">{t('home', 'activitiesHubCategoryAll')}</option>
                            {categoryOptions.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </header>
                )}

                {showEventsHubView && (
                  <div className="event-summary-card">
                    {evtDate ? (
                      <>
                        <div className="event-summary-split">
                          <span className="event-summary-day">{new Date(evtDate).getDate()}</span>
                          <div className="event-summary-monthyear">
                            <span className="event-summary-month">
                              {new Date(evtDate).toLocaleDateString(lang, { month: 'long' }).toUpperCase()}
                            </span>
                            <span className="event-summary-year">{new Date(evtDate).getFullYear()}</span>
                          </div>
                        </div>
                        <div className="event-summary-divider" />
                        <span className="event-summary-footer">
                          {filteredEvents.length === 1
                            ? (t('home', 'oneEventScheduled') || '1 EVENT SCHEDULED')
                            : (t('home', 'multipleEventsScheduled') || '{count} EVENTS SCHEDULED').replace('{count}', String(filteredEvents.length))}
                        </span>
                        <button
                          onClick={() => setEvtDate(null)}
                          className="event-summary-clear-btn"
                          style={{
                            marginTop: '12px', border: 'none',
                            background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)',
                            fontSize: '11px', fontWeight: 700, padding: '6px 14px',
                            borderRadius: '20px', cursor: 'pointer', letterSpacing: '0.04em',
                            display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start',
                          }}
                        >
                          <Icon name="close" size={12} /> Clear date
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="event-summary-split" style={{ opacity: 0.6 }}>
                          <Icon name="celebration" size={40} style={{ color: '#fff' }} />
                        </div>
                        <div className="event-summary-divider" />
                        <span className="event-summary-footer">
                          {(t('home', 'multipleEventsScheduled') || '{count} EVENTS SCHEDULED').replace('{count}', String(filteredEvents.length))}
                        </span>
                        <span style={{
                          fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                          letterSpacing: '0.06em', marginTop: '4px', textTransform: 'uppercase'
                        }}>
                          {t('home', 'activitiesHubAll') || 'All dates'}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {isMobile && !showEventsHubView && (
                  <MobileDateStrip 
                    selectedDate={evtDate} 
                    onChange={setEvtDate} 
                    t={t} 
                    lang={lang} 
                    dayMetadata={calendarDayMetadata} 
                  />
                )}

                {filteredEvents.length > 1 && (isMobile ? !showEventsHubView : showEventsHubView) && (
                  <ActivitiesHubHorizontalReel 
                    filteredEvents={filteredEvents}
                    evtDate={evtDate}
                    lang={lang}
                    t={t}
                    showEventsHubView={showEventsHubView}
                    onClearDate={() => setEvtDate(null)}
                  />
                )}

                {!showEventsHubView && !(filteredEvents.length > 1) && (
                  <p className="activities-hub-results-meta" aria-live="polite">
                    {(t('home', 'activitiesHubResultsOfTotal') || '{shown} of {total} shown')
                      .replace('{shown}', String(filteredEvents.length))
                      .replace('{total}', String(events.length))}
                  </p>
                )}

                {events.length === 0 ? (
                  <p className="vd-empty">{t('home', 'noEvents')}</p>
                ) : filteredEvents.length === 0 ? (
                  <p className="vd-empty">{t('home', 'activitiesHubNoMatches')}</p>
                ) : !(filteredEvents.length > 1) && (
                  <ActivitiesHubGrid items={filteredEvents} type="event" />
                )}
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
