import { useEffect, useState, useCallback } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../api/client';
import './css/Business.css';

export function BusinessNavSections({ places, onNavClick }) {
  const afterNav = onNavClick || undefined;
  const { t } = useLanguage();
  return (
    <>
      <div className="business-nav-label">Menu</div>
      <NavLink
        to="/business"
        end
        onClick={afterNav}
        className={({ isActive }) => `business-nav-link${isActive ? ' active' : ''}`}
      >
        <svg className="business-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
        Dashboard
      </NavLink>
      <NavLink
        to="/business/sponsorship"
        onClick={afterNav}
        className={({ isActive }) => `business-nav-link${isActive ? ' active' : ''}`}
      >
        <svg className="business-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        {t('business', 'sponsorshipNav')}
      </NavLink>
      <NavLink
        to="/business/places"
        end
        onClick={afterNav}
        className={({ isActive }) => `business-nav-link${isActive ? ' active' : ''}`}
      >
        <svg className="business-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
        Feed
      </NavLink>

      {places.length > 0 && (
        <div className="business-nav-places">
          <div className="business-nav-label">Your places</div>
          {places.map((p) => (
            <NavLink
              key={p.id}
              to={`/business/places/${encodeURIComponent(p.id)}`}
              onClick={afterNav}
              className={({ isActive }) => `business-nav-link${isActive ? ' active' : ''}`}
              title={p.name || p.id}
            >
              <svg className="business-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="business-nav-place-name">{p.name || p.id}</span>
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}

export default function BusinessLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [me, setMe] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const refreshMe = useCallback(() => {
    return api.business
      .me()
      .then((m) => {
        setMe(m);
        setLoadErr(null);
        return m;
      })
      .catch((e) => {
        setLoadErr(e.message || 'Could not load your places');
        throw e;
      });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    document.title = 'Business — Visit Tripoli';
    let cancelled = false;
    api.business
      .me()
      .then((m) => {
        if (!cancelled) {
          setMe(m);
          setLoadErr(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e.message || 'Could not load your places');
      });
    return () => {
      cancelled = true;
      document.title = 'Visit Tripoli';
    };
  }, [user?.id]);

  const places = Array.isArray(me?.places) ? me.places : [];

  useEffect(() => {
    const id = window.setTimeout(() => setMobileNavOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    const prevDir = document.documentElement.dir;
    const prevLang = document.documentElement.lang;
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
    return () => {
      document.documentElement.dir = prevDir;
      document.documentElement.lang = prevLang;
    };
  }, []);

  const initials = (user?.name || user?.email || 'B')
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="business-shell" dir="ltr" lang="en">
      <a href="#business-main-content" className="business-skip">
        Skip to main content
      </a>
      <header className="business-topbar">
        <div className="business-topbar-start">
          <button
            type="button"
            className="business-mobile-menu-btn"
            aria-expanded={mobileNavOpen}
            aria-controls="business-mobile-nav"
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            <span className="business-visually-hidden">{mobileNavOpen ? 'Close menu' : 'Open menu'}</span>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileNavOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
          <Link to="/business" className="business-brand">
            <span className="business-brand-mark" aria-hidden="true">
              VT
            </span>
            <span className="business-brand-text">
              <span className="business-brand-title">Visit Tripoli</span>
              <span className="business-brand-sub">Business console</span>
            </span>
          </Link>
        </div>

        <div className="business-topbar-actions">
          <div className="business-user-block">
            <div className="business-user-avatar" aria-hidden="true">
              {initials}
            </div>
            <div className="business-user-meta">
              <span className="business-user-name">{user?.name || 'Account'}</span>
              <span className="business-user-email" title={user?.email || ''}>
                {user?.email || ''}
              </span>
            </div>
          </div>
          <Link to="/" className="business-btn business-btn--ghost">
            Public site
          </Link>
          <button type="button" className="business-btn business-btn--ghost" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="business-body">
        <aside className="business-sidebar" aria-label="Business navigation">
          <div className="business-sidebar-inner">
            <BusinessNavSections places={places} />
          </div>
        </aside>

        {mobileNavOpen && (
          <>
            <button
              type="button"
              className="business-mobile-backdrop"
              aria-label="Close menu"
              onClick={() => setMobileNavOpen(false)}
            />
            <div
              id="business-mobile-nav"
              className="business-mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Business navigation"
            >
              <div className="business-mobile-drawer-head">
                <span className="business-mobile-drawer-title">Menu</span>
                <button
                  type="button"
                  className="business-btn business-btn--ghost business-mobile-drawer-close"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="business-mobile-drawer-body">
                <BusinessNavSections places={places} onNavClick={() => setMobileNavOpen(false)} />
              </div>
            </div>
          </>
        )}

        <main id="business-main-content" className="business-main" tabIndex={-1}>
          {loadErr && (
            <div className="business-banner-error" role="alert">
              {loadErr}
            </div>
          )}
          <Outlet context={{ me, loadErr, refreshMe }} />
        </main>
      </div>
    </div>
  );
}
