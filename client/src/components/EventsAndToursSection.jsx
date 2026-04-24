import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPlaceImageUrl } from '../api/client';
import Icon from './Icon';

/* ─── Premium Full-Image Card ────────────────────────────── */
function FullImageCard({ item, type, t }) {
  const imgSrc = item.image ? getPlaceImageUrl(item.image) : null;
  const isFree = !item.price || Number(item.price) === 0;
  const priceLabel = item.priceDisplay || (isFree ? 'Free' : `$${item.price}`);
  
  // Date formatting for events
  const dateObj = item.startDate ? new Date(item.startDate) : null;
  const dayNum = dateObj ? dateObj.toLocaleDateString('en-US', { day: '2-digit' }) : '';
  const monthStr = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '';
  const weekday = dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'short' }) : '';

  return (
    <Link 
      to={`/${type === 'event' ? 'event' : 'tour'}/${item.id}`}
      style={{
        display: 'block', textDecoration: 'none', flexShrink: 0, width: '310px',
        height: '420px', position: 'relative',
        borderRadius: '24px', overflow: 'hidden',
        background: '#f1f5f9',
        transition: 'box-shadow 0.4s cubic-bezier(0.2, 1, 0.3, 1)',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
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
            <Icon name={type === 'event' ? 'calendar_today' : 'explore'} size={64} style={{ color: 'rgba(255,255,255,0.15)' }} />
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
                  <Icon name="location_on" size={14} style={{ color: '#fff' }} />
                  <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.location || 'Tripoli'}</span>
                </div>
                {weekday && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
                    <Icon name="schedule" size={14} />
                    <span>{weekday}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
                  <Icon name="schedule" size={14} />
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
             transition: 'background 0.2s',
           }}>
             {type === 'event' ? 'Event Details' : 'Tour Details'}
             <Icon name="arrow_forward" size={15} />
           </span>
        </div>
      </div>
    </Link>
  );
}

/* ─── Main Section Component ─────────────────────────────── */
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

export default function EventsAndToursSection({ events = [], tours = [], t }) {
  const [tab, setTab] = useState('events');
  const isMobile = useMobile();

  const hasEvents = events.length > 0;
  const hasTours = tours.length > 0;
  if (!hasEvents && !hasTours) return null;

  const activeTab = !hasEvents ? 'tours' : !hasTours ? 'events' : tab;
  const items = activeTab === 'events' ? events : tours;

  return (
    <section className="vd-section vd-events-tours" style={{ 
      background: 'var(--color-background)', 
      padding: isMobile ? '48px 0 64px' : '88px 0 100px', 
      overflow: 'hidden',
      borderBottom: '1px solid var(--color-border)'
    }}>
      <div className="vd-container">
        
        <header style={{ 
          marginBottom: isMobile ? '24px' : '40px',
          position: 'relative',
          paddingLeft: '24px',
          borderLeft: '4px solid var(--color-primary)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '16px' }}>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontSize: '10px', fontWeight: 800, color: 'var(--color-primary)', 
                letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px'
              }}>
                This Week in Tripoli
              </div>
              <h2 style={{ 
                margin: 0, fontFamily: 'var(--font-serif, Georgia, serif)',
                fontSize: 'clamp(28px, 5vw, 38px)', fontWeight: 800, color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em', lineHeight: 1.1
              }}>
                {activeTab === 'events' ? (t ? t('nav', 'eventsFestivals') : 'Events & Festivals') : (t ? t('nav', 'activitiesExperiences') : 'Exclusive Tours')}
              </h2>
            </div>

            <Link 
              to={activeTab === 'events' ? '/activities?tab=events' : '/activities'}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                textDecoration: 'none', color: 'var(--color-text-secondary)',
                fontSize: '13px', fontWeight: 800,
                padding: '8px 14px', borderRadius: '20px',
                background: 'var(--color-surface-variant)',
                border: '1px solid var(--color-border)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface-variant)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            >
              {isMobile ? 'All' : 'See all'}
              <Icon name="arrow_forward" size={14} />
            </Link>
          </div>

          {/* Premium Toggles below title on mobile */}
          {hasEvents && hasTours && (
            <div style={{ 
              display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.05)', 
              padding: '4px', borderRadius: '16px', marginTop: '16px',
              width: 'fit-content'
            }}>
              {[
                { key: 'events', label: 'Events', icon: 'calendar_month' },
                { key: 'tours', label: 'Tours', icon: 'explore' }
              ].map(tgl => (
                <button 
                  key={tgl.key}
                  onClick={() => setTab(tgl.key)}
                  style={{
                    padding: isMobile ? '8px 16px' : '10px 22px', borderRadius: '12px', border: 'none',
                    fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                    background: activeTab === tgl.key ? '#fff' : 'transparent',
                    color: activeTab === tgl.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    boxShadow: activeTab === tgl.key ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.3s ease',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Icon name={tgl.icon} size={14} />
                  {tgl.label}
                </button>
              ))}
            </div>
          )}
        </header>
      </div>

      {/* Card Reel - Full bleed but starts at container edge on desktop */}
      <div style={{ 
        display: 'flex', gap: '16px', overflowX: 'auto', 
        padding: isMobile 
          ? '4px 24px 32px' 
          : '4px calc(max(40px, (100vw - var(--main-content-max, 1320px)) / 2 + 28px)) 32px',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}>
        {items.map(item => (
          <FullImageCard key={item.id} item={item} type={activeTab === 'events' ? 'event' : 'tour'} t={t} />
        ))}
        
        {/* Compact Icon-Focused View All Card */}
        <Link 
          to={activeTab === 'events' ? '/activities?tab=events' : '/activities'}
          style={{
            flexShrink: 0, width: '130px', height: '420px',
            borderRadius: '24px',
            background: 'var(--color-surface-variant)',
            border: '2px dashed var(--color-border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none', color: 'var(--color-text-tertiary)',
            gap: '12px', transition: 'all 0.3s'
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-primary-light)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.background = 'var(--color-surface-variant)'; }}
        >
          <div style={{ 
            width: '40px', height: '40px', borderRadius: '50%', 
            background: '#fff', border: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <Icon name="arrow_forward" size={20} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textAlign: 'center', padding: '0 8px', textTransform: 'uppercase' }}>
            {activeTab === 'events' ? 'All Events' : 'All Tours'}
          </span>
        </Link>
      </div>
    </section>
  );
}
