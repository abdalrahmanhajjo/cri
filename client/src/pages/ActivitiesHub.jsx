import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import { translateDynamicField } from '../i18n/translations';
import Icon from '../components/Icon';
import './css/Explore.css';
import './css/Events.css';
import './css/ActivitiesHub.css';
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
  
  const startDateObj = item.startDate ? new Date(item.startDate) : null;
  const endDateObj = item.endDate ? new Date(item.endDate) : null;
  const dayNum = startDateObj ? startDateObj.toLocaleDateString(lang, { day: '2-digit' }) : '';
  const monthStr = startDateObj ? startDateObj.toLocaleDateString(lang, { month: 'short' }).toUpperCase() : '';
  
  let dateRangeStr = '';
  if (startDateObj) {
    const startDay = startDateObj.toLocaleDateString(lang, { day: 'numeric' });
    const startMonth = startDateObj.toLocaleDateString(lang, { month: 'short' }).toUpperCase();
    dateRangeStr = `${startDay} ${startMonth}`;
    if (endDateObj && endDateObj.getTime() !== startDateObj.getTime()) {
      const endDay = endDateObj.toLocaleDateString(lang, { day: 'numeric' });
      const endMonth = endDateObj.toLocaleDateString(lang, { month: 'short' }).toUpperCase();
      dateRangeStr += ` - ${endDay} ${endMonth}`;
    }
  }

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

      {type === 'event' && dateRangeStr && (
        <div className="activities-hub-card-date" style={{
          padding: '8px 14px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: '4px', borderRadius: '12px'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 900, color: '#000', textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
            {dateRangeStr}
          </span>
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
                {dateRangeStr && (
                  <div className="activities-hub-card-meta-item">
                    <Icon name="clock" size={14} />
                    <span>{dateRangeStr}</span>
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
function MobileDateStrip({ selectedDate, onChange, events = [], eventDays = new Set(), dayMetadata = {} }) {
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
      display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px 0 24px',
      margin: '0', 
      scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch'
    }}>
      <button
        onClick={() => onChange(null)}
        style={{
          flexShrink: 0, padding: '0 20px', borderRadius: '10px', 
          border: '1px solid',
          borderColor: !selectedDate ? 'var(--color-primary)' : 'var(--color-border)',
          background: !selectedDate ? 'var(--color-primary)' : 'transparent',
          color: !selectedDate ? '#fff' : 'var(--color-text-primary)',
          fontSize: '13px', fontWeight: 600, transition: 'all 0.2s ease',
          height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {t('home', 'activitiesHubAll')}
      </button>
      {days.map(d => {
        const ymd = d.toISOString().split('T')[0];
        const active = selectedDate === ymd;
        const eventNames = dayMetadata[ymd] || [];
        const eventCount = eventNames.length;
        const eventName = eventCount > 0 ? eventNames[0] : null;
        const hasMultiple = eventCount > 1;
        const dayName = d.toLocaleDateString(lang, { weekday: 'short' });
        const dateNum = d.getDate();
        const monthShort = d.toLocaleDateString(lang, { month: 'short' });

        return (
          <button
            key={ymd}
            onClick={() => onChange(active ? null : ymd)}
            style={{
              flexShrink: 0,
              padding: eventName ? '0 16px 0 12px' : '0 14px',
              borderRadius: '10px',
              border: hasMultiple && !active ? '1.5px solid var(--color-primary)' : '1px solid',
              borderColor: active
                ? 'var(--color-primary)'
                : hasMultiple
                ? 'var(--color-primary)'
                : 'var(--color-border)',
              background: active
                ? 'var(--color-primary)'
                : hasMultiple
                ? 'var(--color-primary-light, #f0fdfa)'
                : '#fff',
              color: active ? '#fff' : 'var(--color-text-primary)',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: eventName ? '12px' : '0',
              height: hasMultiple ? '58px' : '52px',
              transition: 'all 0.2s ease',
              position: 'relative',
              textAlign: 'left',
              boxShadow: hasMultiple && !active ? '0 2px 10px rgba(13,148,136,0.15)' : 'none',
            }}
          >
            {eventName ? (
              <>
                {/* Date column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '28px', position: 'relative' }}>
                  <span style={{ fontSize: '9px', fontWeight: 600, opacity: active ? 0.9 : 0.55, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {dayName}
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.1, marginTop: '1px', color: active ? '#fff' : hasMultiple ? 'var(--color-primary)' : 'inherit' }}>
                    {dateNum}
                  </span>
                  {/* Multi-event count badge */}
                  {hasMultiple && (
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-8px',
                      background: active ? 'rgba(255,255,255,0.9)' : 'var(--color-primary)',
                      color: active ? 'var(--color-primary)' : '#fff',
                      fontSize: '9px',
                      fontWeight: 900,
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      letterSpacing: '-0.5px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    }}>
                      {eventCount}
                    </span>
                  )}
                </div>

                <div style={{ width: '1px', height: '24px', background: active ? 'rgba(255,255,255,0.3)' : 'var(--color-border)' }} />

                {/* Event info column */}
                <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '130px' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: 700,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    color: active ? '#fff' : hasMultiple ? 'var(--color-primary-dark, #115e59)' : 'inherit',
                  }}>
                    {eventName}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 500, opacity: active ? 0.85 : 0.6, marginTop: '2px', color: active ? '#fff' : hasMultiple ? 'var(--color-primary)' : 'inherit' }}>
                    {hasMultiple ? `+${eventCount - 1} more · ${monthShort}` : `${monthShort} Event`}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px' }}>
                <span style={{ fontSize: '9px', fontWeight: 600, opacity: active ? 0.9 : 0.5, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{dayName}</span>
                <span style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.1, marginTop: '1px' }}>{dateNum}</span>
              </div>
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
  const [today] = useState(() => new Date());

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
                    {evtDate ? (
                      /* ── A specific date is selected ── */
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
                      /* ── No date selected — show all-events summary ── */
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
                  <MobileDateStrip selectedDate={evtDate} onChange={setEvtDate} events={events} eventDays={eventDays} dayMetadata={calendarDayMetadata} />
                )}

                {/* ── Multi-event horizontal reel (mobile OR desktop, day selected, 2+ events) ── */}
                {evtDate && filteredEvents.length > 1 && (isMobile ? !showEventsHubView : showEventsHubView) && (
                  <div style={{ margin: '0 0 8px' }}>
                    {/* Header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0 4px', marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: 'var(--color-primary)', color: '#fff',
                          fontSize: '11px', fontWeight: 900,
                          padding: '4px 10px', borderRadius: '20px',
                          letterSpacing: '0.04em'
                        }}>
                          {filteredEvents.length}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          events on {new Date(evtDate).toLocaleDateString(lang, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {isMobile && (
                        <button
                          onClick={() => setEvtDate(null)}
                          style={{
                            border: 'none', background: 'none', padding: '4px 8px',
                            fontSize: '12px', color: 'var(--color-text-tertiary)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Icon name="close" size={14} /> Clear
                        </button>
                      )}
                    </div>

                    {/* Horizontal scrollable reel */}
                    <div style={{
                      display: 'flex', gap: '16px', overflowX: 'auto',
                      padding: '4px 0 20px',
                      scrollbarWidth: 'none', msOverflowStyle: 'none',
                      WebkitOverflowScrolling: 'touch',
                    }}>
                      {filteredEvents.map((event) => {
                        const imgSrc = event.image ? getPlaceImageUrl(event.image) : null;
                        const isFree = !event.price || Number(event.price) === 0;
                        const priceLabel = event.priceDisplay || (isFree ? t('home', 'free') : `$${event.price}`);
                        const startDateObj = event.startDate ? new Date(event.startDate) : null;
                        const dateStr = startDateObj
                          ? startDateObj.toLocaleDateString(lang, { day: 'numeric', month: 'short' }).toUpperCase()
                          : '';
                        const cardW = showEventsHubView ? '260px' : '220px';
                        const cardH = showEventsHubView ? '320px' : '280px';
                        return (
                          <Link
                            key={event.id}
                            to={`/event/${event.id}`}
                            style={{
                              flexShrink: 0, width: cardW, height: cardH,
                              borderRadius: '20px', overflow: 'hidden',
                              position: 'relative', display: 'block',
                              textDecoration: 'none', background: '#111',
                              boxShadow: '0 6px 28px rgba(0,0,0,0.18)',
                              transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.25)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.18)'; }}
                          >
                            {imgSrc ? (
                              <img src={imgSrc} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                            ) : (
                              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#0d9488,#115e59)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon name="calendar_today" size={56} style={{ color: 'rgba(255,255,255,0.12)' }} />
                              </div>
                            )}
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.25) 50%, transparent 80%)' }} />
                            <div style={{ position: 'absolute', top: '14px', left: '14px', right: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 2 }}>
                              <span style={{
                                background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255,255,255,0.3)', color: '#fff',
                                fontSize: '9px', fontWeight: 800, padding: '4px 10px',
                                borderRadius: '20px', letterSpacing: '0.1em', textTransform: 'uppercase'
                              }}>
                                {event.category || 'Event'}
                              </span>
                              <span style={{ background: '#fff', color: '#000', fontSize: '10px', fontWeight: 900, padding: '4px 10px', borderRadius: '20px' }}>
                                {priceLabel}
                              </span>
                            </div>
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 16px', zIndex: 2 }}>
                              <h3 style={{
                                margin: '0 0 6px', fontSize: showEventsHubView ? '17px' : '15px',
                                fontWeight: 800, color: '#fff', lineHeight: 1.2,
                                display: '-webkit-box', WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical', overflow: 'hidden'
                              }}>
                                {event.name}
                              </h3>
                              {dateStr && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(255,255,255,0.75)' }}>
                                  <Icon name="schedule" size={12} /><span>{dateStr}</span>
                                </div>
                              )}
                              <div style={{
                                marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                padding: '8px 16px', borderRadius: '10px',
                                fontSize: '11px', fontWeight: 800, color: '#fff'
                              }}>
                                {t('home', 'eventDetails')}
                                <Icon name={lang === 'ar' ? 'arrow_back' : 'arrow_forward'} size={13} />
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!showEventsHubView && !(evtDate && filteredEvents.length > 1) && (
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
                ) : !(evtDate && filteredEvents.length > 1) && (
                  <div className="vd-grid vd-grid--3 activities-hub-grid">
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
