import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';
import BackToTop from './BackToTop';
import './Layout.css';

const langLabels = { en: 'EN', ar: 'العربية', fr: 'FR' };
const AI_BANNER_DISMISSED_KEY = 'tripoli_ai_banner_dismissed';

function NavDropdown({ id, label, items, openId, onOpen, onClose, closeMenu, active }) {
  const ref = useRef(null);
  const isOpen = openId === id;

  useEffect(() => {
    if (!isOpen) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [isOpen, onClose]);

  return (
    <div className="nav-dropdown-wrap" ref={ref}>
      <button
        type="button"
        className={`nav-link nav-link--with-chevron nav-dropdown-trigger ${active ? 'nav-link--active' : ''} ${isOpen ? 'nav-dropdown-trigger--open' : ''}`}
        onClick={() => onOpen(isOpen ? null : id)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {label}
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} className="nav-chevron" size={20} />
      </button>
      {isOpen && (
        <ul className="nav-dropdown-menu" role="menu">
          {items.map((item) => (
            <li key={item.to} role="none">
              <Link to={item.to} className="nav-dropdown-item" onClick={() => { onClose(); closeMenu(); }} role="menuitem">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NavMegaMenu({ id, label, items, openId, onOpen, onClose, closeMenu, active, t }) {
  const ref = useRef(null);
  const isOpen = openId === id;

  useEffect(() => {
    if (!isOpen) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [isOpen, onClose]);

  return (
    <div className="nav-dropdown-wrap nav-mega-wrap" ref={ref}>
      <button
        type="button"
        className={`nav-link nav-link--with-chevron nav-dropdown-trigger ${active ? 'nav-link--active' : ''} ${isOpen ? 'nav-dropdown-trigger--open' : ''}`}
        onClick={() => onOpen(isOpen ? null : id)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {label}
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} className="nav-chevron" size={20} />
      </button>
      {isOpen && (
        <div className="nav-mega-panel" role="menu">
          <div className="nav-mega-grid">
            {items.map((item) => (
              <Link
                key={item.labelKey}
                to={item.to}
                className="nav-mega-item"
                onClick={() => { onClose(); closeMenu(); }}
                role="menuitem"
              >
                <span className="nav-mega-item-title">{t('nav', item.labelKey)}</span>
                {item.descKey && (
                  <span className="nav-mega-item-desc">{t('nav', item.descKey)}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { lang, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [navDropdownOpen, setNavDropdownOpen] = useState(null);
  const [aiBannerDismissed, setAiBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(AI_BANNER_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const langRef = useRef(null);
  const langDrawerRef = useRef(null);
  const isHome = location.pathname === '/';
  const isSpots = location.pathname === '/spots';
  const isWays = location.pathname === '/ways';
  const isExperiences = location.pathname === '/experiences';
  const isEvents = location.pathname === '/events';
  const isPlan = location.pathname === '/plan';
  const isDiscoverActive = isSpots || isWays;

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setNavDropdownOpen(null);
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

  /* Desktop mega menus – each page appears in exactly one menu (no duplicates) */
  const discoverMegaItems = [
    { to: '/', labelKey: 'megaAboutTripoli', descKey: 'megaAboutTripoliDesc' },
    { to: '/map', labelKey: 'megaMap', descKey: 'megaMapDesc' },
    { to: '/ways', labelKey: 'megaFindYourWay', descKey: 'megaFindYourWayDesc' },
    { to: '/spots', labelKey: 'megaAllSpots', descKey: 'megaAllSpotsDesc' },
  ];
  const activitiesMegaItems = [
    { to: '/experiences#tours', labelKey: 'megaExperiences', descKey: 'megaExperiencesDesc' },
    { to: '/experiences#guided', labelKey: 'megaTours', descKey: 'megaToursDesc' },
    { to: '/experiences#cultural', labelKey: 'megaCulturalExp', descKey: 'megaCulturalExpDesc' },
    { to: '/experiences#book', labelKey: 'megaBookExp', descKey: 'megaBookExpDesc' },
  ];
  const restaurantsMegaItems = [
    { to: '/ways#food', labelKey: 'megaDining', descKey: 'megaDiningDesc' },
    { to: '/ways#food', labelKey: 'megaRestaurants', descKey: 'megaRestaurantsDesc' },
    { to: '/ways#food', labelKey: 'megaSweets', descKey: 'megaSweetsDesc' },
    { to: '/ways#food', labelKey: 'megaStreetFood', descKey: 'megaStreetFoodDesc' },
  ];
  const eventsMegaItems = [
    { to: '/events#events', labelKey: 'megaEvents', descKey: 'megaEventsDesc' },
    { to: '/events#whats-on', labelKey: 'megaWhatsOn', descKey: 'megaWhatsOnDesc' },
    { to: '/events#festivals', labelKey: 'megaFestivals', descKey: 'megaFestivalsDesc' },
    { to: '/events#cultural', labelKey: 'megaCulturalEvents', descKey: 'megaCulturalEventsDesc' },
  ];
  const planMegaItems = [
    { to: '/plan', labelKey: 'megaPlan', descKey: 'megaPlanDesc' },
  ];
  /* Drawer (mobile) – 4 items each, same as mega */
  const discoverDrawerItems = [
    { to: '/', label: t('nav', 'megaAboutTripoli') },
    { to: '/map', label: t('nav', 'megaMap') },
    { to: '/ways', label: t('nav', 'megaFindYourWay') },
    { to: '/spots', label: t('nav', 'megaAllSpots') },
  ];
  const activitiesDrawerItems = [
    { to: '/experiences#tours', label: t('nav', 'megaExperiences') },
    { to: '/experiences#guided', label: t('nav', 'megaTours') },
    { to: '/experiences#cultural', label: t('nav', 'megaCulturalExp') },
    { to: '/experiences#book', label: t('nav', 'megaBookExp') },
  ];
  const restaurantsDrawerItems = [
    { to: '/ways#food', label: t('nav', 'megaDining') },
    { to: '/ways#food', label: t('nav', 'megaRestaurants') },
    { to: '/ways#food', label: t('nav', 'megaSweets') },
    { to: '/ways#food', label: t('nav', 'megaStreetFood') },
  ];
  const eventsDrawerItems = [
    { to: '/events#events', label: t('nav', 'megaEvents') },
    { to: '/events#whats-on', label: t('nav', 'megaWhatsOn') },
    { to: '/events#festivals', label: t('nav', 'megaFestivals') },
    { to: '/events#cultural', label: t('nav', 'megaCulturalEvents') },
  ];
  const planDrawerItems = [
    { to: '/plan', label: t('nav', 'megaPlan') },
  ];

  return (
    <div className="layout">
      <header className={`header header--vd ${menuOpen ? 'menu-open' : ''}`}>
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
              <span className="logo">{t('nav', 'visitTripoli')}</span>
              <span className="logo-tagline">{t('nav', 'tripoliLebanon')}</span>
            </Link>

            <div className="header-mobile-right">
              <Link to="/#spots" className="nav-icon nav-icon--search" onClick={closeMenu} aria-label={t('nav', 'search')}><Icon name="search" size={22} /></Link>
              <Link to="/favourites" className="nav-icon" onClick={closeMenu} aria-label={t('nav', 'myFavourites')}><Icon name="favorite" size={22} /></Link>
              {user ? (
                <Link to="/profile" className="nav-icon nav-icon--profile" onClick={closeMenu} aria-label={t('nav', 'profile')}><Icon name="person" size={22} /></Link>
              ) : (
                <Link to="/login" className="nav-icon nav-icon--profile" onClick={closeMenu} aria-label={t('nav', 'signIn')}><Icon name="person" size={22} /></Link>
              )}
            </div>

            <nav className={`nav nav--vd nav--main ${menuOpen ? 'nav-open' : ''}`}>
              <Link to="/" className={`nav-link nav-link--home ${isHome ? 'nav-link--active' : ''}`} onClick={closeMenu}>{t('nav', 'home')}</Link>
              <NavMegaMenu id="discover" label={t('nav', 'discoverTripoli')} items={discoverMegaItems} openId={navDropdownOpen} onOpen={setNavDropdownOpen} onClose={() => setNavDropdownOpen(null)} closeMenu={closeMenu} active={isDiscoverActive} t={t} />
              <NavMegaMenu id="activities" label={t('nav', 'activitiesExperiences')} items={activitiesMegaItems} openId={navDropdownOpen} onOpen={setNavDropdownOpen} onClose={() => setNavDropdownOpen(null)} closeMenu={closeMenu} active={isExperiences} t={t} />
              <NavMegaMenu id="restaurants" label={t('nav', 'restaurantsFood')} items={restaurantsMegaItems} openId={navDropdownOpen} onOpen={setNavDropdownOpen} onClose={() => setNavDropdownOpen(null)} closeMenu={closeMenu} active={location.pathname === '/ways'} t={t} />
              <NavMegaMenu id="events" label={t('nav', 'eventsFestivals')} items={eventsMegaItems} openId={navDropdownOpen} onOpen={setNavDropdownOpen} onClose={() => setNavDropdownOpen(null)} closeMenu={closeMenu} active={isEvents} t={t} />
              <NavMegaMenu id="plan" label={t('nav', 'planYourVisit')} items={planMegaItems} openId={navDropdownOpen} onOpen={setNavDropdownOpen} onClose={() => setNavDropdownOpen(null)} closeMenu={closeMenu} active={isPlan} t={t} />
            </nav>

            <div className="header-meta">
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
                          onClick={() => { setLanguage(code); setLangOpen(false); closeMenu(); }}
                        >
                          {code === 'en' ? 'English' : code === 'ar' ? 'العربية' : 'Français'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="header-emblem" aria-hidden="true">
                <img src="/tripoli-lebanon-icon.svg" alt="" className="header-emblem-icon" width="40" height="40" />
              </div>
            </div>
          </div>

          {/* Row 2: favourites, search, profile / sign in, sign up (below main nav) */}
          <div className="header-row header-row--secondary">
            <Link to="/favourites" className="nav-icon" onClick={closeMenu} aria-label={t('nav', 'myFavourites')}><Icon name="favorite" size={22} /></Link>
            <Link to="/#spots" className="nav-icon nav-icon--search" onClick={closeMenu} aria-label={t('nav', 'search')}><Icon name="search" size={22} /></Link>
            {user ? (
              <>
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
              <img src="/tripoli-lebanon-icon.svg" alt="" className="header-drawer__emblem" width="40" height="40" />
              <span className="header-drawer__title">{t('nav', 'visitTripoli')}</span>
              <span className="header-drawer__subtitle">{t('nav', 'tripoliLebanon')}</span>
            </div>
          </div>
          <nav className="nav nav--vd nav--main nav--drawer">
            <Link to="/" className={`nav-link nav-link--home ${isHome ? 'nav-link--active' : ''}`} onClick={closeMenu}>{t('nav', 'home')}</Link>
            <NavDropdown id="drawer-discover" label={t('nav', 'discoverTripoli')} items={discoverDrawerItems} openId={navDropdownOpen} onOpen={setNavDropdownOpen} onClose={() => setNavDropdownOpen(null)} closeMenu={closeMenu} active={isDiscoverActive} />
            <NavDropdown id="drawer-activities" label={t('nav', 'activitiesExperiences')} items={activitiesDrawerItems} openId={navDropdownOpen} onOpen={setNavDropdownOpen} onClose={() => setNavDropdownOpen(null)} closeMenu={closeMenu} active={isExperiences} />
            <NavDropdown id="drawer-restaurants" label={t('nav', 'restaurantsFood')} items={restaurantsDrawerItems} openId={navDropdownOpen} onOpen={setNavDropdownOpen} onClose={() => setNavDropdownOpen(null)} closeMenu={closeMenu} active={location.pathname === '/ways'} />
            <NavDropdown id="drawer-events" label={t('nav', 'eventsFestivals')} items={eventsDrawerItems} openId={navDropdownOpen} onOpen={setNavDropdownOpen} onClose={() => setNavDropdownOpen(null)} closeMenu={closeMenu} active={isEvents} />
            <NavDropdown id="drawer-plan" label={t('nav', 'planYourVisit')} items={planDrawerItems} openId={navDropdownOpen} onOpen={setNavDropdownOpen} onClose={() => setNavDropdownOpen(null)} closeMenu={closeMenu} active={isPlan} />
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
                        onClick={() => { setLanguage(code); setLangOpen(false); closeMenu(); }}
                      >
                        {code === 'en' ? 'English' : code === 'ar' ? 'العربية' : 'Français'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {user ? (
              <Link to="/profile" className="btn-drawer-footer" onClick={closeMenu}>{user.name || t('nav', 'profile')}</Link>
            ) : (
              <Link to="/login" className="btn-drawer-footer" onClick={closeMenu}>{t('nav', 'signIn')}</Link>
            )}
          </div>
        </div>

        {menuOpen && <div className="nav-overlay" onClick={closeMenu} aria-hidden="true" />}
      </header>

      {!aiBannerDismissed && (
        <div className="ai-plan-banner" role="banner">
          <p className="ai-plan-banner-text">{t('nav', 'aiPlanBanner')}</p>
          <div className="ai-plan-banner-actions">
            <Link to="/#download-app" className="ai-plan-banner-cta" onClick={() => setMenuOpen(false)}>
              {t('nav', 'aiPlanBannerCta')}
            </Link>
            <button
              type="button"
              className="ai-plan-banner-dismiss"
              onClick={() => {
                try {
                  localStorage.setItem(AI_BANNER_DISMISSED_KEY, '1');
                } catch {}
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
      <main id="main-content" className={`main ${isHome ? 'main--full' : 'main--contained'}`} tabIndex={-1}>
        <Outlet />
      </main>
      <BackToTop />
    </div>
  );
}
