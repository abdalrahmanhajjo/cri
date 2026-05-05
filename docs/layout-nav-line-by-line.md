# Layout.jsx Literal Line-by-Line Breakdown

Here is the full 496-line breakdown for the global Layout shell.

*   **Line 1**: `import { useState, useEffect, useRef } from 'react';` means importing a necessary dependency (React hooks, Router tools, Contexts, or Utilities).
*   **Line 2**: `import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';` means importing a necessary dependency (React hooks, Router tools, Contexts, or Utilities).
*   **Line 3**: `import { useAuth } from '../context/AuthContext';` means importing a necessary dependency (React hooks, Router tools, Contexts, or Utilities).
*   **Line 4**: `import { useLanguage } from '../context/LanguageContext';` means importing a necessary dependency (React hooks, Router tools, Contexts, or Utilities).
*   **Line 5**: `import { useToast } from '../context/ToastContext';` means importing a necessary dependency (React hooks, Router tools, Contexts, or Utilities).
*   **Line 6**: `import { useSiteSettings } from '../context/SiteSettingsContext';` means importing a necessary dependency (React hooks, Router tools, Contexts, or Utilities).
*   **Line 7**: `import Icon from './Icon';` means importing a necessary dependency (React hooks, Router tools, Contexts, or Utilities).
*   **Line 8**: `import GlobalSearchBar from './GlobalSearchBar';` means importing a necessary dependency (React hooks, Router tools, Contexts, or Utilities).
*   **Line 9**: `import BackToTop from './BackToTop';` means importing a necessary dependency (React hooks, Router tools, Contexts, or Utilities).
*   **Line 10**: `import { COMMUNITY_PATH, PLACES_DISCOVER_PATH } from '../utils/discoverPaths';` means importing a necessary dependency (React hooks, Router tools, Contexts, or Utilities).
*   **Line 11**: `import './css/Layout.css';` means importing a necessary dependency (React hooks, Router tools, Contexts, or Utilities).
*   **Line 12**: `` means an empty line for visual spacing.
*   **Line 13**: `const langLabels = { en: 'EN', ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', fr: 'FR' };` means executing standard application logic or rendering nested HTML elements.
*   **Line 14**: `const AI_BANNER_DISMISSED_KEY = 'tripoli_ai_banner_dismissed';` means defining the local storage key used to remember if the user closed the AI banner.
*   **Line 15**: `` means an empty line for visual spacing.
*   **Line 16**: `export default function Layout() {` means defining and exporting the main global Layout component.
*   **Line 17**: `  const { user, logout } = useAuth();` means pulling the current user session and logout function from the Authentication Context.
*   **Line 18**: `  const { lang, setLanguage, t } = useLanguage();` means executing standard application logic or rendering nested HTML elements.
*   **Line 19**: `  const { showToast } = useToast();` means executing standard application logic or rendering nested HTML elements.
*   **Line 20**: `  const { settings } = useSiteSettings();` means pulling global application configurations from the Site Settings Context.
*   **Line 21**: `  const navigate = useNavigate();` means getting the navigation function to redirect the user programmatically.
*   **Line 22**: `  const location = useLocation();` means getting the current page URL path from React Router.
*   **Line 23**: `  const [menuOpen, setMenuOpen] = useState(false);` means initializing state to track if the mobile side-menu is open.
*   **Line 24**: `  const [langOpen, setLangOpen] = useState(false);` means initializing state to track if the language dropdown is open.
*   **Line 25**: `  const [aiBannerDismissed, setAiBannerDismissed] = useState(() => {` means initializing state to remember if the AI planner advertisement should be hidden.
*   **Line 26**: `    try {` means executing standard application logic or rendering nested HTML elements.
*   **Line 27**: `      return localStorage.getItem(AI_BANNER_DISMISSED_KEY) === '1';` means executing standard application logic or rendering nested HTML elements.
*   **Line 28**: `    } catch {` means closing a JavaScript function or object block.
*   **Line 29**: `      return false;` means executing standard application logic or rendering nested HTML elements.
*   **Line 30**: `    }` means closing a JavaScript function or object block.
*   **Line 31**: `  });` means closing a JavaScript function or object block.
*   **Line 32**: `  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);` means initializing state to track if the full-screen mobile search is active.
*   **Line 33**: `  /\*\* One-time banner after email verification (set from VerifyEmail via sessionStorage). \*/` means executing standard application logic or rendering nested HTML elements.
*   **Line 34**: `  const [verifyWelcomeBanner, setVerifyWelcomeBanner] = useState(null);` means initializing state to show a one-time welcome banner after email verification.
*   **Line 35**: `  const langRef = useRef(null);` means executing standard application logic or rendering nested HTML elements.
*   **Line 36**: `  const langDrawerRef = useRef(null);` means executing standard application logic or rendering nested HTML elements.
*   **Line 37**: `  const isHome = location.pathname === '/';` means calculating a boolean flag to check if the user is exactly on the Home Page.
*   **Line 38**: `  const isActivitiesHub = location.pathname === '/activities';` means executing standard application logic or rendering nested HTML elements.
*   **Line 39**: `  const navActivitiesHubActive = isActivitiesHub;` means executing standard application logic or rendering nested HTML elements.
*   **Line 40**: `  const isPlan = location.pathname === '/plan';` means calculating if the user is on the Plan page.
*   **Line 41**: `  const isCommunityHub =` means executing standard application logic or rendering nested HTML elements.
*   **Line 42**: `    location.pathname === COMMUNITY_PATH || location.pathname.startsWith('${COMMUNITY_PATH}/');` means executing standard application logic or rendering nested HTML elements.
*   **Line 43**: `  const isMapPage = location.pathname === '/map';` means calculating if the user is on the Map page.
*   **Line 44**: `  const isTripsPage = location.pathname === '/trips' || location.pathname.startsWith('/trips/');` means executing standard application logic or rendering nested HTML elements.
*   **Line 45**: `  const isPlaceDiscoverPage =` means executing standard application logic or rendering nested HTML elements.
*   **Line 46**: `    location.pathname === PLACES_DISCOVER_PATH || location.pathname.startsWith('${PLACES_DISCOVER_PATH}/');` means executing standard application logic or rendering nested HTML elements.
*   **Line 47**: `  const isAboutTripoliPage = location.pathname === '/about-tripoli';` means executing standard application logic or rendering nested HTML elements.
*   **Line 48**: `  const handleLogout = () => {` means executing standard application logic or rendering nested HTML elements.
*   **Line 49**: `    logout();` means executing standard application logic or rendering nested HTML elements.
*   **Line 50**: `    setMenuOpen(false);` means updating state to close the mobile menu.
*   **Line 51**: `    showToast(t('feedback', 'signedOut'), 'info');` means executing standard application logic or rendering nested HTML elements.
*   **Line 52**: `    navigate('/');` means executing standard application logic or rendering nested HTML elements.
*   **Line 53**: `  };` means closing a JavaScript function or object block.
*   **Line 54**: `` means an empty line for visual spacing.
*   **Line 55**: `  const closeMenu = () => {` means executing standard application logic or rendering nested HTML elements.
*   **Line 56**: `    setMenuOpen(false);` means updating state to close the mobile menu.
*   **Line 57**: `  };` means closing a JavaScript function or object block.
*   **Line 58**: `` means an empty line for visual spacing.
*   **Line 59**: `  useEffect(() => {` means starting a side-effect hook that runs automatically when certain variables change.
*   **Line 60**: `    if (!langOpen) return;` means executing standard application logic or rendering nested HTML elements.
*   **Line 61**: `    const close = (e) => {` means executing standard application logic or rendering nested HTML elements.
*   **Line 62**: `      const inDesktop = langRef.current && langRef.current.contains(e.target);` means executing standard application logic or rendering nested HTML elements.
*   **Line 63**: `      const inDrawer = langDrawerRef.current && langDrawerRef.current.contains(e.target);` means executing standard application logic or rendering nested HTML elements.
*   **Line 64**: `      if (!inDesktop && !inDrawer) setLangOpen(false);` means executing standard application logic or rendering nested HTML elements.
*   **Line 65**: `    };` means closing a JavaScript function or object block.
*   **Line 66**: `    document.addEventListener('click', close);` means attaching a global event listener to the web browser.
*   **Line 67**: `    return () => document.removeEventListener('click', close);` means starting the main HTML/JSX output that will render the global site shell.
*   **Line 68**: `  }, [langOpen]);` means closing a JavaScript function or object block.
*   **Line 69**: `` means an empty line for visual spacing.
*   **Line 70**: `  /\* Tablet / collapsed header: keep page from scrolling behind the drawer \*/` means executing standard application logic or rendering nested HTML elements.
*   **Line 71**: `  const lockScroll = menuOpen || mobileSearchOpen;` means executing standard application logic or rendering nested HTML elements.
*   **Line 72**: `  useEffect(() => {` means starting a side-effect hook that runs automatically when certain variables change.
*   **Line 73**: `    if (!lockScroll) return;` means executing standard application logic or rendering nested HTML elements.
*   **Line 74**: `    const prev = document.body.style.overflow;` means executing standard application logic or rendering nested HTML elements.
*   **Line 75**: `    document.body.style.overflow = 'hidden';` means modifying the main body CSS to prevent scrolling when a modal is open.
*   **Line 76**: `    return () => {` means starting the main HTML/JSX output that will render the global site shell.
*   **Line 77**: `      document.body.style.overflow = prev;` means modifying the main body CSS to prevent scrolling when a modal is open.
*   **Line 78**: `    };` means closing a JavaScript function or object block.
*   **Line 79**: `  }, [lockScroll]);` means closing a JavaScript function or object block.
*   **Line 80**: `` means an empty line for visual spacing.
*   **Line 81**: `  useEffect(() => {` means starting a side-effect hook that runs automatically when certain variables change.
*   **Line 82**: `    if (!user) return;` means executing standard application logic or rendering nested HTML elements.
*   **Line 83**: `    try {` means executing standard application logic or rendering nested HTML elements.
*   **Line 84**: `      const raw = sessionStorage.getItem('tripoli-welcome-after-verify');` means executing standard application logic or rendering nested HTML elements.
*   **Line 85**: `      if (!raw) return;` means executing standard application logic or rendering nested HTML elements.
*   **Line 86**: `      sessionStorage.removeItem('tripoli-welcome-after-verify');` means executing standard application logic or rendering nested HTML elements.
*   **Line 87**: `      const data = JSON.parse(raw);` means executing standard application logic or rendering nested HTML elements.
*   **Line 88**: `      if (!data || typeof data.at !== 'number' || Date.now() - data.at > 120000) return;` means executing standard application logic or rendering nested HTML elements.
*   **Line 89**: `      setVerifyWelcomeBanner({` means executing standard application logic or rendering nested HTML elements.
*   **Line 90**: `        name: (data.name && String(data.name).trim()) || user.name || 'there',` means executing standard application logic or rendering nested HTML elements.
*   **Line 91**: `        emailSent: data.welcomeEmailSent === true,` means executing standard application logic or rendering nested HTML elements.
*   **Line 92**: `      });` means closing a JavaScript function or object block.
*   **Line 93**: `    } catch {` means closing a JavaScript function or object block.
*   **Line 94**: `      /\* ignore \*/` means executing standard application logic or rendering nested HTML elements.
*   **Line 95**: `    }` means closing a JavaScript function or object block.
*   **Line 96**: `  }, [user?.id]);` means closing a JavaScript function or object block.
*   **Line 97**: `` means an empty line for visual spacing.
*   **Line 98**: `  return (` means starting the main HTML/JSX output that will render the global site shell.
*   **Line 99**: `    <div className="layout">` means opening the master layout wrapper div.
*   **Line 100**: `      <header id="site-header" className={'header header--vd ${menuOpen ? 'menu-open' : ''}'}>` means opening the main header bar and applying dynamic CSS classes based on state.
*   **Line 101**: `        <div className="header-inner">` means opening a generic layout container div.
*   **Line 102**: `          <div className="header-row header-row--main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>` means opening a Flexbox row container inside the header.
*   **Line 103**: `            <button` means rendering a clickable interactive button.
*   **Line 104**: `              type="button"` means executing standard application logic or rendering nested HTML elements.
*   **Line 105**: `              className="nav-toggle"` means applying specific CSS styling rules.
*   **Line 106**: `              onClick={() => setMenuOpen((o) => !o)}` means attaching a JavaScript click event handler.
*   **Line 107**: `              aria-label={menuOpen ? t('nav', 'closeMenu') : t('nav', 'openMenu')}` means setting accessibility attributes for screen readers.
*   **Line 108**: `              aria-expanded={menuOpen}` means setting accessibility attributes for screen readers.
*   **Line 109**: `            >` means executing standard application logic or rendering nested HTML elements.
*   **Line 110**: `              <span className="nav-toggle-bar" />` means opening an inline text wrapper.
*   **Line 111**: `              <span className="nav-toggle-bar" />` means opening an inline text wrapper.
*   **Line 112**: `              <span className="nav-toggle-bar" />` means opening an inline text wrapper.
*   **Line 113**: `            </button>` means closing the button element.
*   **Line 114**: `` means an empty line for visual spacing.
*   **Line 115**: `            <Link to="/" className="logo-wrap" onClick={closeMenu}>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 116**: `              <span className="logo-stack">` means rendering the text styling for the site logo or tagline.
*   **Line 117**: `                <span className="logo-mark" aria-hidden="true">` means rendering the text styling for the site logo or tagline.
*   **Line 118**: `                  <img src="/tripoli-lebanon-icon.svg" alt="" className="header-emblem-icon" width="40" height="40" />` means rendering an image element (like the Tripoli logo).
*   **Line 119**: `                </span>` means closing an inline text wrapper.
*   **Line 120**: `                <span className="logo">{settings.siteName?.trim() || t('nav', 'visitTripoli')}</span>` means rendering the text styling for the site logo or tagline.
*   **Line 121**: `              </span>` means closing an inline text wrapper.
*   **Line 122**: `              <span className="logo-tagline logo-tagline--brand">{t('nav', 'navBrandTagline')}</span>` means rendering the text styling for the site logo or tagline.
*   **Line 123**: `            </Link>` means closing the navigation link.
*   **Line 124**: `` means an empty line for visual spacing.
*   **Line 125**: `            <div className="header-mobile-right">` means opening a generic layout container div.
*   **Line 126**: `              <button` means rendering a clickable interactive button.
*   **Line 127**: `                type="button"` means executing standard application logic or rendering nested HTML elements.
*   **Line 128**: `                className="nav-icon nav-icon--search"` means applying specific CSS styling rules.
*   **Line 129**: `                onClick={() => {` means attaching a JavaScript click event handler.
*   **Line 130**: `                  setMobileSearchOpen(true);` means executing standard application logic or rendering nested HTML elements.
*   **Line 131**: `                  closeMenu();` means executing standard application logic or rendering nested HTML elements.
*   **Line 132**: `                }}` means closing a JavaScript function or object block.
*   **Line 133**: `                aria-label={t('nav', 'search')}` means setting accessibility attributes for screen readers.
*   **Line 134**: `                aria-expanded={mobileSearchOpen}` means setting accessibility attributes for screen readers.
*   **Line 135**: `              >` means executing standard application logic or rendering nested HTML elements.
*   **Line 136**: `                <Icon name="search" size={22} />` means rendering a custom vector graphic icon.
*   **Line 137**: `              </button>` means closing the button element.
*   **Line 138**: `              <Link to="/favourites" className="nav-icon" onClick={closeMenu} aria-label={t('nav', 'myFavourites')}><Icon name="favorite" size={22} /></Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 139**: `              {user ? (` means checking if the user is logged in to conditionally show profile links.
*   **Line 140**: `                <Link to="/profile" className="nav-icon nav-icon--profile" onClick={closeMenu} aria-label={t('nav', 'profile')}><Icon name="person" size={22} /></Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 141**: `              ) : (` means executing standard application logic or rendering nested HTML elements.
*   **Line 142**: `                <Link to="/login" className="nav-icon nav-icon--profile" onClick={closeMenu} aria-label={t('nav', 'signIn')}><Icon name="person" size={22} /></Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 143**: `              )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 144**: `            </div>` means closing a layout container div.
*   **Line 145**: `            <div style={{ flex: 1 }} aria-hidden="true" />` means opening a generic layout container div.
*   **Line 146**: `            ` means an empty line for visual spacing.
*   **Line 147**: `            <nav className={'nav nav--vd nav--main ${menuOpen ? 'nav-open' : ''}'}>` means opening a semantic navigation link container.
*   **Line 148**: `              <Link to="/" className={'nav-link nav-link--home ${isHome ? 'nav-link--active' : ''}'} onClick={closeMenu}>{t('nav', 'home')}</Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 149**: `              <Link` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 150**: `                to={PLACES_DISCOVER_PATH}` means executing standard application logic or rendering nested HTML elements.
*   **Line 151**: `                className={'nav-link ${isPlaceDiscoverPage ? 'nav-link--active' : ''}'}` means applying specific CSS styling rules.
*   **Line 152**: `                onClick={closeMenu}` means attaching a JavaScript click event handler.
*   **Line 153**: `              >` means executing standard application logic or rendering nested HTML elements.
*   **Line 154**: `                {t('nav', 'discoverPlaces')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 155**: `              </Link>` means closing the navigation link.
*   **Line 156**: `              <Link to="/map" className={'nav-link ${isMapPage ? 'nav-link--active' : ''}'} onClick={closeMenu}>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 157**: `                {t('nav', 'viewMapNav')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 158**: `              </Link>` means closing the navigation link.
*   **Line 159**: `              <Link` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 160**: `                to={COMMUNITY_PATH}` means executing standard application logic or rendering nested HTML elements.
*   **Line 161**: `                className={'nav-link ${isCommunityHub ? 'nav-link--active' : ''}'}` means applying specific CSS styling rules.
*   **Line 162**: `                onClick={closeMenu}` means attaching a JavaScript click event handler.
*   **Line 163**: `              >` means executing standard application logic or rendering nested HTML elements.
*   **Line 164**: `                {t('nav', 'communityFeed')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 165**: `              </Link>` means closing the navigation link.
*   **Line 166**: `              <Link` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 167**: `                to="/activities"` means executing standard application logic or rendering nested HTML elements.
*   **Line 168**: `                className={'nav-link ${navActivitiesHubActive ? 'nav-link--active' : ''}'}` means applying specific CSS styling rules.
*   **Line 169**: `                onClick={closeMenu}` means attaching a JavaScript click event handler.
*   **Line 170**: `              >` means executing standard application logic or rendering nested HTML elements.
*   **Line 171**: `                {t('nav', 'activitiesHubNav')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 172**: `              </Link>` means closing the navigation link.
*   **Line 173**: `              <Link` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 174**: `                to="/about-tripoli"` means executing standard application logic or rendering nested HTML elements.
*   **Line 175**: `                className={'nav-link ${isAboutTripoliPage ? 'nav-link--active' : ''}'}` means applying specific CSS styling rules.
*   **Line 176**: `                onClick={closeMenu}` means attaching a JavaScript click event handler.
*   **Line 177**: `              >` means executing standard application logic or rendering nested HTML elements.
*   **Line 178**: `                {t('nav', 'megaAboutTripoli')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 179**: `              </Link>` means closing the navigation link.
*   **Line 180**: `              <Link to="/plan" className={'nav-link nav-link--plan ${isPlan ? 'nav-link--active' : ''}'} onClick={closeMenu}>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 181**: `                {t('nav', 'planYourVisit')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 182**: `              </Link>` means closing the navigation link.
*   **Line 183**: `            </nav>` means closing the navigation container.
*   **Line 184**: `` means an empty line for visual spacing.
*   **Line 185**: `            <div className="header-meta">` means opening a generic layout container div.
*   **Line 186**: `              <div className={'nav-lang-wrap ${langOpen ? 'nav-lang-wrap--open' : ''}'} ref={langRef}>` means opening a generic layout container div.
*   **Line 187**: `                <button` means rendering a clickable interactive button.
*   **Line 188**: `                  type="button"` means executing standard application logic or rendering nested HTML elements.
*   **Line 189**: `                  className="nav-lang-trigger"` means applying specific CSS styling rules.
*   **Line 190**: `                  onClick={() => setLangOpen((o) => !o)}` means attaching a JavaScript click event handler.
*   **Line 191**: `                  aria-haspopup="listbox"` means setting accessibility attributes for screen readers.
*   **Line 192**: `                  aria-expanded={langOpen}` means setting accessibility attributes for screen readers.
*   **Line 193**: `                  aria-label={t('nav', 'languageSelect')}` means setting accessibility attributes for screen readers.
*   **Line 194**: `                >` means executing standard application logic or rendering nested HTML elements.
*   **Line 195**: `                  <span className="nav-lang-label">{langLabels[lang] || lang.toUpperCase()}</span>` means opening an inline text wrapper.
*   **Line 196**: `                  <Icon name="expand_more" className="nav-chevron" size={20} />` means rendering a custom vector graphic icon.
*   **Line 197**: `                </button>` means closing the button element.
*   **Line 198**: `                {langOpen && (` means executing standard application logic or rendering nested HTML elements.
*   **Line 199**: `                  <ul className="nav-lang-dropdown" role="listbox">` means opening an unordered list (used for dropdown menus).
*   **Line 200**: `                    {['en', 'ar', 'fr'].map((code) => (` means executing standard application logic or rendering nested HTML elements.
*   **Line 201**: `                      <li key={code} role="option" aria-selected={lang === code}>` means opening a list item.
*   **Line 202**: `                        <button` means rendering a clickable interactive button.
*   **Line 203**: `                          type="button"` means executing standard application logic or rendering nested HTML elements.
*   **Line 204**: `                          className={'nav-lang-option ${lang === code ? 'nav-lang-option--active' : ''}'}` means applying specific CSS styling rules.
*   **Line 205**: `                          onClick={() => {` means attaching a JavaScript click event handler.
*   **Line 206**: `                           setLanguage(code);` means executing standard application logic or rendering nested HTML elements.
*   **Line 207**: `                           setLangOpen(false);` means updating state to close the language selector dropdown.
*   **Line 208**: `                           closeMenu();` means executing standard application logic or rendering nested HTML elements.
*   **Line 209**: `                           showToast(t('feedback', 'languageChanged'), 'success');` means executing standard application logic or rendering nested HTML elements.
*   **Line 210**: `                         }}` means closing a JavaScript function or object block.
*   **Line 211**: `                        >` means executing standard application logic or rendering nested HTML elements.
*   **Line 212**: `                          {code === 'en' ? 'English' : code === 'ar' ? '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'Fran\u00e7ais'}` means executing standard application logic or rendering nested HTML elements.
*   **Line 213**: `                        </button>` means closing the button element.
*   **Line 214**: `                      </li>` means closing the list item.
*   **Line 215**: `                    ))}` means executing standard application logic or rendering nested HTML elements.
*   **Line 216**: `                  </ul>` means closing the list.
*   **Line 217**: `                )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 218**: `              </div>` means closing a layout container div.
*   **Line 219**: `            </div>` means closing a layout container div.
*   **Line 220**: `          </div>` means closing a layout container div.
*   **Line 221**: `` means an empty line for visual spacing.
*   **Line 222**: `          {/\* Row 2: global search (desktop), favourites, profile / sign in, sign up \*/}` means executing standard application logic or rendering nested HTML elements.
*   **Line 223**: `          <div className="header-row header-row--secondary">` means opening a Flexbox row container inside the header.
*   **Line 224**: `            <div className="header-search-slot header-search-slot--desktop">` means opening a generic layout container div.
*   **Line 225**: `              <GlobalSearchBar idPrefix="header-search" onPick={closeMenu} />` means executing standard application logic or rendering nested HTML elements.
*   **Line 226**: `            </div>` means closing a layout container div.
*   **Line 227**: `            <div className="header-row--secondary-actions">` means opening a Flexbox row container inside the header.
*   **Line 228**: `            <Link to="/favourites" className="nav-icon" onClick={closeMenu} aria-label={t('nav', 'myFavourites')}><Icon name="favorite" size={22} /></Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 229**: `            {user ? (` means checking if the user is logged in to conditionally show profile links.
*   **Line 230**: `              <>` means executing standard application logic or rendering nested HTML elements.
*   **Line 231**: `                {user.isAdmin && (` means checking if the user has Administrator privileges.
*   **Line 232**: `                  <Link to="/admin" className="nav-link nav-link--auth" onClick={closeMenu}>{t('nav', 'admin')}</Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 233**: `                )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 234**: `                {user && (user.isBusinessOwner || (user.ownedPlaceCount ?? 0) > 0) && (` means executing standard application logic or rendering nested HTML elements.
*   **Line 235**: `                  <Link to="/business" className="nav-link nav-link--auth" onClick={closeMenu}>{t('nav', 'myBusiness')}</Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 236**: `                )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 237**: `                <Link to="/messages" className="nav-link nav-link--auth" onClick={closeMenu}>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 238**: `                  {t('nav', 'venueMessages')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 239**: `                </Link>` means closing the navigation link.
*   **Line 240**: `                <Link` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 241**: `                  to="/trips"` means executing standard application logic or rendering nested HTML elements.
*   **Line 242**: `                  className={'nav-link nav-link--auth ${isTripsPage ? 'nav-link--active' : ''}'}` means applying specific CSS styling rules.
*   **Line 243**: `                  onClick={closeMenu}` means attaching a JavaScript click event handler.
*   **Line 244**: `                >` means executing standard application logic or rendering nested HTML elements.
*   **Line 245**: `                  {t('nav', 'myTrips')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 246**: `                </Link>` means closing the navigation link.
*   **Line 247**: `                <Link to="/profile" className="nav-link nav-link--auth" onClick={closeMenu}>{user.name || t('nav', 'profile')}</Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 248**: `                <button type="button" className="btn-outline btn-sm btn-vd" onClick={handleLogout}>{t('nav', 'logOut')}</button>` means rendering a clickable interactive button.
*   **Line 249**: `              </>` means executing standard application logic or rendering nested HTML elements.
*   **Line 250**: `            ) : (` means executing standard application logic or rendering nested HTML elements.
*   **Line 251**: `              <>` means executing standard application logic or rendering nested HTML elements.
*   **Line 252**: `                <Link to="/login" className="nav-link nav-link--auth" onClick={closeMenu}>{t('nav', 'signIn')}</Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 253**: `                <Link to="/register" className="btn-primary btn-sm btn-vd" onClick={closeMenu}>{t('nav', 'signUp')}</Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 254**: `              </>` means executing standard application logic or rendering nested HTML elements.
*   **Line 255**: `            )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 256**: `            </div>` means closing a layout container div.
*   **Line 257**: `          </div>` means closing a layout container div.
*   **Line 258**: `        </div>` means closing a layout container div.
*   **Line 259**: `` means an empty line for visual spacing.
*   **Line 260**: `        {/\* Mobile drawer: close X, logo/emblem, nav list, Language + Login footer \*/}` means executing standard application logic or rendering nested HTML elements.
*   **Line 261**: `        <div className={'header-drawer ${menuOpen ? 'header-drawer--open' : ''}'} aria-hidden={!menuOpen}>` means opening a generic layout container div.
*   **Line 262**: `          <div className="header-drawer__header">` means opening a generic layout container div.
*   **Line 263**: `            <button` means rendering a clickable interactive button.
*   **Line 264**: `              type="button"` means executing standard application logic or rendering nested HTML elements.
*   **Line 265**: `              className="header-drawer__close"` means applying specific CSS styling rules.
*   **Line 266**: `              onClick={closeMenu}` means attaching a JavaScript click event handler.
*   **Line 267**: `              aria-label={t('nav', 'closeMenu')}` means setting accessibility attributes for screen readers.
*   **Line 268**: `            >` means executing standard application logic or rendering nested HTML elements.
*   **Line 269**: `              <Icon name="close" size={24} />` means rendering a custom vector graphic icon.
*   **Line 270**: `            </button>` means closing the button element.
*   **Line 271**: `            <div className="header-drawer__brand">` means opening a generic layout container div.
*   **Line 272**: `              <div className="header-drawer__brand-lockup">` means opening a generic layout container div.
*   **Line 273**: `                <span className="logo-stack logo-stack--drawer">` means rendering the text styling for the site logo or tagline.
*   **Line 274**: `                  <span className="logo-mark" aria-hidden="true">` means rendering the text styling for the site logo or tagline.
*   **Line 275**: `                    <img src="/tripoli-lebanon-icon.svg" alt="" className="header-emblem-icon" width="40" height="40" />` means rendering an image element (like the Tripoli logo).
*   **Line 276**: `                  </span>` means closing an inline text wrapper.
*   **Line 277**: `                  <span className="header-drawer__title">{settings.siteName?.trim() || t('nav', 'visitTripoli')}</span>` means opening an inline text wrapper.
*   **Line 278**: `                </span>` means closing an inline text wrapper.
*   **Line 279**: `                <span className="header-drawer__subtitle header-drawer__subtitle--brand">{t('nav', 'navBrandTagline')}</span>` means opening an inline text wrapper.
*   **Line 280**: `              </div>` means closing a layout container div.
*   **Line 281**: `            </div>` means closing a layout container div.
*   **Line 282**: `          </div>` means closing a layout container div.
*   **Line 283**: `          <nav className="nav nav--vd nav--main nav--drawer">` means opening a semantic navigation link container.
*   **Line 284**: `            <Link to="/" className={'nav-link nav-link--home ${isHome ? 'nav-link--active' : ''}'} onClick={closeMenu}>{t('nav', 'home')}</Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 285**: `            <Link` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 286**: `              to={PLACES_DISCOVER_PATH}` means executing standard application logic or rendering nested HTML elements.
*   **Line 287**: `              className={'nav-link ${isPlaceDiscoverPage ? 'nav-link--active' : ''}'}` means applying specific CSS styling rules.
*   **Line 288**: `              onClick={closeMenu}` means attaching a JavaScript click event handler.
*   **Line 289**: `            >` means executing standard application logic or rendering nested HTML elements.
*   **Line 290**: `              {t('nav', 'discoverPlaces')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 291**: `            </Link>` means closing the navigation link.
*   **Line 292**: `            <Link to="/map" className={'nav-link ${isMapPage ? 'nav-link--active' : ''}'} onClick={closeMenu}>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 293**: `              {t('nav', 'viewMapNav')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 294**: `            </Link>` means closing the navigation link.
*   **Line 295**: `            <Link` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 296**: `              to={COMMUNITY_PATH}` means executing standard application logic or rendering nested HTML elements.
*   **Line 297**: `              className={'nav-link ${isCommunityHub ? 'nav-link--active' : ''}'}` means applying specific CSS styling rules.
*   **Line 298**: `              onClick={closeMenu}` means attaching a JavaScript click event handler.
*   **Line 299**: `            >` means executing standard application logic or rendering nested HTML elements.
*   **Line 300**: `              {t('nav', 'communityFeed')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 301**: `            </Link>` means closing the navigation link.
*   **Line 302**: `            <Link` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 303**: `              to="/activities"` means executing standard application logic or rendering nested HTML elements.
*   **Line 304**: `              className={'nav-link ${navActivitiesHubActive ? 'nav-link--active' : ''}'}` means applying specific CSS styling rules.
*   **Line 305**: `              onClick={closeMenu}` means attaching a JavaScript click event handler.
*   **Line 306**: `            >` means executing standard application logic or rendering nested HTML elements.
*   **Line 307**: `              {t('nav', 'activitiesHubNav')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 308**: `            </Link>` means closing the navigation link.
*   **Line 309**: `            <Link` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 310**: `              to="/about-tripoli"` means executing standard application logic or rendering nested HTML elements.
*   **Line 311**: `              className={'nav-link ${isAboutTripoliPage ? 'nav-link--active' : ''}'}` means applying specific CSS styling rules.
*   **Line 312**: `              onClick={closeMenu}` means attaching a JavaScript click event handler.
*   **Line 313**: `            >` means executing standard application logic or rendering nested HTML elements.
*   **Line 314**: `              {t('nav', 'megaAboutTripoli')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 315**: `            </Link>` means closing the navigation link.
*   **Line 316**: `            <Link to="/plan" className={'nav-link nav-link--plan ${isPlan ? 'nav-link--active' : ''}'} onClick={closeMenu}>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 317**: `              {t('nav', 'planYourVisit')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 318**: `            </Link>` means closing the navigation link.
*   **Line 319**: `            {user ? (` means checking if the user is logged in to conditionally show profile links.
*   **Line 320**: `              <Link to="/trips" className={'nav-link ${isTripsPage ? 'nav-link--active' : ''}'} onClick={closeMenu}>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 321**: `                {t('nav', 'myTrips')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 322**: `              </Link>` means closing the navigation link.
*   **Line 323**: `            ) : null}` means executing standard application logic or rendering nested HTML elements.
*   **Line 324**: `          </nav>` means closing the navigation container.
*   **Line 325**: `          <div className="header-drawer__footer">` means opening a generic layout container div.
*   **Line 326**: `            <div className={'nav-lang-wrap nav-lang-wrap--drawer ${langOpen ? 'nav-lang-wrap--open' : ''}'} ref={langDrawerRef}>` means opening a generic layout container div.
*   **Line 327**: `              <button` means rendering a clickable interactive button.
*   **Line 328**: `                type="button"` means executing standard application logic or rendering nested HTML elements.
*   **Line 329**: `                className="btn-drawer-footer"` means applying specific CSS styling rules.
*   **Line 330**: `                onClick={() => setLangOpen((o) => !o)}` means attaching a JavaScript click event handler.
*   **Line 331**: `                aria-haspopup="listbox"` means setting accessibility attributes for screen readers.
*   **Line 332**: `                aria-expanded={langOpen}` means setting accessibility attributes for screen readers.
*   **Line 333**: `                aria-label="Language"` means setting accessibility attributes for screen readers.
*   **Line 334**: `              >` means executing standard application logic or rendering nested HTML elements.
*   **Line 335**: `                <span className="nav-lang-label">{langLabels[lang] || lang.toUpperCase()}</span>` means opening an inline text wrapper.
*   **Line 336**: `                <Icon name="expand_more" className="nav-chevron" size={20} />` means rendering a custom vector graphic icon.
*   **Line 337**: `              </button>` means closing the button element.
*   **Line 338**: `              {langOpen && (` means executing standard application logic or rendering nested HTML elements.
*   **Line 339**: `                <ul className="nav-lang-dropdown nav-lang-dropdown--drawer" role="listbox">` means opening an unordered list (used for dropdown menus).
*   **Line 340**: `                  {['en', 'ar', 'fr'].map((code) => (` means executing standard application logic or rendering nested HTML elements.
*   **Line 341**: `                    <li key={code} role="option" aria-selected={lang === code}>` means opening a list item.
*   **Line 342**: `                      <button` means rendering a clickable interactive button.
*   **Line 343**: `                        type="button"` means executing standard application logic or rendering nested HTML elements.
*   **Line 344**: `                        className={'nav-lang-option ${lang === code ? 'nav-lang-option--active' : ''}'}` means applying specific CSS styling rules.
*   **Line 345**: `                        onClick={() => {` means attaching a JavaScript click event handler.
*   **Line 346**: `                          setLanguage(code);` means executing standard application logic or rendering nested HTML elements.
*   **Line 347**: `                          setLangOpen(false);` means updating state to close the language selector dropdown.
*   **Line 348**: `                          closeMenu();` means executing standard application logic or rendering nested HTML elements.
*   **Line 349**: `                          showToast(t('feedback', 'languageChanged'), 'success');` means executing standard application logic or rendering nested HTML elements.
*   **Line 350**: `                        }}` means closing a JavaScript function or object block.
*   **Line 351**: `                      >` means executing standard application logic or rendering nested HTML elements.
*   **Line 352**: `                        {code === 'en' ? 'English' : code === 'ar' ? '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'Fran\u00e7ais'}` means executing standard application logic or rendering nested HTML elements.
*   **Line 353**: `                      </button>` means closing the button element.
*   **Line 354**: `                    </li>` means closing the list item.
*   **Line 355**: `                  ))}` means executing standard application logic or rendering nested HTML elements.
*   **Line 356**: `                </ul>` means closing the list.
*   **Line 357**: `              )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 358**: `            </div>` means closing a layout container div.
*   **Line 359**: `            {user ? (` means checking if the user is logged in to conditionally show profile links.
*   **Line 360**: `              <>` means executing standard application logic or rendering nested HTML elements.
*   **Line 361**: `                {user.isAdmin && (` means checking if the user has Administrator privileges.
*   **Line 362**: `                  <Link to="/admin" className="btn-drawer-footer" onClick={closeMenu}>{t('nav', 'admin')}</Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 363**: `                )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 364**: `                {user && (user.isBusinessOwner || (user.ownedPlaceCount ?? 0) > 0) && (` means executing standard application logic or rendering nested HTML elements.
*   **Line 365**: `                  <Link to="/business" className="btn-drawer-footer" onClick={closeMenu}>{t('nav', 'myBusiness')}</Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 366**: `                )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 367**: `                <Link to="/messages" className="btn-drawer-footer" onClick={closeMenu}>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 368**: `                  {t('nav', 'venueMessages')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 369**: `                </Link>` means closing the navigation link.
*   **Line 370**: `                <Link to="/profile" className="btn-drawer-footer" onClick={closeMenu}>{user.name || t('nav', 'profile')}</Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 371**: `              </>` means executing standard application logic or rendering nested HTML elements.
*   **Line 372**: `            ) : (` means executing standard application logic or rendering nested HTML elements.
*   **Line 373**: `              <Link to="/login" className="btn-drawer-footer" onClick={closeMenu}>{t('nav', 'signIn')}</Link>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 374**: `            )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 375**: `          </div>` means closing a layout container div.
*   **Line 376**: `        </div>` means closing a layout container div.
*   **Line 377**: `` means an empty line for visual spacing.
*   **Line 378**: `        {menuOpen && <div className="nav-overlay" onClick={closeMenu} aria-hidden="true" />}` means checking if the menu is open before rendering its contents.
*   **Line 379**: `      </header>` means closing the main header bar.
*   **Line 380**: `` means an empty line for visual spacing.
*   **Line 381**: `      {mobileSearchOpen && (` means checking if mobile search is active before rendering the overlay.
*   **Line 382**: `        <>` means executing standard application logic or rendering nested HTML elements.
*   **Line 383**: `          <div` means opening a generic layout container div.
*   **Line 384**: `            className="header-search-mobile-backdrop"` means applying specific CSS styling rules.
*   **Line 385**: `            role="presentation"` means executing standard application logic or rendering nested HTML elements.
*   **Line 386**: `            onClick={() => setMobileSearchOpen(false)}` means attaching a JavaScript click event handler.
*   **Line 387**: `            aria-hidden="true"` means setting accessibility attributes for screen readers.
*   **Line 388**: `          />` means executing standard application logic or rendering nested HTML elements.
*   **Line 389**: `          <div className="header-search-mobile-panel" role="dialog" aria-modal="true" aria-label={t('nav', 'search')}>` means opening a generic layout container div.
*   **Line 390**: `            <GlobalSearchBar` means executing standard application logic or rendering nested HTML elements.
*   **Line 391**: `              className="global-search-bar--full"` means applying specific CSS styling rules.
*   **Line 392**: `              idPrefix="mobile-search"` means executing standard application logic or rendering nested HTML elements.
*   **Line 393**: `              autoFocus` means executing standard application logic or rendering nested HTML elements.
*   **Line 394**: `              onEscape={() => setMobileSearchOpen(false)}` means executing standard application logic or rendering nested HTML elements.
*   **Line 395**: `              onPick={() => setMobileSearchOpen(false)}` means executing standard application logic or rendering nested HTML elements.
*   **Line 396**: `              endAdornment={` means executing standard application logic or rendering nested HTML elements.
*   **Line 397**: `                <button` means rendering a clickable interactive button.
*   **Line 398**: `                  type="button"` means executing standard application logic or rendering nested HTML elements.
*   **Line 399**: `                  className="global-search-bar__sheet-close"` means applying specific CSS styling rules.
*   **Line 400**: `                  onClick={() => setMobileSearchOpen(false)}` means attaching a JavaScript click event handler.
*   **Line 401**: `                  aria-label={t('placeDiscover', 'modalClose')}` means setting accessibility attributes for screen readers.
*   **Line 402**: `                >` means executing standard application logic or rendering nested HTML elements.
*   **Line 403**: `                  <Icon name="close" size={22} />` means rendering a custom vector graphic icon.
*   **Line 404**: `                </button>` means closing the button element.
*   **Line 405**: `              }` means closing a JavaScript function or object block.
*   **Line 406**: `            />` means executing standard application logic or rendering nested HTML elements.
*   **Line 407**: `          </div>` means closing a layout container div.
*   **Line 408**: `        </>` means executing standard application logic or rendering nested HTML elements.
*   **Line 409**: `      )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 410**: `` means an empty line for visual spacing.
*   **Line 411**: `      {verifyWelcomeBanner && (` means checking if there is a pending welcome message to display.
*   **Line 412**: `        <div` means opening a generic layout container div.
*   **Line 413**: `          className="site-settings-banner site-settings-banner--announcement"` means applying specific CSS styling rules.
*   **Line 414**: `          role="status"` means executing standard application logic or rendering nested HTML elements.
*   **Line 415**: `          style={{` means executing standard application logic or rendering nested HTML elements.
*   **Line 416**: `            background: 'linear-gradient(135deg, #14523a 0%, #0d3d2e 100%)',` means executing standard application logic or rendering nested HTML elements.
*   **Line 417**: `            color: '#fff',` means executing standard application logic or rendering nested HTML elements.
*   **Line 418**: `            justifyContent: 'space-between',` means executing standard application logic or rendering nested HTML elements.
*   **Line 419**: `            borderBottom: '1px solid rgba(255,255,255,0.12)',` means executing standard application logic or rendering nested HTML elements.
*   **Line 420**: `          }}` means closing a JavaScript function or object block.
*   **Line 421**: `        >` means executing standard application logic or rendering nested HTML elements.
*   **Line 422**: `          <p className="site-settings-banner-text" style={{ color: '#fff', textAlign: 'left', flex: 1 }}>` means executing standard application logic or rendering nested HTML elements.
*   **Line 423**: `            {t('nav', 'welcomeBanner')` means executing standard application logic or rendering nested HTML elements.
*   **Line 424**: `              .replace('{siteName}', settings.siteName?.trim() || 'Visit Tripoli')` means executing standard application logic or rendering nested HTML elements.
*   **Line 425**: `              .replace('{name}', verifyWelcomeBanner.name)}` means executing standard application logic or rendering nested HTML elements.
*   **Line 426**: `            {verifyWelcomeBanner.emailSent ? t('nav', 'welcomeBannerEmail') : '.'}` means executing standard application logic or rendering nested HTML elements.
*   **Line 427**: `          </p>` means executing standard application logic or rendering nested HTML elements.
*   **Line 428**: `          <button` means rendering a clickable interactive button.
*   **Line 429**: `            type="button"` means executing standard application logic or rendering nested HTML elements.
*   **Line 430**: `            className="ai-plan-banner-dismiss"` means applying specific CSS styling rules.
*   **Line 431**: `            onClick={() => setVerifyWelcomeBanner(null)}` means attaching a JavaScript click event handler.
*   **Line 432**: `            aria-label="Dismiss welcome message"` means setting accessibility attributes for screen readers.
*   **Line 433**: `            style={{ color: 'rgba(255,255,255,0.9)', flexShrink: 0 }}` means executing standard application logic or rendering nested HTML elements.
*   **Line 434**: `          >` means executing standard application logic or rendering nested HTML elements.
*   **Line 435**: `            <Icon name="close" size={18} />` means rendering a custom vector graphic icon.
*   **Line 436**: `          </button>` means closing the button element.
*   **Line 437**: `        </div>` means closing a layout container div.
*   **Line 438**: `      )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 439**: `` means an empty line for visual spacing.
*   **Line 440**: `      {settings.maintenanceMode && (` means executing standard application logic or rendering nested HTML elements.
*   **Line 441**: `        <div className="site-settings-banner site-settings-banner--maintenance" role="status">` means opening a generic layout container div.
*   **Line 442**: `          <p className="site-settings-banner-text">{t('nav', 'maintenanceMode')}</p>` means executing standard application logic or rendering nested HTML elements.
*   **Line 443**: `        </div>` means closing a layout container div.
*   **Line 444**: `      )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 445**: `      {settings.announcementEnabled && settings.announcementText?.trim() && (` means executing standard application logic or rendering nested HTML elements.
*   **Line 446**: `        <div className="site-settings-banner site-settings-banner--announcement" role="region" aria-label="Site announcement">` means opening a generic layout container div.
*   **Line 447**: `          <p className="site-settings-banner-text">{settings.announcementText}</p>` means executing standard application logic or rendering nested HTML elements.
*   **Line 448**: `          {settings.announcementUrl?.trim() ? (` means executing standard application logic or rendering nested HTML elements.
*   **Line 449**: `            <a href={settings.announcementUrl} className="site-settings-banner-link" target="_blank" rel="noopener noreferrer">` means executing standard application logic or rendering nested HTML elements.
*   **Line 450**: `              {t('nav', 'learnMore')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 451**: `            </a>` means executing standard application logic or rendering nested HTML elements.
*   **Line 452**: `          ) : null}` means executing standard application logic or rendering nested HTML elements.
*   **Line 453**: `        </div>` means closing a layout container div.
*   **Line 454**: `      )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 455**: `` means an empty line for visual spacing.
*   **Line 456**: `      {!aiBannerDismissed && settings.aiPlannerEnabled !== false && (` means executing standard application logic or rendering nested HTML elements.
*   **Line 457**: `        <div className="ai-plan-banner" role="banner">` means opening a generic layout container div.
*   **Line 458**: `          <p className="ai-plan-banner-text">{t('nav', 'aiPlanBanner')}</p>` means executing standard application logic or rendering nested HTML elements.
*   **Line 459**: `          <div className="ai-plan-banner-actions">` means opening a generic layout container div.
*   **Line 460**: `            <Link to="/plan/ai" className="ai-plan-banner-cta" onClick={() => setMenuOpen(false)}>` means creating a client-side navigation link (React Router) to prevent full page reloads.
*   **Line 461**: `              {t('nav', 'aiPlanBannerCta')}` means executing standard application logic or rendering nested HTML elements.
*   **Line 462**: `            </Link>` means closing the navigation link.
*   **Line 463**: `            <button` means rendering a clickable interactive button.
*   **Line 464**: `              type="button"` means executing standard application logic or rendering nested HTML elements.
*   **Line 465**: `              className="ai-plan-banner-dismiss"` means applying specific CSS styling rules.
*   **Line 466**: `              onClick={() => {` means attaching a JavaScript click event handler.
*   **Line 467**: `                try {` means executing standard application logic or rendering nested HTML elements.
*   **Line 468**: `                  localStorage.setItem(AI_BANNER_DISMISSED_KEY, '1');` means executing standard application logic or rendering nested HTML elements.
*   **Line 469**: `                } catch {` means closing a JavaScript function or object block.
*   **Line 470**: `                  /\* ignore quota / private mode \*/` means executing standard application logic or rendering nested HTML elements.
*   **Line 471**: `                }` means closing a JavaScript function or object block.
*   **Line 472**: `                setAiBannerDismissed(true);` means executing standard application logic or rendering nested HTML elements.
*   **Line 473**: `              }}` means closing a JavaScript function or object block.
*   **Line 474**: `              aria-label="Dismiss"` means setting accessibility attributes for screen readers.
*   **Line 475**: `            >` means executing standard application logic or rendering nested HTML elements.
*   **Line 476**: `              <Icon name="close" size={18} />` means rendering a custom vector graphic icon.
*   **Line 477**: `            </button>` means closing the button element.
*   **Line 478**: `          </div>` means closing a layout container div.
*   **Line 479**: `        </div>` means closing a layout container div.
*   **Line 480**: `      )}` means executing standard application logic or rendering nested HTML elements.
*   **Line 481**: `` means an empty line for visual spacing.
*   **Line 482**: `      <a href="#main-content" className="skip-to-main">` means executing standard application logic or rendering nested HTML elements.
*   **Line 483**: `        {t('nav', 'skipToMain') || 'Skip to main content'}` means executing standard application logic or rendering nested HTML elements.
*   **Line 484**: `      </a>` means executing standard application logic or rendering nested HTML elements.
*   **Line 485**: `      <main` means opening the semantic main content area where child pages will be injected.
*   **Line 486**: `        id="main-content"` means executing standard application logic or rendering nested HTML elements.
*   **Line 487**: `        className={'main ${isHome || isCommunityHub || isMapPage ? 'main--full' : 'main--contained'}${isMapPage ? ' main--map' : ''}'}` means applying specific CSS styling rules.
*   **Line 488**: `        tabIndex={-1}` means executing standard application logic or rendering nested HTML elements.
*   **Line 489**: `      >` means executing standard application logic or rendering nested HTML elements.
*   **Line 490**: `        <Outlet />` means injecting the currently active page component (e.g. Explore, Profile) into the layout shell.
*   **Line 491**: `      </main>` means closing the main content area.
*   **Line 492**: `      <BackToTop />` means rendering the floating 'Scroll to Top' button.
*   **Line 493**: `    </div>` means closing a layout container div.
*   **Line 494**: `  );` means closing the return block statement.
*   **Line 495**: `}` means closing a JavaScript function or object block.
*   **Line 496**: `` means an empty line for visual spacing.
