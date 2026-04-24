import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
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
function FullImageCard({ item, type, t }) {
  const imgSrc = item.image ? getPlaceImageUrl(item.image) : null;
  const isFree = !item.price || (item.price != null && Number(item.price) === 0);
  const priceLabel = item.priceDisplay || (isFree ? 'Free' : `$${item.price}`);
  
  // Date formatting for events
  const dateObj = item.startDate ? new Date(item.startDate) : null;
  const dayNum = dateObj ? dateObj.toLocaleDateString('en-US', { day: '2-digit' }) : '';
  const monthStr = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '';
  const weekday = dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'short' }) : '';

  return (
    <Link 
      to={`/${type === 'event' ? 'event' : 'tour'}/${item.id}`}
      className="activities-hub-card-link"
      style={{
        display: 'block', textDecoration: 'none', width: '100%',
        height: '420px', position: 'relative',
        borderRadius: '24px', overflow: 'hidden',
        background: '#f1f5f9',
        boxShadow: 'var(--shadow-card)',
        transition: 'transform 0.4s cubic-bezier(0.2, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.2, 1, 0.3, 1)',
      }}
    >
      {/* Media Background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {imgSrc ? (
          <img src={imgSrc} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ 
            width: '100%', height: '100%', 
            background: type === 'event' ? 'linear-gradient(135deg, #0d9488, #115e59)' : 'linear-gradient(135deg, #0ea5e9, #0369a1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon name={type === 'event' ? 'calendar' : 'compass'} size={64} style={{ color: 'rgba(255,255,255,0.15)' }} />
          </div>
        )}
        {/* Bottom-heavy gradient for readability */}
        <div style={{ 
          position: 'absolute', inset: 0, 
          background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 45%, transparent 80%)' 
        }} />
      </div>

      {/* Floating Badges */}
      <div style={{ position: 'relative', zIndex: 2, padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: '#fff', fontSize: '9px', fontWeight: 800,
          padding: '5px 12px', borderRadius: '20px', letterSpacing: '0.12em', textTransform: 'uppercase'
        }}>
          {item.category || (type === 'event' ? 'Event' : 'Tour')}
        </span>
        <span style={{
          background: '#fff', color: '#000',
          fontSize: '11px', fontWeight: 900,
          padding: '5px 14px', borderRadius: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          {priceLabel}
        </span>
      </div>

      {/* Floating Date (for Events) */}
      {type === 'event' && dayNum && (
        <div style={{
          position: 'absolute', top: '65px', left: '18px', zIndex: 2,
          background: '#fff', borderRadius: '14px', padding: '10px 14px',
          textAlign: 'center', boxShadow: 'var(--shadow-card)',
          minWidth: '58px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.05em', marginBottom: '2px' }}>{monthStr}</div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#000', lineHeight: 1 }}>{dayNum}</div>
        </div>
      )}

      {/* Bottom Content Area */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
        padding: '24px 20px',
        display: 'flex', flexDirection: 'column', gap: '14px'
      }}>
        <div>
          <h3 style={{
            margin: '0 0 8px', fontSize: '19px', fontWeight: 800, color: '#fff',
            lineHeight: 1.2, letterSpacing: '-0.01em',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>
            {item.name}
          </h3>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            {type === 'event' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                  <Icon name="map-pin" size={14} style={{ color: '#fff' }} />
                  <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.location || 'Tripoli'}</span>
                </div>
                {weekday && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
                    <Icon name="clock" size={14} />
                    <span>{weekday}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {item.rating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'flex', color: '#fbbf24' }}>
                      {[...Array(5)].map((_, i) => (
                        <Icon key={i} name="star" size={12} style={{ opacity: i < Math.floor(Number(item.rating)) ? 1 : 0.4 }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{item.rating}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
                  <Icon name="clock" size={14} />
                  <span>{item.duration || 'Full day'}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
           <span style={{ 
             background: 'rgba(255,255,255,0.18)', color: '#fff',
             fontSize: '12px', fontWeight: 800, padding: '10px 18px', borderRadius: '12px',
             display: 'flex', alignItems: 'center', gap: '8px',
             backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
             border: '1px solid rgba(255,255,255,0.2)',
           }}>
             {type === 'event' ? 'Event Details' : 'Tour Details'}
             <Icon name="arrow_forward" size={15} />
           </span>
        </div>
      </div>
    </Link>
  );
}

/* ─── Mobile Date Strip ─── */
function MobileDateStrip({ selectedDate, onChange, events = [], eventDays = new Set() }) {
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
      display: 'flex', gap: '10px', overflowX: 'auto', padding: '12px 4px 20px',
      margin: '0 -20px', paddingLeft: '20px', paddingRight: '20px',
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
        All
      </button>
      {days.map(d => {
        const ymd = d.toISOString().split('T')[0];
        const active = selectedDate === ymd;
        const hasEvents = eventDays instanceof Set ? eventDays.has(ymd) : false;
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dateNum = d.getDate();
        const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
        
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

  if (isMobile) return null; // Mobile uses DateStrip

  const display = selectedDate 
    ? new Date(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : label;

  return (
    <div className="date-picker-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
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
        <div style={{ 
          position: 'absolute', top: '100%', right: 0, zIndex: 100, marginTop: '12px',
          background: '#fff', borderRadius: '24px', boxShadow: '0 15px 45px rgba(0,0,0,0.22)',
          padding: '8px', border: '1px solid rgba(0,0,0,0.06)'
        }}>
          <DateRangeCalendar 
            startDate={selectedDate}
            endDate={selectedDate}
            onChange={(s) => { onChange(s); setOpen(false); }}
            showHint={false}
            className="calendar--large"
          />
        </div>
      )}
    </div>
  );
}

/* ─── Mobile Hook ─── */
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

export default function ActivitiesHub() {
  const { t, lang } = useLanguage();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'experiences';
  const isMobile = useMobile();

  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const [tours, setTours] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [expQuery, setExpQuery] = useState('');
  const [expDifficulty, setExpDifficulty] = useState('');
  const [expDuration, setExpDuration] = useState('');
  const [expSort, setExpSort] = useState('default');
  const [expDate, setExpDate] = useState(null);

  const [evtQuery, setEvtQuery] = useState('');
  const [evtCategory, setEvtCategory] = useState('');
  const [evtStatus, setEvtStatus] = useState('');
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

  const eventDays = useMemo(() => {
    const set = new Set();
    const all = [...events, ...tours];
    all.forEach(e => {
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
  }, [events, tours]);

  const expFiltersActive = Boolean(expQuery.trim() || expDifficulty || (expDuration && expDuration !== 'any') || expSort !== 'default' || expDate);
  const evtFiltersActive = Boolean(evtQuery.trim() || evtCategory || evtStatus || evtSort !== 'dateDesc' || evtDate);

  const clearExperiences = useCallback(() => {
    setExpQuery('');
    setExpDifficulty('');
    setExpDuration('');
    setExpSort('default');
    setExpDate(null);
  }, []);

  const clearEvents = useCallback(() => {
    setEvtQuery('');
    setEvtCategory('');
    setEvtStatus('');
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
        <div className="activities-hub-layout">
          {!isMobile && (
            <aside className="activities-hub-sidebar">
              <div className="activities-hub-sidebar-sticky">
                <div className="activities-hub-sidebar-section">
                  <h3 className="activities-hub-sidebar-title">{t('home', 'filterByDate') || 'Pick Date'}</h3>
                  <DateRangeCalendar 
                    startDate={tab === 'events' ? evtDate : expDate}
                    endDate={tab === 'events' ? evtDate : expDate}
                    onChange={(s) => tab === 'events' ? setEvtDate(s) : setExpDate(s)}
                    showHint={false}
                    className="calendar--sidebar"
                    specialDays={Array.from(eventDays)}
                  />
                </div>
                
                <div className="activities-hub-sidebar-section">
                  <h3 className="activities-hub-sidebar-title">
                    {tab === 'events' ? t('home', 'activitiesHubCategory') : t('home', 'activitiesHubDifficulty')}
                  </h3>
                  {tab === 'events' ? (
                    <select
                      className="activities-hub-select activities-hub-select--sidebar"
                      value={evtCategory}
                      onChange={(e) => setEvtCategory(e.target.value)}
                    >
                      <option value="">{t('home', 'activitiesHubCategoryAll')}</option>
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
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
                  )}
                </div>

                {tab === 'events' ? (
                  <div className="activities-hub-sidebar-section">
                    <h3 className="activities-hub-sidebar-title">{t('home', 'activitiesHubStatus')}</h3>
                    <select
                      className="activities-hub-select activities-hub-select--sidebar"
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
                  anyTourHasDurationHours && (
                    <div className="activities-hub-sidebar-section">
                      <h3 className="activities-hub-sidebar-title">{t('home', 'activitiesHubDuration')}</h3>
                      <select
                        className="activities-hub-select activities-hub-select--sidebar"
                        value={expDuration}
                        onChange={(e) => setExpDuration(e.target.value)}
                      >
                        <option value="">{t('home', 'activitiesHubDurationAll')}</option>
                        <option value="short">{t('home', 'activitiesHubDurationShort')}</option>
                        <option value="half">{t('home', 'activitiesHubDurationHalf')}</option>
                        <option value="full">{t('home', 'activitiesHubDurationFull')}</option>
                      </select>
                    </div>
                  )
                )}

                <div className="activities-hub-sidebar-section" style={{ marginTop: 'auto' }}>
                  <button 
                    type="button" 
                    className="activities-hub-clear activities-hub-clear--sidebar" 
                    onClick={tab === 'events' ? clearEvents : clearExperiences}
                    disabled={tab === 'events' ? !evtFiltersActive : !expFiltersActive}
                  >
                    <Icon name="history" size={18} />
                    {t('home', 'activitiesHubClear')}
                  </button>
                </div>
              </div>
            </aside>
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
                          <>
                            <option value="durationAsc">{t('home', 'activitiesHubSortDurationAsc')}</option>
                            <option value="durationDesc">{t('home', 'activitiesHubSortDurationDesc')}</option>
                          </>
                        )}
                        <option value="priceAsc">{t('home', 'activitiesHubSortPriceAsc')}</option>
                        <option value="ratingDesc">{t('home', 'activitiesHubSortRating')}</option>
                      </select>
                      
                      {isMobile && (
                        <DatePickerFilter 
                          selectedDate={expDate} 
                          onChange={setExpDate} 
                          label={t('home', 'filterByDate') || 'Pick Date'} 
                          isMobile={isMobile}
                        />
                      )}
                    </div>
                  </div>
                </header>

                {isMobile && (
                  <MobileDateStrip selectedDate={expDate} onChange={setExpDate} events={tours} eventDays={eventDays} />
                )}

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
                  <div className="vd-grid vd-grid--3 activities-hub-grid">
                    {filteredTours.map((tour) => (
                      <FullImageCard key={tour.id} item={tour} type="experience" t={t} />
                    ))}
                  </div>
                )}
              </section>
            ) : tab === 'calendar' ? (
              <CalendarPanel events={events} tours={tours} t={t} />
            ) : (
              <section className="activities-hub-panel" aria-labelledby="hub-events-heading">
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
                        <option value="dateDesc">{t('home', 'activitiesHubSortDateDesc')}</option>
                        <option value="dateAsc">{t('home', 'activitiesHubSortDateAsc')}</option>
                        <option value="name">{t('home', 'activitiesHubSortName')}</option>
                      </select>

                      {isMobile && (
                        <DatePickerFilter 
                          selectedDate={evtDate} 
                          onChange={setEvtDate} 
                          label={t('home', 'filterByDate') || 'Pick Date'} 
                          isMobile={isMobile}
                        />
                      )}
                    </div>
                  </div>
                </header>

                {isMobile && (
                  <MobileDateStrip selectedDate={evtDate} onChange={setEvtDate} events={events} eventDays={eventDays} />
                )}

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
                  <div className="vd-grid vd-grid--3 activities-hub-grid">
                    {filteredEvents.map((event) => (
                      <FullImageCard key={event.id} item={event} type="event" t={t} />
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
