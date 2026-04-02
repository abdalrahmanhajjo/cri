import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';
import BackToTop from './BackToTop';
import GlobalSearchBar from './GlobalSearchBar';
import { COMMUNITY_PATH, PLACES_DISCOVER_PATH, DINING_PATH, HOTELS_PATH } from '../utils/discoverPaths';
import './Layout.css';

const langLabels = { en: 'EN', ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', fr: 'FR' };
const AI_BANNER_DISMISSED_KEY = 'tripoli_ai_banner_dismissed';

export default function Layout() {
  const { user, logout } = useAuth();
  const { lang, setLanguage, t } = useLanguage();
  const { showToast } = useToast();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [aiBannerDismissed, setAiBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(AI_BANNER_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const themeActionLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  /** One-time banner after email verification (set from VerifyEmail via sessionStorage). */
  const [verifyWelcomeBanner, setVerifyWelcomeBanner] = useState(null);
  const langRef = useRef(null);
  const langDrawerRef = useRef(null);
  const isHome = location.pathname === '/';
  const isActivitiesHub = location.pathname === '/activities';
  const navActivitiesHubActive = isActivitiesHub;
  const isPlan = location.pathname === '/plan';
  const isCommunityHub =
    location.pathname === COMMUNITY_PATH || location.pathname.startsWith(`${COMMUNITY_PATH}/`);
  const isMapPage = location.pathname === '/map';
  const isPlaceDiscoverPage =
    location.pathname === PLACES_DISCOVER_PATH || location.pathname.startsWith(`${PLACES_DISCOVER_PATH}/`);
  const isDiningPage = location.pathname === DINING_PATH;
  const isHotelsPage = location.pathname === HOTELS_PATH;
  const isAboutTripoliPage = location.pathname === '/about-tripoli';
  const isAiPlannerPage = location.pathname === '/plan/ai';
  const diningGuideEnabled = settings?.diningGuide?.enabled !== false;
  const hotelsGuideEnabled = settings?.hotelsGuide?.enabled !== false;

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    showToast(t('feedback', 'signedOut'), 'info');
    navigate('/');
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!langOpen) return;
    const close = (e) => {
      const inDesktop = langRef.current && langRef.current.contains(e.target);
      const inDrawer = langDrawerRef.current && langDrawerRef.current.contains(e.target);
      if (!inDesktop && !inDrawer) setLangOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [langOpen]);

  /* Tablet / collapsed header: keep page from scrolling behind the drawer */
  const lockScroll = menuOpen || mobileSearchOpen;
  useEffect(() => {
    if (!lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lockScroll]);

  useEffect(() => {
    if (!user) return;
    try {
      const raw = sessionStorage.getItem('tripoli-welcome-after-verify');
      if (!raw) return;
      sessionStorage.removeItem('tripoli-welcome-after-verify');
      const data = JSON.parse(raw);
      if (!data || typeof data.at !== 'number' || Date.now() - data.at > 120000) return;
      setVerifyWelcomeBanner({
        name: (data.name && String(data.name).trim()) || user.name || 'there',
        emailSent: data.welcomeEmailSent === true,
      });
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  return (
    <div className="layout">
      <header id="site-header" className={`header header--vd ${menuOpen ? 'menu-open' : ''}`}>
        <div className="header-inner">
          <div className="header-row header-row--main">
            <button
              type="button"
              className="nav-toggle"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <span className="nav-toggle-bar" />
              <span className="nav-toggle-bar" />
              <span className="nav-toggle-bar" />
            </button>

            <Link to="/" className="logo-wrap" onClick={closeMenu}>
              <span className="logo-stack">
                <span className="logo-mark" aria-hidden="true">
                  <img src="/tripoli-lebanon-icon.svg" alt="" className="header-emblem-icon" width="40" height="40" />
                </span>
                <span className="logo">{settings.siteName?.trim() || t('nav', 'visitTripoli')}</span>
              </span>
              <span className="logo-tagline logo-tagline--brand">{t('nav', 'navBrandTagline')}</span>
            </Link>

            <div className="header-mobile-right">
              <button
                type="button"
                className="nav-icon nav-icon--search"
                onClick={() => {
                  setMobileSearchOpen(true);
                  closeMenu();
                }}
                aria-label={t('nav', 'search')}
                aria-expanded={mobileSearchOpen}
              >
                <Icon name="search" size={22} />
              </button>
              <Link to="/favourites" className="nav-icon" onClick={closeMenu} aria-label={t('nav', 'myFavourites')}><Icon name="favorite" size={22} /></Link>
              {user ? (
                <Link to="/profile" className="nav-icon nav-icon--profile" onClick={closeMenu} aria-label={t('nav', 'profile')}><Icon name="person" size={22} /></Link>
              ) : (
                <Link to="/login" className="nav-icon nav-icon--profile" onClick={closeMenu} aria-label={t('nav', 'signIn')}><Icon name="person" size={22} /></Link>
              )}
            </div>

            <nav className={`nav nav--vd nav--main ${menuOpen ? 'nav-open' : ''}`}>
              <Link to="/" className={`nav-link nav-link--home ${isHome ? 'nav-link--active' : ''}`} onClick={closeMenu}>{t('nav', 'home')}</Link>
              <Link
                to={PLACES_DISCOVER_PATH}
                className={`nav-link ${isPlaceDiscoverPage && !isDiningPage && !isHotelsPage ? 'nav-link--active' : ''}`}
                onClick={closeMenu}
              >
                {t('nav', 'discoverPlaces')}
              </Link>
              {diningGuideEnabled && (
                <Link
                  to={DINING_PATH}
                  className={`nav-link ${isDiningPage ? 'nav-link--active' : ''}`}
                  onClick={closeMenu}
                >
                  {t('nav', 'diningNav')}
                </Link>
              )}
              {hotelsGuideEnabled && (
                <Link
                  to={HOTELS_PATH}
                  className={`nav-link ${isHotelsPage ? 'nav-link--active' : ''}`}
                  onClick={closeMenu}
                >
                  {t('nav', 'hotelsNav')}
                </Link>
              )}
              <Link to="/map" className={`nav-link ${isMapPage ? 'nav-link--active' : ''}`} onClick={closeMenu}>
                {t('nav', 'viewMapNav')}
              </Link>
              <Link
                to={COMMUNITY_PATH}
                className={`nav-link ${isCommunityHub ? 'nav-link--active' : ''}`}
                onClick={closeMenu}
              >
                {t('nav', 'communityFeed')}
              </Link>
              <Link
                to="/activities"
                className={`nav-link ${navActivitiesHubActive ? 'nav-link--active' : ''}`}
                onClick={closeMenu}
              >
                {t('nav', 'activitiesHubNav')}
              </Link>
              <Link
                to="/about-tripoli"
                className={`nav-link ${isAboutTripoliPage ? 'nav-link--active' : ''}`}
                onClick={closeMenu}
              >
                {t('nav', 'megaAboutTripoli') || 'About Tripoli'}
              </Link>
              <Link to="/plan" className={`nav-link nav-link--plan ${isPlan ? 'nav-link--active' : ''}`} onClick={closeMenu}>
                {t('nav', 'planYourVisit')}
              </Link>
            </nav>

            <div className="header-meta">
              <button
                type="button"
                className="nav-icon nav-icon--theme-toggle"
                onClick={toggleTheme}
                aria-label={themeActionLabel}
                title={themeActionLabel}
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
              </button>
              <div className={`nav-lang-wrap ${langOpen ? 'nav-lang-wrap--open' : ''}`} ref={langRef}>
                <button
                  type="button"
                  className="nav-lang-trigger"
                  onClick={() => setLangOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={langOpen}
                  aria-label="Language"
                >
                  <span className="nav-lang-label">{langLabels[lang] || lang.toUpperCase()}</span>
                  <Icon name="expand_more" className="nav-chevron" size={20} />
                </button>
                {langOpen && (
                  <ul className="nav-lang-dropdown" role="listbox">
                    {['en', 'ar', 'fr'].map((code) => (
                      <li key={code} role="option" aria-selected={lang === code}>
                        <button
                          type="button"
                          className={`nav-lang-option ${lang === code ? 'nav-lang-option--active' : ''}`}
                          onClick={() => {
                           setLanguage(code);
                           setLangOpen(false);
                           closeMenu();
                           showToast(t('feedback', 'languageChanged'), 'success');
                         }}
                        >
                          {code === 'en' ? 'English' : code === 'ar' ? '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'Fran\u00e7ais'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: global search (desktop), favourites, profile / sign in, sign up */}
          <div className="header-row header-row--secondary">
            <div className="header-search-slot header-search-slot--desktop">
              <GlobalSearchBar idPrefix="header-search" onPick={closeMenu} />
            </div>
            <div className="header-row--secondary-actions">
            <Link to="/favourites" className="nav-icon" onClick={closeMenu} aria-label={t('nav', 'myFavourites')}><Icon name="favorite" size={22} /></Link>
            {user ? (
              <>
                {user.isAdmin && (
                  <Link to="/admin" className="nav-link nav-link--auth" onClick={closeMenu}>Admin</Link>
                )}
                {user && (user.isBusinessOwner || (user.ownedPlaceCount ?? 0) > 0) && (
                  <Link to="/business" className="nav-link nav-link--auth" onClick={closeMenu}>My business</Link>
                )}
                <Link to="/messages" className="nav-link nav-link--auth" onClick={closeMenu}>
                  {t('nav', 'venueMessages')}
                </Link>
                <Link to="/profile" className="nav-link nav-link--auth" onClick={closeMenu}>{user.name || t('nav', 'profile')}</Link>
                <button type="button" className="btn-outline btn-sm btn-vd" onClick={handleLogout}>{t('nav', 'logOut')}</button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link nav-link--auth" onClick={closeMenu}>{t('nav', 'signIn')}</Link>
                <Link to="/register" className="btn-primary btn-sm btn-vd" onClick={closeMenu}>{t('nav', 'signUp')}</Link>
              </>
            )}
            </div>
          </div>
        </div>

        {/* Mobile drawer: close X, logo/emblem, nav list, Language + Login footer */}
        <div className={`header-drawer ${menuOpen ? 'header-drawer--open' : ''}`} aria-hidden={!menuOpen}>
          <div className="header-drawer__header">
            <button
              type="button"
              className="header-drawer__close"
              onClick={closeMenu}
              aria-label="Close menu"
            >
              <Icon name="close" size={24} />
            </button>
            <div className="header-drawer__brand">
              <div className="header-drawer__brand-lockup">
                <span className="logo-stack logo-stack--drawer">
                  <span className="logo-mark" aria-hidden="true">
                    <img src="/tripoli-lebanon-icon.svg" alt="" className="header-emblem-icon" width="40" height="40" />
                  </span>
                  <span className="header-drawer__title">{settings.siteName?.trim() || t('nav', 'visitTripoli')}</span>
                </span>
                <span className="header-drawer__subtitle header-drawer__subtitle--brand">{t('nav', 'navBrandTagline')}</span>
              </div>
            </div>
          </div>
          <nav className="nav nav--vd nav--main nav--drawer">
            <Link to="/" className={`nav-link nav-link--home ${isHome ? 'nav-link--active' : ''}`} onClick={closeMenu}>{t('nav', 'home')}</Link>
            <Link
              to={PLACES_DISCOVER_PATH}
              className={`nav-link ${isPlaceDiscoverPage && !isDiningPage && !isHotelsPage ? 'nav-link--active' : ''}`}
              onClick={closeMenu}
            >
              {t('nav', 'discoverPlaces')}
            </Link>
            {diningGuideEnabled && (
              <Link
                to={DINING_PATH}
                className={`nav-link ${isDiningPage ? 'nav-link--active' : ''}`}
                onClick={closeMenu}
              >
                {t('nav', 'diningNav')}
              </Link>
            )}
            {hotelsGuideEnabled && (
              <Link
                to={HOTELS_PATH}
                className={`nav-link ${isHotelsPage ? 'nav-link--active' : ''}`}
                onClick={closeMenu}
              >
                {t('nav', 'hotelsNav')}
              </Link>
            )}
            <Link to="/map" className={`nav-link ${isMapPage ? 'nav-link--active' : ''}`} onClick={closeMenu}>
              {t('nav', 'viewMapNav')}
            </Link>
            <Link
              to={COMMUNITY_PATH}
              className={`nav-link ${isCommunityHub ? 'nav-link--active' : ''}`}
              onClick={closeMenu}
            >
              {t('nav', 'communityFeed')}
            </Link>
            <Link
              to="/activities"
              className={`nav-link ${navActivitiesHubActive ? 'nav-link--active' : ''}`}
              onClick={closeMenu}
            >
              {t('nav', 'activitiesHubNav')}
            </Link>
            <Link
              to="/about-tripoli"
              className={`nav-link ${isAboutTripoliPage ? 'nav-link--active' : ''}`}
              onClick={closeMenu}
            >
              {t('nav', 'megaAboutTripoli') || 'About Tripoli'}
            </Link>
            <Link to="/plan" className={`nav-link nav-link--plan ${isPlan ? 'nav-link--active' : ''}`} onClick={closeMenu}>
              {t('nav', 'planYourVisit')}
            </Link>
          </nav>
          <div className="header-drawer__footer">
            <div className={`nav-lang-wrap nav-lang-wrap--drawer ${langOpen ? 'nav-lang-wrap--open' : ''}`} ref={langDrawerRef}>
              <button
                type="button"
                className="btn-drawer-footer"
                onClick={() => setLangOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                aria-label="Language"
              >
                <span className="nav-lang-label">{langLabels[lang] || lang.toUpperCase()}</span>
                <Icon name="expand_more" className="nav-chevron" size={20} />
              </button>
              {langOpen && (
                <ul className="nav-lang-dropdown nav-lang-dropdown--drawer" role="listbox">
                  {['en', 'ar', 'fr'].map((code) => (
                    <li key={code} role="option" aria-selected={lang === code}>
                      <button
                        type="button"
                        className={`nav-lang-option ${lang === code ? 'nav-lang-option--active' : ''}`}
                        onClick={() => {
                          setLanguage(code);
                          setLangOpen(false);
                          closeMenu();
                          showToast(t('feedback', 'languageChanged'), 'success');
                        }}
                      >
                        {code === 'en' ? 'English' : code === 'ar' ? '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'Fran\u00e7ais'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              className="btn-drawer-footer btn-drawer-footer--theme"
              onClick={toggleTheme}
              aria-label={themeActionLabel}
              title={themeActionLabel}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
            {user ? (
              <>
                {user.isAdmin && (
                  <Link to="/admin" className="btn-drawer-footer" onClick={closeMenu}>Admin</Link>
                )}
                {user && (user.isBusinessOwner || (user.ownedPlaceCount ?? 0) > 0) && (
                  <Link to="/business" className="btn-drawer-footer" onClick={closeMenu}>My business</Link>
                )}
                <Link to="/messages" className="btn-drawer-footer" onClick={closeMenu}>
                  {t('nav', 'venueMessages')}
                </Link>
                <Link to="/profile" className="btn-drawer-footer" onClick={closeMenu}>{user.name || t('nav', 'profile')}</Link>
              </>
            ) : (
              <Link to="/login" className="btn-drawer-footer" onClick={closeMenu}>{t('nav', 'signIn')}</Link>
            )}
          </div>
        </div>

        {menuOpen && <div className="nav-overlay" onClick={closeMenu} aria-hidden="true" />}
      </header>

      {mobileSearchOpen && (
        <>
          <div
            className="header-search-mobile-backdrop"
            role="presentation"
            onClick={() => setMobileSearchOpen(false)}
            aria-hidden="true"
          />
          <div className="header-search-mobile-panel" role="dialog" aria-modal="true" aria-label={t('nav', 'search')}>
            <GlobalSearchBar
              className="global-search-bar--full"
              idPrefix="mobile-search"
              autoFocus
              onEscape={() => setMobileSearchOpen(false)}
              onPick={() => setMobileSearchOpen(false)}
              endAdornment={
                <button
                  type="button"
                  className="global-search-bar__sheet-close"
                  onClick={() => setMobileSearchOpen(false)}
                  aria-label={t('placeDiscover', 'modalClose')}
                >
                  <Icon name="close" size={22} />
                </button>
              }
            />
          </div>
        </>
      )}

      {verifyWelcomeBanner && (
        <div
          className="site-settings-banner site-settings-banner--announcement"
          role="status"
          style={{
            background: 'linear-gradient(135deg, #14523a 0%, #0d3d2e 100%)',
            color: '#fff',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <p className="site-settings-banner-text" style={{ color: '#fff', textAlign: 'left', flex: 1 }}>
            Welcome to {settings.siteName?.trim() || 'Visit Tripoli'}, {verifyWelcomeBanner.name}! Your account is verified
            {verifyWelcomeBanner.emailSent ? ' — we also sent a short welcome message to your inbox.' : '.'}
          </p>
          <button
            type="button"
            className="ai-plan-banner-dismiss"
            onClick={() => setVerifyWelcomeBanner(null)}
            aria-label="Dismiss welcome message"
            style={{ color: 'rgba(255,255,255,0.9)', flexShrink: 0 }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      {settings.maintenanceMode && (
        <div className="site-settings-banner site-settings-banner--maintenance" role="status">
          <p className="site-settings-banner-text">We’re updating Tripoli Explorer. Some features may be limited.</p>
        </div>
      )}
      {settings.announcementEnabled && settings.announcementText?.trim() && (
        <div className="site-settings-banner site-settings-banner--announcement" role="region" aria-label="Site announcement">
          <p className="site-settings-banner-text">{settings.announcementText}</p>
          {settings.announcementUrl?.trim() ? (
            <a href={settings.announcementUrl} className="site-settings-banner-link" target="_blank" rel="noopener noreferrer">
              Learn more
            </a>
          ) : null}
        </div>
      )}

      {!aiBannerDismissed && settings.aiPlannerEnabled !== false && (
        <div className="ai-plan-banner" role="banner">
          <p className="ai-plan-banner-text">{t('nav', 'aiPlanBanner')}</p>
          <div className="ai-plan-banner-actions">
            <Link to="/plan/ai" className="ai-plan-banner-cta" onClick={() => setMenuOpen(false)}>
              {t('nav', 'aiPlanBannerCta')}
            </Link>
            <button
              type="button"
              className="ai-plan-banner-dismiss"
              onClick={() => {
                try {
                  localStorage.setItem(AI_BANNER_DISMISSED_KEY, '1');
                } catch {
                  /* ignore quota / private mode */
                }
                setAiBannerDismissed(true);
              }}
              aria-label="Dismiss"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>
      )}

      <a href="#main-content" className="skip-to-main">
        {t('nav', 'skipToMain') || 'Skip to main content'}
      </a>
      <main
        id="main-content"
        className={`main ${isHome || isCommunityHub || isMapPage ? 'main--full' : 'main--contained'}${isMapPage ? ' main--map' : ''}`}
        tabIndex={-1}
      >
        <Outlet />
      </main>
      {!isAiPlannerPage && <BackToTop />}
    </div>
  );
}
