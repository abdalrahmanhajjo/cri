import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import { translateDynamicField } from '../i18n/translations';
import Icon from '../components/Icon';
import './Explore.css';
import './Events.css';
import './ActivitiesHub.css';
import { DateRangeCalendar } from '../components/Calendar';

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

/* ─── Premium Full-Image Card (Adapted for Activities Grid) ──────────────── */
function FullImageCard({ item, type }) {
  const { t, lang } = useLanguage();
  const imgSrc = item.image ? getPlaceImageUrl(item.image) : null;
  const isFree = !item.price || (item.price != null && Number(item.price) === 0);
  const priceLabel = item.priceDisplay || (isFree ? t('home', 'free') : `$${item.price}`);
  
  // Date formatting for events
  const dateObj = item.startDate ? new Date(item.startDate) : null;
  const dayNum = dateObj ? dateObj.toLocaleDateString(lang, { day: '2-digit' }) : '';
  const monthStr = dateObj ? dateObj.toLocaleDateString(lang, { month: 'short' }).toUpperCase() : '';
  const weekday = dateObj ? dateObj.toLocaleDateString(lang, { weekday: 'short' }) : '';

  return (
    <Link 
      to={`/${type === 'event' ? 'event' : 'tour'}/${item.id}`}
      className={`activities-hub-card activities-hub-card--${type}`}
    >
      <div className="activities-hub-card-media">
        {imgSrc ? (
          <img src={imgSrc} alt="" className="activities-hub-card-img" loading="lazy" />
        ) : (
          <div className="activities-hub-card-fallback">
            <Icon name={type === 'event' ? 'calendar' : 'compass'} size={64} style={{ color: 'rgba(255,255,255,0.15)' }} />
          </div>
        )}
        <div className="activities-hub-card-scrim" />
      </div>

      <div className="activities-hub-card-badge-row">
        <span className="activities-hub-card-category">
          {item.category || (type === 'event' ? 'Event' : 'Tour')}
        </span>
        <span className="activities-hub-card-price">
          {priceLabel}
        </span>
      </div>

      {type === 'event' && dayNum && (
        <div className="activities-hub-card-date">
          <div className="activities-hub-card-month">{monthStr}</div>
          <div className="activities-hub-card-day">{dayNum}</div>
        </div>
      )}

      <div className="activities-hub-card-content">
        <div>
          <h3 className="activities-hub-card-title">
            {translateDynamicField(item, 'name', lang)}
          </h3>

          <div className="activities-hub-card-meta">
            {type === 'event' ? (
              <>
                <div className="activities-hub-card-meta-item">
                  <Icon name="map-pin" size={14} />
                  <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {translateDynamicField(item, 'location', lang) || 'Tripoli'}
                  </span>
                </div>
                {weekday && (
                  <div className="activities-hub-card-meta-item">
                    <Icon name="clock" size={14} />
                    <span>{weekday}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="activities-hub-card-meta-item">
                  <Icon name="clock" size={14} />
                  <span>{item.duration || 'Full day'}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="activities-hub-card-btn">
           {type === 'event' ? t('home', 'eventDetails') : t('home', 'tourDetails')}
           <Icon name="arrow_forward" size={15} />
        </div>
      </div>
    </Link>
  );
}

/* ─── Mobile Date Strip ─── */
function MobileDateStrip({ selectedDate, onChange, events = [], eventDays = new Set() }) {
  const { lang, t } = useLanguage();
  const days = useMemo(() => {
    const arr = [];
    const today = new Date();
    // Start from today, show 30 days
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  return (
    <div className="activities-hub-mobile-datestrip" style={{
      display: 'flex', gap: '10px', overflowX: 'auto', padding: '12px 0 20px',
      margin: '0', 
      scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch'
    }}>
      <button
        onClick={() => onChange(null)}
        style={{
          flexShrink: 0, padding: '8px 20px', borderRadius: '16px', 
          border: '1.5px solid',
          borderColor: !selectedDate ? 'var(--color-primary)' : 'var(--color-border)',
          background: !selectedDate ? 'var(--color-primary)' : 'var(--color-surface)',
          color: !selectedDate ? '#fff' : 'var(--color-text-primary)',
          fontSize: '13px', fontWeight: 800, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: !selectedDate ? '0 8px 20px rgba(13, 148, 136, 0.25)' : 'none'
        }}
      >
        {t('home', 'activitiesHubAll')}
      </button>
      {days.map(d => {
        const ymd = d.toISOString().split('T')[0];
        const active = selectedDate === ymd;
        const hasEvents = eventDays instanceof Set ? eventDays.has(ymd) : false;
        const dayName = d.toLocaleDateString(lang, { weekday: 'short' });
        const dateNum = d.getDate();
        const monthShort = d.toLocaleDateString(lang, { month: 'short' });
        
        return (
          <button
            key={ymd}
            onClick={() => onChange(active ? null : ymd)}
            style={{
              flexShrink: 0, padding: '8px 0', borderRadius: '16px', 
              border: '1.5px solid',
              borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
              background: active ? 'var(--color-primary)' : 'var(--color-surface)',
              color: active ? '#fff' : 'var(--color-text-primary)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minWidth: '58px', height: '64px', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: active ? '0 10px 24px rgba(13, 148, 136, 0.3)' : 'none',
              transform: active ? 'scale(1.05)' : 'none',
              position: 'relative'
            }}
          >
            <span style={{ fontSize: '9px', fontWeight: 800, opacity: active ? 0.9 : 0.5, textTransform: 'uppercase', lineHeight: 1 }}>{dayName}</span>
            <span style={{ fontSize: '20px', fontWeight: 900, lineHeight: 1.1, marginTop: '2px' }}>{dateNum}</span>
            <span style={{ fontSize: '8px', fontWeight: 700, opacity: 0.5, marginTop: '1px' }}>{monthShort}</span>
            
            {hasEvents && !active && (
              <div style={{
                position: 'absolute', bottom: '6px', width: '4px', height: '4px',
                borderRadius: '50%', background: 'var(--color-primary)',
                boxShadow: '0 0 4px var(--color-primary)'
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Date Picker Dropdown ─── */
function DatePickerFilter({ selectedDate, onChange, label, isMobile }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const clickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [open]);

  // On mobile, we still allow it so users can pick any date via the calendar
  // if (isMobile) return null; 

  const display = selectedDate 
    ? new Date(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : label;

  return (
    <div className="date-picker-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
      {isMobile && open && (
        <div 
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} 
        />
      )}
      <button 
        type="button"
        className={`activities-hub-select ${selectedDate ? 'activities-hub-select--active' : ''}`}
        onClick={() => setOpen(!open)}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px',
          background: selectedDate ? 'var(--color-primary-light, #f0fdfa)' : '#fff',
          borderColor: selectedDate ? 'var(--color-primary)' : 'var(--color-border)',
          color: selectedDate ? 'var(--color-primary-dark)' : 'inherit',
          padding: '0 18px', fontWeight: 700, borderRadius: '12px',
          height: '48px', fontSize: '15px'
        }}
      >
        <Icon name="calendar" size={18} />
        <span style={{ flex: 1, textAlign: 'left' }}>{display}</span>
        {selectedDate ? (
          <Icon 
            name="close" 
            size={14} 
            onClick={(e) => { e.stopPropagation(); onChange(null); }} 
            style={{ cursor: 'pointer', opacity: 0.6 }} 
          />
        ) : (
          <Icon name="expand_more" size={14} style={{ opacity: 0.5 }} />
        )}
      </button>

      {open && (
        <div style={isMobile ? {
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 1000, width: '90%', maxWidth: '340px',
          background: '#fff', borderRadius: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          padding: '16px', border: '1px solid rgba(0,0,0,0.1)'
        } : { 
          position: 'absolute', top: '100%', right: 0, zIndex: 100, marginTop: '12px',
          background: '#fff', borderRadius: '24px', boxShadow: '0 15px 45px rgba(0,0,0,0.22)',
          padding: '8px', border: '1px solid rgba(0,0,0,0.06)'
        }}>
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 8px' }}>
              <span style={{ fontWeight: 800, fontSize: '16px' }}>{label}</span>
              <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', padding: '4px' }}>
                <Icon name="close" size={20} />
              </button>
            </div>
          )}
          <DateRangeCalendar 
            startDate={selectedDate}
            endDate={selectedDate}
            onChange={(s) => { onChange(s); setOpen(false); }}
            showHint={false}
            isRange={false}
            className="calendar--large"
          />
        </div>
      )}
    </div>
  );
}

/* ─── Layout Hooks ─── */
function useMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 767 : false
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

function useHubDesktop() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1240 : false
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1240px)');
    const handler = (e) => setDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return desktop;
}

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

  const anyTourHasDifficulty = useMemo(() => tours.some(x => x.difficulty), [tours]);

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

    if (expDate) {
      // For tours, we assume all are available daily for now,
      // but we could filter by actual schedule if it existed.
      // This acts as a "What can I do on this date?" filter.
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
  }, [tours, expQuery, expDifficulty, expDuration, expSort, expDate, collator]);

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
      <header className="activities-hub-hero">
        <div className="vd-container activities-hub-hero-inner">
          <nav className="activities-hub-tabs" aria-label={t('nav', 'activitiesHubTabsLabel')}>
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
            <Link
              to="/activities?tab=experiences"
              replace
              className={`activities-hub-tab ${tab === 'experiences' ? 'activities-hub-tab--active' : ''}`}
              aria-current={tab === 'experiences' ? 'page' : undefined}
            >
              <Icon name="hiking" size={22} aria-hidden />
              <span className="activities-hub-tab-label">{t('nav', 'activitiesHubNav')}</span>
              <span className="activities-hub-tab-count" aria-hidden="true">
                {counts.tours}
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
        <div className="activities-hub-layout">
            <aside className={`activities-hub-sidebar ${showEventsHubView ? 'activities-hub-sidebar--hub' : ''}`}>
              <div className="activities-hub-sidebar-sticky">
                {tab === 'experiences' ? (
                  <div className="activities-hub-sidebar-section">
                    <h3 className="activities-hub-sidebar-title">
                      {t('home', 'activitiesHubCategory')}
                    </h3>
                    <div className="activities-hub-category-list">
                      {experienceCategories.map((cat) => (
                        <button
                          key={cat.id}
                          className={`activities-hub-category-btn ${expCategory === cat.slug ? 'activities-hub-category-btn--active' : ''}`}
                          onClick={() => setExpCategory(expCategory === cat.slug ? '' : cat.slug)}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {!showEventsHubView && (
                      <div className="activities-hub-sidebar-section">
                        <h3 className="activities-hub-sidebar-title">{t('home', 'filterByDate') || 'Pick Date'}</h3>
                        <DateRangeCalendar 
                          startDate={evtDate}
                          endDate={evtDate}
                          onChange={(s) => setEvtDate(s)}
                          showHint={false}
                          isRange={false}
                          className="calendar--sidebar"
                          specialDays={Array.from(eventDays)}
                        />
                      </div>
                    )}
                    <div className={showEventsHubView ? 'event-sidebar-section' : 'activities-hub-sidebar-section'}>
                      <h3 className={showEventsHubView ? 'event-sidebar-label' : 'activities-hub-sidebar-title'}>
                        {t('home', 'activitiesHubCategory')}
                      </h3>
                      <select
                        className={showEventsHubView ? 'event-sidebar-select' : 'activities-hub-select activities-hub-select--sidebar'}
                        value={evtCategory}
                        onChange={(e) => setEvtCategory(e.target.value)}
                      >
                        <option value="">{t('home', 'activitiesHubCategoryAll')}</option>
                        {categoryOptions.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {tab === 'events' ? (
                  <div className={showEventsHubView ? 'event-sidebar-section' : 'activities-hub-sidebar-section'}>
                    <h3 className={showEventsHubView ? 'event-sidebar-label' : 'activities-hub-sidebar-title'}>
                      {t('home', 'activitiesHubStatus')}
                    </h3>
                    <select
                      className={showEventsHubView ? 'event-sidebar-select' : 'activities-hub-select activities-hub-select--sidebar'}
                      value={evtStatus}
                      onChange={(e) => setEvtStatus(e.target.value)}
                    >
                      <option value="">{t('home', 'activitiesHubStatusAll')}</option>
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  difficultyOptions.length > 0 && (
                    <div className="activities-hub-sidebar-section">
                      <h3 className="activities-hub-sidebar-title">{t('home', 'activitiesHubDifficulty')}</h3>
                      <select
                        className="activities-hub-select activities-hub-select--sidebar"
                        value={expDifficulty}
                        onChange={(e) => setExpDifficulty(e.target.value)}
                      >
                        <option value="">{t('home', 'activitiesHubDifficultyAll')}</option>
                        {difficultyOptions.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  )
                )}

                {(tab === 'events' || anyTourHasDurationHours) && (
                  <div className={showEventsHubView ? 'event-sidebar-section' : 'activities-hub-sidebar-section'}>
                    <h3 className={showEventsHubView ? 'event-sidebar-label' : 'activities-hub-sidebar-title'}>
                      {t('home', 'activitiesHubDuration')}
                    </h3>
                    <select
                      className={showEventsHubView ? 'event-sidebar-select' : 'activities-hub-select activities-hub-select--sidebar'}
                      value={tab === 'events' ? evtDuration : expDuration}
                      onChange={(e) => tab === 'events' ? setEvtDuration(e.target.value) : setExpDuration(e.target.value)}
                    >
                      <option value="">{t('home', 'activitiesHubDurationAll')}</option>
                      <option value="short">{t('home', 'activitiesHubDurationShort')}</option>
                      <option value="half">{t('home', 'activitiesHubDurationHalf')}</option>
                      <option value="full">{t('home', 'activitiesHubDurationFull')}</option>
                    </select>
                  </div>
                )}

                <div className={showEventsHubView ? 'event-sidebar-section' : 'activities-hub-sidebar-section'} style={{ marginTop: 'auto' }}>
                  <button 
                    type="button" 
                    className={showEventsHubView ? 'event-sidebar-clear-link' : 'activities-hub-clear activities-hub-clear--sidebar'} 
                    onClick={tab === 'events' ? clearEvents : clearExperiences}
                    disabled={tab === 'events' ? !evtFiltersActive : !expFiltersActive}
                  >
                    {!showEventsHubView && <Icon name="history" size={18} />}
                    {t('home', 'activitiesHubClear')}
                  </button>
                </div>
              </div>
            </aside>

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
                    // Simple logic to count events for the currently viewed month (respecting filters)
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
                  <MobileDateStrip selectedDate={expDate} onChange={setExpDate} events={tours} eventDays={eventDays} />
                )}

                <p className="activities-hub-results-meta" aria-live="polite">
                  {(t('home', 'activitiesHubResultsOfTotal') || '{shown} of {total} shown')
                    .replace('{shown}', String(filteredTours.length))
                    .replace('{total}', String(tours.length))}
                </p>

                {tours.length === 0 ? (
                  <p className="vd-empty">{t('home', 'noTours')}</p>
                ) : filteredTours.length === 0 ? (
                  <p className="vd-empty">{t('home', 'activitiesHubNoMatches')}</p>
                ) : (
                  <div className="vd-grid vd-grid--3 activities-hub-grid">
                    {filteredTours.map((tour) => (
                      <FullImageCard key={tour.id} item={tour} type="experience" />
                    ))}
                  </div>
                )}
              </section>
            ) : tab === 'calendar' ? (
              <CalendarPanel events={events} tours={tours} t={t} />
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
                    <div className="event-summary-split">
                      <span className="event-summary-day">{evtDate ? new Date(evtDate).getDate() : new Date().getDate()}</span>
                      <div className="event-summary-monthyear">
                        <span className="event-summary-month">
                          {new Date(evtDate || Date.now()).toLocaleDateString(lang, { month: 'long' })}
                        </span>
                        <span className="event-summary-year">{new Date(evtDate || Date.now()).getFullYear()}</span>
                      </div>
                    </div>
                    <div className="event-summary-divider" />
                    <span className="event-summary-footer">
                      {filteredEvents.length === 1 
                        ? (t('home', 'oneEventScheduled') || '1 EVENT SCHEDULED') 
                        : (t('home', 'multipleEventsScheduled') || '{count} EVENTS SCHEDULED').replace('{count}', String(filteredEvents.length))}
                    </span>
                  </div>
                )}

                {isMobile && !showEventsHubView && (
                  <MobileDateStrip selectedDate={evtDate} onChange={setEvtDate} events={events} eventDays={eventDays} />
                )}

                {!showEventsHubView && (
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
                ) : (
                  <div className={`vd-grid ${showEventsHubView ? 'vd-grid--1' : 'vd-grid--3'} activities-hub-grid`}>
                    {filteredEvents.map((event) => (
                      <FullImageCard key={event.id} item={event} type="event" />
                    ))}
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
