import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { getPlaceImageUrl } from '../../api/client';
import Icon from '../Icon';
import { DateRangeCalendar } from '../Calendar';

/* ─── Mobile Date Strip ─── */
export function MobileDateStrip({ selectedDate, onChange, t, lang, dayMetadata = {} }) {
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
export function DatePickerFilter({ selectedDate, onChange, label, isMobile }) {
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

/* ─── Horizontal Reel for Multi-events ─── */
export function ActivitiesHubHorizontalReel({ 
  filteredEvents, 
  evtDate, 
  lang, 
  t, 
  showEventsHubView, 
  onClearDate 
}) {
  return (
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
            {evtDate
              ? `events on ${new Date(evtDate).toLocaleDateString(lang, { month: 'short', day: 'numeric' })}`
              : `${filteredEvents.length} events`}
          </span>
        </div>
        {!showEventsHubView && (
          <button
            onClick={onClearDate}
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
  );
}
