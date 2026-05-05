# Home Page Module Report (Line-by-Line Breakdown)

This report details the exact, line-by-line function of every logic file serving the Visit Tripoli home page.

## Core Page Component

### `Explore.jsx` (client/src/pages/Explore.jsx)
*   **Lines 1-34:** Imports React hooks, context providers (Auth, Settings, Language), page components, and routing utilities.
*   **Lines 42-54:** Initializes component state (`places`, `categories`, `events`, `loading`) to hold data fetched from the API.
*   **Lines 56-92:** The primary `useEffect`. Uses `Promise.allSettled` to fetch both `/api/places` and `/api/categories` concurrently. Handles network or server errors by setting the `error` state.
*   **Lines 94-102:** The Hash-Scroll `useEffect`. Monitors the URL for anchors (like `#experience`) and smooth-scrolls the user down upon page load.
*   **Lines 108-124:** Fetches subset preview data (`events` and `tours`) exclusively for populating the home page widgets.
*   **Lines 126-128:** Applies SEO metadata dynamically based on site configuration.
*   **Lines 130-159:** Extracts the hero image URL and injects a `<link rel="preload">` element directly into the document head to force the browser to load it as a high priority.
*   **Lines 161-174:** Fetches the top community posts for the feed preview strip.
*   **Lines 176-217:** Evaluates formatting variables (e.g., extracting App Store links) and filters/sorts the `topPicks` array from the master `places` list.
*   **Lines 219-258:** Renders fallback UI for loading indicators or API error messages.
*   **Lines 262-337:** The main render layout, mounting child components (`HomeBento`, `TopPicksSection`, etc.) and passing them their respective data slices as properties.

---

## Home Section Components (client/src/components/home/)

### `HomeBento.jsx`
*   **Lines 1-10:** Imports utilities for responsive images (`cityHeroWebpSrcSet`, `getBentoHeroImgProps`).
*   **Lines 12-22:** `renderTextWithBold`: A helper that regex-matches `**text**` strings and converts them to HTML `<strong>` elements.
*   **Lines 24-36:** Destructures props passed down from `Explore.jsx`.
*   **Lines 38-63:** Renders the main Hero card. If using the default image, it uses a `<picture>` tag with optimized WebP/PNG fallbacks based on screen size.
*   **Lines 64-104:** Renders hero text overlays. Iterates through `bentoAvatarSlots.map` to display 3 circular thumbnail images.
*   **Lines 107-118:** Renders the smaller "Why Visit" sub-card.
*   **Lines 121-141:** Renders the "Web App Hub" bullet points.
*   **Lines 143-236:** Renders the large "Mosaic" stat block. Injects computed formatting strings for place/category counts and renders the Apple/Google download badges.

### `TopPicksSection.jsx`
*   **Lines 1-20:** Imports navigation hooks. Initializes `index` for the carousel position and `isVisible` for the viewport tracker.
*   **Lines 21-33:** `IntersectionObserver` logic: Monitors the DOM element. If the user scrolls past the carousel, it sets `isVisible = false` to save processing power.
*   **Lines 35-45:** `setInterval` logic: Automatically increments the `index` every 10 seconds, provided `isVisible` is true.
*   **Lines 47-75:** Defines `handleNext`, `handlePrev`, and `onCarouselKeyDown` to allow slide navigation via clicks or keyboard (Arrow keys, Home, End).
*   **Lines 77-100:** `toggleFavourite`: Prevents default link clicking, checks authentication state, calls the backend to save the place, and pops a toast notification.
*   **Lines 104-120:** Renders the section header and "See All" hyperlink.
*   **Lines 122-220:** The main carousel loop. Maps over `safePlaces` to build individual cards displaying the image, rating, and heart icon.
*   **Lines 222-268:** Renders the visual bottom-pagination dots and side-arrow buttons.

### `CommunitySection.jsx`
*   **Lines 1-3:** Imports `CommunityFeedStrip`.
*   **Lines 4-15:** Checks if posts exist; returns null if empty. Otherwise, wraps and renders the `CommunityFeedStrip` with a layout flag of "bento".

### `PracticalSection.jsx`
*   **Lines 1-13:** Imports `FindYourWayMap` and creates translation wrappers.
*   **Lines 16-45:** Renders the left-side panel that embeds the `FindYourWayMap` interactive component.
*   **Lines 47-94:** Renders the right-side informational sidebar containing direct quick-links to transport guides, discovery hubs, and community forums.
*   **Lines 99-120:** Renders a secondary fallback block ("Tips") if the user has dismissed the default hints.

### `PlanVisitSection.jsx`
*   **Lines 1-51:** `TripoliClock`: Uses `setInterval` to update a `Date` object every second. Uses `toLocaleTimeString` locked to the `Asia/Beirut` timezone to display accurate local time.
*   **Lines 53-69:** Helper functions linking to the internal weather API and mapping WMO numeric codes to CSS keys.
*   **Lines 71-78:** `WeatherIcon`: Returns a specific sun/cloud/rain SVG component based on the weather code.
*   **Lines 80-194:** `WeatherTripoli`: Fetches data from the endpoint. Handles the Celsius (`c`) to Fahrenheit (`f`) conversion math locally based on the selected unit toggle.
*   **Lines 196-236:** Wraps the `TripoliClock` and `WeatherTripoli` components into a side-by-side flex layout container.

### `BrowseThemesSection.jsx`
*   **Lines 1-16:** Imports category data (`WAYS_CONFIG`) and provides an `Intl.NumberFormat` helper.
*   **Lines 18-31:** `themeCategoryStats`: Compares the places in a theme against the global categories to calculate an accurate count of active directories.
*   **Lines 33-42:** Assigns CSS animation stagger classes (`stepClass`) to elements.
*   **Lines 44-54:** Renders the section header.
*   **Lines 56-121:** Iterates over `WAYS_CONFIG`. Dynamically maps icons, reads translated text, and outputs individual category link cards.
*   **Lines 123-130:** Renders the concluding call-to-action button.

### `HomeUtilityBar.jsx`
*   **Lines 1-25:** Renders a static, horizontal bar. Provides anchor-hash links (`#plan`, `#experience`) alongside icons to help users jump directly to sections.

### `HomeFooter.jsx`
*   **Lines 1-58:** Renders the global footer. Dynamically reads `settings.contactEmail`, `settings.socialFacebook`, etc., to conditionally output social links only if the administrator has configured them.

---

## Configuration & Setup Logic (client/src/config/ & utils/)

### `homeBentoVisuals.js`
*   **Lines 1-28:** Declares `homeBentoDefaults`, storing hardcoded paths to local assets and Unsplash URLs.
*   **Lines 30-57:** `resolveHomeBentoVisuals`: Combines API-provided settings with defaults, prioritizing admin-supplied images.
*   **Lines 61-118:** `resolveBentoAvatarSlots`: Scans the API place data. It filters for the highest-rated places that have live images, picking 3 distinct entries to populate the hero avatars, ensuring the home page always feels populated.

### `resolveSiteTagline.js`
*   **Lines 1-20:** Exposes `resolveHeroTagline` and `resolveFooterTagline` functions ensuring that brand slogans read directly from the translation (`i18n`) files rather than database text, preventing stale overrides.

### `bentoHeroImage.js`
*   **Lines 1-38:** Evaluates the provided Hero image. Hardcodes optimal `width` (1024) and `height` (673) dimensions for the default file to eliminate layout shifting (CLS).
*   **Lines 40-62:** `normalizePreloadImageHref`: Validates image URLs using the `URL` object constructor to ensure the browser preload hint doesn't crash on malformed data.

### `siteSeo.js`
*   **Lines 1-29:** `upsertMetaName` & `upsertMetaProperty`: Manually searches the document `<head>`. If a meta tag exists, it updates the content; if not, it calls `document.createElement('meta')` to build it.
*   **Lines 31-47:** Extracts the absolute host origin (e.g., `https://visit-tripoli.com`) necessary for OpenGraph previews.
*   **Lines 49-72:** `applyHomeSeoFromSettings`: Overwrites the `document.title` and executes the upsert functions to inject Twitter and OpenGraph tags whenever configuration changes.

---

## The Global Layout

### `Layout.jsx` (client/src/components/Layout.jsx)
*   **Lines 1-47:** Imports contexts and reads `useLocation()`. Computes flags like `isHome` by checking if the path equals `/`. Retrieves the dismissed AI Banner state from `localStorage`.
*   **Lines 48-68:** Global `useEffect` to handle clicking outside the mobile navigation menu to close it.
*   **Lines 70-79:** Traps scrolling (`overflow: hidden`) on the document body when the mobile menu is active.
*   **Lines 81-96:** Intercepts post-email-verification tokens in `sessionStorage` to trigger a one-time welcome banner.
*   **Lines 98-258:** Defines the desktop `<header>`. Uses the `isHome` flag to assign specific CSS transition classes. Maps out the core routing links.
*   **Lines 260-376:** Defines the off-canvas Mobile Drawer menu.
*   **Lines 381-409:** Provides the mobile full-screen Search overlay popout.
*   **Lines 411-480:** Renders the "AI Planner" advertisement banner. When the dismiss button is clicked, it calls `localStorage.setItem` to ensure it remains hidden on future visits.
*   **Lines 482-495:** Renders the main semantic `<main>` content container, injecting the sub-page using React Router's `<Outlet />`.

---

## Associated Styling

### `BrowseThemesRedesign.css` (client/src/pages/css/BrowseThemesRedesign.css)
*   While containing no Javascript logic, this file defines the CSS Grid positioning responsible for the "staggered deck" layout in `BrowseThemesSection`. It maps the classes (`--a`, `--b`) exported from the component to specific grid offsets and delay animations.


# Home Page Literal Line-by-Line Breakdown (Part 2)

Here is the exact line-by-line breakdown for the next set of files in the Home Page module.

## `client/src/components/home/HomeFooter.jsx`
*   **Line 1**: `import { Link } from 'react-router-dom';` means importing the link component for navigation.
*   **Line 2**: `import { COMMUNITY_PATH } from '../../utils/discoverPaths';` means importing the community URL constant.
*   **Line 3**: `import { resolveFooterTagline } from '../../config/resolveSiteTagline';` means importing the text helper for the tagline.
*   **Line 4**: ` ` means an empty line.
*   **Line 5**: `export default function HomeFooter({ settings, t, showMap }) {` means defining the component, accepting settings and translations.
*   **Line 6**: `  return (` means starting HTML output.
*   **Line 7**: `    <footer className="vd-footer">` means opening the footer HTML tag.
*   **Line 8**: `      <div className="vd-container vd-footer-inner">` means opening the inner container to center the content.
*   **Line 9**: `        <div className="vd-footer-brand">` means opening the branding section block.
*   **Line 10**: `          <Link to="/" className="vd-footer-logo">{settings.siteName?.trim() || t('nav', 'visitTripoli')}</Link>` means showing the site name (from settings) or the default "Visit Tripoli" translation.
*   **Line 11**: `          <span className="vd-footer-tagline">{resolveFooterTagline(settings, t)}</span>` means showing the tagline text below the logo.
*   **Line 12**: `        </div>` means closing the brand section.
*   **Line 13**: `        {(settings.contactEmail || settings.contactPhone) && (` means checking if the admin has provided any contact info.
*   **Line 14**: `          <p className="vd-footer-contact-line">` means opening the contact paragraph.
*   **Line 15**: `            {settings.contactEmail?.trim() && (` means checking specifically if an email exists.
*   **Line 16**: `              <a href={\`mailto:${settings.contactEmail.trim()}\`}>{settings.contactEmail.trim()}</a>` means displaying a clickable email link.
*   **Line 17**: `            )}` means closing the email check.
*   **Line 18**: `            {settings.contactEmail?.trim() && settings.contactPhone?.trim() && ' · '}` means adding a dot separator if *both* email and phone exist.
*   **Line 19**: `            {settings.contactPhone?.trim() && <span>{settings.contactPhone.trim()}</span>}` means displaying the phone number if it exists.
*   **Line 20**: `          </p>` means closing the contact paragraph.
*   **Line 21**: `        )}` means closing the contact info block.
*   **Line 22**: `        {(settings.socialFacebook?.trim() || settings.socialInstagram?.trim() || settings.socialTwitterX?.trim()) && (` means checking if any social link exists.
*   **Line 23**: `          <div className="vd-footer-social">` means opening the social media container.
*   **Line 24**: `            {settings.socialFacebook?.trim() && (` means checking for a Facebook link.
*   **Line 25**: `              <a href={settings.socialFacebook.trim()} target="_blank" rel="noopener noreferrer">` means creating a safe external link for Facebook.
*   **Line 26**: `                Facebook` means showing the text "Facebook".
*   **Line 27**: `              </a>` means closing the Facebook link.
*   **Line 28**: `            )}` means closing the Facebook check.
*   **Line 29**: `            {settings.socialInstagram?.trim() && (` means checking for an Instagram link.
*   **Line 30**: `              <a href={settings.socialInstagram.trim()} target="_blank" rel="noopener noreferrer">` means creating a safe external link.
*   **Line 31**: `                Instagram` means showing the text "Instagram".
*   **Line 32**: `              </a>` means closing the link.
*   **Line 33**: `            )}` means closing the Instagram check.
*   **Line 34**: `            {settings.socialTwitterX?.trim() && (` means checking for a Twitter link.
*   **Line 35**: `              <a href={settings.socialTwitterX.trim()} target="_blank" rel="noopener noreferrer">` means creating a safe external link.
*   **Line 36**: `                X` means showing the text "X".
*   **Line 37**: `              </a>` means closing the link.
*   **Line 38**: `            )}` means closing the Twitter check.
*   **Line 39**: `          </div>` means closing the social container.
*   **Line 40**: `        )}` means closing the social check block.
*   **Line 41**: `        <div className="vd-footer-links">` means opening the general links container.
*   **Line 42**: `          {showMap && <Link to="/map">{t('home', 'map')}</Link>}` means showing the map link if it's allowed.
*   **Line 43**: `          <Link to={COMMUNITY_PATH}>{t('nav', 'discoverTripoli')}</Link>` means showing the community page link.
*   **Line 44**: `          <Link to="/login">{t('nav', 'signIn')}</Link>` means showing the login link.
*   **Line 45**: `          <Link to="/register">{t('nav', 'signUp')}</Link>` means showing the register link.
*   **Line 46**: `          {settings.supportUrl?.trim() && (` means checking for an external support URL.
*   **Line 47**: `            <a href={settings.supportUrl.trim()} target="_blank" rel="noopener noreferrer">` means opening the external support link.
*   **Line 48**: `              {t('home', 'contactUs')}` means showing the 'Contact Us' text.
*   **Line 49**: `            </a>` means closing the support link.
*   **Line 50**: `          )}` means closing the support URL check.
*   **Line 51**: `        </div>` means closing the general links container.
*   **Line 52**: `        <p className="vd-footer-copy">` means opening the copyright paragraph.
*   **Line 53**: `          © {new Date().getFullYear()} {settings.siteName?.trim() || t('nav', 'visitTripoli')}. {t('home', 'copyright')}` means printing the current year, site name, and copyright text.
*   **Line 54**: `        </p>` means closing the copyright paragraph.
*   **Line 55**: `      </div>` means closing the inner container.
*   **Line 56**: `    </footer>` means closing the footer tag.
*   **Line 57**: `  );` means ending the HTML output.
*   **Line 58**: `}` means closing the component function.

---

## `client/src/config/resolveSiteTagline.js`
*   **Line 1**: `/**` means opening a developer comment block.
*   **Line 2**: ` * Home hero and footer brand line always follow i18n bundles (not admin site settings).` means explaining why these bypass admin settings.
*   **Line 3**: ` * This avoids stale copy stuck in site_settings JSON from overriding shipped translations.` means continuing the explanation.
*   **Line 4**: ` */` means closing the comment block.
*   **Line 5**: ` ` means an empty line.
*   **Line 6**: `/**` means opening a jsdoc comment.
*   **Line 7**: ` * @param {unknown} _settings` means ignoring the settings parameter.
*   **Line 8**: ` * @param {(ns: string, key: string) => string} t` means typing the translation function.
*   **Line 9**: ` */` means closing the jsdoc.
*   **Line 10**: `export function resolveHeroTagline(_settings, t) {` means exporting the function.
*   **Line 11**: `  return t('home', 'heroTagline');` means returning the translated hero tagline string.
*   **Line 12**: `}` means closing the function.
*   **Line 13**: ` ` means an empty line.
*   **Line 14**: `/**` means opening a jsdoc.
*   **Line 15**: ` * @param {unknown} _settings` means ignoring the settings parameter.
*   **Line 16**: ` * @param {(ns: string, key: string) => string} t` means typing the translation function.
*   **Line 17**: ` */` means closing the jsdoc.
*   **Line 18**: `export function resolveFooterTagline(_settings, t) {` means exporting the function.
*   **Line 19**: `  return t('nav', 'navBrandTagline');` means returning the translated brand tagline string.
*   **Line 20**: `}` means closing the function.
*   **Line 21**: ` ` means an empty line.

---

## `client/src/utils/bentoHeroImage.js`
*   **Line 1**: `/**` means a comment.
*   **Line 2**: ` * LCP-friendly props for the home bento hero <img>.` means explaining the goal is to load images fast.
*   **Line 3**: ` * Unsplash: srcset with capped widths + slightly lower quality to cut bytes.` means explaining compression.
*   **Line 4**: ` * Other URLs: pass through with sizes hint for responsive layout.` means explaining the fallback.
*   **Line 5**: ` */` means ending the comment.
*   **Line 6**: `import { getDeliveryImgProps, getDeliveryPreloadSrc, BENTO_HERO_SIZES } from './responsiveImages.js';` means importing image helpers.
*   **Line 7**: ` ` means an empty line.
*   **Line 8**: `export { BENTO_HERO_SIZES };` means re-exporting the size constants for use in other files.
*   **Line 9**: ` ` means an empty line.
*   **Line 10**: `/** Default hero file: WebP variants in <picture>; PNG remains src fallback. */` means a comment.
*   **Line 11**: `export function isDefaultCityHeroPath(src) {` means creating a function to check if using the default image.
*   **Line 12**: `  const s = (src || '').trim().toLowerCase();` means formatting the string safely.
*   **Line 13**: `  if (!s) return false;` means returning false if it's empty.
*   **Line 14**: `  return s.endsWith('/city.png') || s === 'city.png';` means checking if the filename exactly matches the default.
*   **Line 15**: `}` means ending the function.
*   **Line 16**: ` ` means an empty line.
*   **Line 17**: `/**` means opening a jsdoc.
*   **Line 18**: ` * @param {string} src — resolved hero URL (same-origin, Unsplash, or admin URL)` means documenting the input.
*   **Line 19**: ` * @returns {Record<string, string | undefined>} spread onto <img>` means documenting the output.
*   **Line 20**: ` */` means closing the jsdoc.
*   **Line 21**: `export function getBentoHeroImgProps(src) {` means the function to calculate HTML image attributes.
*   **Line 22**: `  const s = (src || '').trim();` means formatting the string securely.
*   **Line 23**: `  const { src: imgSrc, srcSet, sizes } = getDeliveryImgProps(s, 'bentoHero');` means fetching responsive sizes from the helper.
*   **Line 24**: `  const out = {` means starting the output object.
*   **Line 25**: `    src: imgSrc || '',` means assigning the main image source.
*   **Line 26**: `    srcSet,` means assigning the responsive sources.
*   **Line 27**: `    sizes,` means assigning the responsive sizes.
*   **Line 28**: `    loading: 'eager',` means telling the browser to load this immediately (do not lazy load).
*   **Line 29**: `    decoding: 'async',` means telling the browser to decode without blocking the page.
*   **Line 30**: `    fetchPriority: 'high',` means telling the browser this is a top priority file.
*   **Line 31**: `  };` means closing the output object.
*   **Line 32**: `  const lower = s.toLowerCase();` means creating a lowercase version.
*   **Line 33**: `  if (lower.endsWith('/city.png') || lower.endsWith('city.png')) {` means checking if it is the default image.
*   **Line 34**: `    out.width = 1024;` means setting a static width to prevent layout shift.
*   **Line 35**: `    out.height = 673;` means setting a static height to prevent layout shift.
*   **Line 36**: `  }` means closing the if condition.
*   **Line 37**: `  return out;` means returning the attributes.
*   **Line 38**: `}` means closing the function.
*   **Line 39**: ` ` means an empty line.
*   **Line 40**: `/** URL to put in <link rel="preload"> (matches default img src, not full srcset). */` means a comment.
*   **Line 41**: `export function getBentoHeroPreloadHref(src) {` means creating a function to get the preload URL.
*   **Line 42**: `  return getDeliveryPreloadSrc(src, 'bentoHero');` means delegating the calculation to the helper.
*   **Line 43**: `}` means closing the function.
*   **Line 44**: ` ` means an empty line.
*   **Line 45**: `/**` means opening a jsdoc.
*   **Line 46**: ` * Absolute http(s) URL safe for <link rel="preload" as="image"> (avoids empty/invalid href console warnings).` means a comment explaining its purpose.
*   **Line 47**: ` * @param {string} raw` means documenting the input.
*   **Line 48**: ` * @returns {string | null}` means documenting the output.
*   **Line 49**: ` */` means closing the jsdoc.
*   **Line 50**: `export function normalizePreloadImageHref(raw) {` means creating a function to clean the preload URL.
*   **Line 51**: `  if (typeof raw !== 'string') return null;` means checking for a valid text type.
*   **Line 52**: `  const s = raw.trim();` means trimming whitespace.
*   **Line 53**: `  if (!s || /^data:/i.test(s) || /^blob:/i.test(s) || /^\s*javascript:/i.test(s)) return null;` means rejecting inline, blob, or javascript formats.
*   **Line 54**: `  if (typeof window === 'undefined' || !window.location?.origin) return null;` means checking if this is running in a browser environment.
*   **Line 55**: `  try {` means starting the error handling block.
*   **Line 56**: `    const abs = new URL(s, window.location.origin);` means constructing an absolute URL object.
*   **Line 57**: `    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;` means ensuring it is a secure web protocol.
*   **Line 58**: `    return abs.href;` means returning the final absolute string.
*   **Line 59**: `  } catch {` means catching invalid URL crash errors.
*   **Line 60**: `    return null;` means returning nothing on error.
*   **Line 61**: `  }` means closing the error handling.
*   **Line 62**: `}` means closing the function.


## `client/src/utils/siteSeo.js`
*   **Line 1**: `import {` means opening the import block for SEO constants.
*   **Line 2**: `  SITE_BRAND_NAME,` means importing the brand name string.
*   **Line 3**: `  SITE_DEFAULT_DESCRIPTION,` means importing the default meta description.
*   **Line 4**: `  SITE_DEFAULT_TITLE,` means importing the default page title.
*   **Line 5**: `  SITE_OG_IMAGE_PATH,` means importing the path for the social preview image.
*   **Line 6**: `  SITE_TITLE_SUFFIX,` means importing the suffix appended to custom titles.
*   **Line 7**: `} from '../config/siteSeo.js';` means closing the imports from the config file.
*   **Line 8**: ` ` means an empty line.
*   **Line 9**: `export function upsertMetaName(name, content) {` means defining a function to create or update standard `<meta name="...">` HTML tags.
*   **Line 10**: `  if (!content) return;` means if no content is provided, do nothing and exit the function.
*   **Line 11**: `  let meta = [...document.head.querySelectorAll('meta[name]')].find((m) => m.getAttribute('name') === name);` means searching the page's HTML `<head>` for an existing meta tag that has the given name.
*   **Line 12**: `  if (!meta) {` means if the tag doesn't exist yet...
*   **Line 13**: `    meta = document.createElement('meta');` means creating a new, blank HTML meta element.
*   **Line 14**: `    meta.setAttribute('name', name);` means setting its name attribute.
*   **Line 15**: `    document.head.appendChild(meta);` means injecting the new tag into the page's head section.
*   **Line 16**: `  }` means closing the if block.
*   **Line 17**: `  meta.setAttribute('content', content);` means updating the actual content attribute of the meta tag to the new text.
*   **Line 18**: `}` means closing the function.
*   **Line 19**: ` ` means an empty line.
*   **Line 20**: `export function upsertMetaProperty(property, content) {` means defining a similar function but for `<meta property="...">` tags (used specifically for OpenGraph/Facebook previews).
*   **Line 21**: `  if (!content) return;` means aborting if there is no content text.
*   **Line 22**: `  let meta = [...document.head.querySelectorAll('meta[property]')].find((m) => m.getAttribute('property') === property);` means finding the existing property tag.
*   **Line 23**: `  if (!meta) {` means if the tag is not found...
*   **Line 24**: `    meta = document.createElement('meta');` means creating a new meta element.
*   **Line 25**: `    meta.setAttribute('property', property);` means setting the property attribute.
*   **Line 26**: `    document.head.appendChild(meta);` means injecting the tag into the DOM.
*   **Line 27**: `  }` means closing the if block.
*   **Line 28**: `  meta.setAttribute('content', content);` means setting the actual value of the tag.
*   **Line 29**: `}` means closing the function.
*   **Line 30**: ` ` means an empty line.
*   **Line 31**: `/**` means opening a jsdoc comment block.
*   **Line 32**: ` * Public origin for absolute OG URLs in the browser (VITE_PUBLIC_SITE_URL or window.location.origin).` means explaining that social media sites require full URLs (with https://), not relative paths.
*   **Line 33**: ` */` means closing the comment block.
*   **Line 34**: `export function getPublicSiteOrigin() {` means defining a function to get the base website URL.
*   **Line 35**: `  const v = import.meta.env.VITE_PUBLIC_SITE_URL;` means reading the URL from the server's environment variables.
*   **Line 36**: `  if (v != null && String(v).trim() !== '') {` means checking if the environment variable is actually set and valid.
*   **Line 37**: `    return String(v).replace(/\/$/, '');` means returning the URL and safely removing any trailing slashes to prevent double slashes later.
*   **Line 38**: `  }` means closing the if block.
*   **Line 39**: `  if (typeof window !== 'undefined') return window.location.origin;` means falling back to reading the browser's current URL if the environment variable is missing.
*   **Line 40**: `  return '';` means returning an empty string if all methods fail.
*   **Line 41**: `}` means closing the function.
*   **Line 42**: ` ` means an empty line.
*   **Line 43**: `export function absolutePublicUrl(path) {` means defining a function to convert relative paths (like `/image.png`) to full URLs.
*   **Line 44**: `  const origin = getPublicSiteOrigin();` means getting the base URL from the helper above.
*   **Line 45**: `  const p = path.startsWith('/') ? path : \`/\${path}\`;` means ensuring the path starts with a slash so it connects properly.
*   **Line 46**: `  return origin ? \`\${origin}\${p}\` : p;` means combining them into a full URL if possible, otherwise returning the path.
*   **Line 47**: `}` means closing the function.
*   **Line 48**: ` ` means an empty line.
*   **Line 49**: `/**` means opening a jsdoc comment block.
*   **Line 50**: ` * Sync home page meta when /api/.../site-settings loads (description override + titles).` means a comment explaining that this function syncs the browser's SEO tags with the admin settings.
*   **Line 51**: ` */` means closing the comment block.
*   **Line 52**: `export function applyHomeSeoFromSettings(settings = {}) {` means defining the main SEO update function, defaulting to an empty settings object.
*   **Line 53**: `  const desc = (settings.metaDescription && String(settings.metaDescription).trim()) || SITE_DEFAULT_DESCRIPTION;` means using the custom admin description if available, or falling back to the hardcoded default.
*   **Line 54**: `  const siteName = settings.siteName && String(settings.siteName).trim();` means extracting the custom site name safely.
*   **Line 55**: `  const title = siteName ? \`\${siteName} – \${SITE_TITLE_SUFFIX}\` : SITE_DEFAULT_TITLE;` means building the browser tab title by combining the site name and the suffix string.
*   **Line 56**: ` ` means an empty line.
*   **Line 57**: `  document.title = title;` means immediately updating the actual browser tab title that the user sees.
*   **Line 58**: `  upsertMetaName('description', desc);` means updating the Google search description tag.
*   **Line 59**: `  upsertMetaProperty('og:type', 'website');` means setting the OpenGraph type to website for social media.
*   **Line 60**: `  upsertMetaProperty('og:title', title);` means setting the OpenGraph title for Facebook and iMessage previews.
*   **Line 61**: `  upsertMetaProperty('og:description', desc);` means setting the OpenGraph description.
*   **Line 62**: `  upsertMetaProperty('og:site_name', siteName || SITE_BRAND_NAME);` means setting the OpenGraph site name.
*   **Line 63**: `  upsertMetaName('twitter:card', 'summary');` means setting the Twitter preview card to a standard summary style.
*   **Line 64**: `  upsertMetaName('twitter:title', title);` means setting the specific title for Twitter.
*   **Line 65**: `  upsertMetaName('twitter:description', desc);` means setting the specific description for Twitter.
*   **Line 66**: ` ` means an empty line.
*   **Line 67**: `  const ogImage = absolutePublicUrl(SITE_OG_IMAGE_PATH);` means calculating the full, absolute URL for the preview thumbnail image.
*   **Line 68**: `  if (ogImage.startsWith('http')) {` means double-checking that the calculated URL is actually a valid HTTP link.
*   **Line 69**: `    upsertMetaProperty('og:image', ogImage);` means setting the Facebook/social preview image.
*   **Line 70**: `    upsertMetaName('twitter:image', ogImage);` means setting the Twitter preview image.
*   **Line 71**: `  }` means closing the image check block.
*   **Line 72**: `}` means closing the function.

---

## `client/src/config/homeBentoVisuals.js`
*   **Line 1**: `/**` means opening a developer comment block.
*   **Line 2**: ` * Default home bento imagery — hero/mosaic fallbacks; avatar circles prefer **live directory** photos (see \`resolveBentoAvatarSlots\`).` means explaining the fallback logic for images.
*   **Line 3**: ` * Override per field from Site settings (Admin → Features) with full HTTPS URLs or \`/…\` public paths.` means explaining that admins can replace these images.
*   **Line 4**: ` *` means a formatting spacer.
*   **Line 5**: ` * Hero: \`client/public/city.png\` + responsive \`city-*.webp\` (see \`npm run optimize:city\`). Stock avatars below are unused when enough places in the API have images.` means explaining where the main hero image files live on the server.
*   **Line 6**: ` * Unsplash (side/mosaic): https://unsplash.com/license` means attributing the placeholder images to Unsplash.
*   **Line 7**: ` */` means closing the comment block.
*   **Line 8**: `const U = 'https://images.unsplash.com';` means creating a shorthand variable for the Unsplash domain to save space.
*   **Line 9**: `/** Smaller default width + quality — layout uses srcset on hero; backgrounds still benefit from lighter files */` means a comment explaining the image compression parameters.
*   **Line 10**: `const q = 'auto=format&fit=crop&w=1280&q=78';` means setting the URL parameters that tell Unsplash to crop and compress the images to 78% quality.
*   **Line 11**: `const HB = '/home-bento';` means creating a shorthand variable for the local home bento images folder.
*   **Line 12**: ` ` means an empty line.
*   **Line 13**: `export const homeBentoDefaults = {` means defining and exporting the default configuration object for the images.
*   **Line 14**: `  /** Main hero — Citadel of Tripoli (local file) */` means a comment identifying the main hero image.
*   **Line 15**: `  hero: '/city.png',` means setting the main background image to the local city.png file.
*   **Line 16**: `  /** Discover card — golden hour waterfront */` means a comment identifying the side image.
*   **Line 17**: `  side: \`\${U}/photo-1507525428034-b723cf961d3e?\${q}\`,` means setting the side panel image using the Unsplash URL and compression parameters.
*   **Line 18**: `  /** Middle tile — Tripoli / Mediterranean coast (local file) */` means a comment identifying the "Why Visit" tile image.
*   **Line 19**: `  why: \`\${HB}/hero-tripoli-coast.jpg\`,` means setting the tile image to a local file.
*   **Line 20**: `  /** Mosaic — Mediterranean rooftops / sea */` means a comment identifying the bottom mosaic image.
*   **Line 21**: `  mosaic: \`\${U}/photo-1523906834658-6e24ef2386f9?\${q}\`,` means setting the mosaic image using an Unsplash placeholder.
*   **Line 22**: `  /** Tripoli-area vibes: harbour / corniche, coast, north Lebanon hills */` means a comment explaining the default avatar photos.
*   **Line 23**: `  avatars: [` means opening the array of default avatar photos.
*   **Line 24**: `    \`\${HB}/avatar-mediterranean-port.jpg\`,` means setting the first default circle photo.
*   **Line 25**: `    \`\${HB}/avatar-coastal-lebanon.jpg\`,` means setting the second default circle photo.
*   **Line 26**: `    \`\${HB}/avatar-lebanon-hills.jpg\`,` means setting the third default circle photo.
*   **Line 27**: `  ],` means closing the avatars array.
*   **Line 28**: `};` means closing the defaults object.
*   **Line 29**: ` ` means an empty line.
*   **Line 30**: `function pick(settings, key, fallback) {` means defining a helper function to safely pull values from the settings database.
*   **Line 31**: `  if (!settings || typeof settings !== 'object') return fallback;` means returning the default image if the settings object is broken.
*   **Line 32**: `  const v = settings[key];` means attempting to read the specific image key from the settings.
*   **Line 33**: `  if (typeof v === 'string' && v.trim()) return v.trim();` means returning the admin's custom image URL if it exists and is a valid string.
*   **Line 34**: `  return fallback;` means returning the default image if the admin left the setting blank.
*   **Line 35**: `}` means closing the function.
*   **Line 36**: ` ` means an empty line.
*   **Line 37**: `/** Safe \`url("...")\` for CSS custom properties. */` means a comment explaining the CSS formatter function.
*   **Line 38**: `export function bentoCssUrl(href) {` means defining the formatting function.
*   **Line 39**: `  return \`url(\${JSON.stringify(href)})\`;` means wrapping the image URL in `url("")` and safely escaping quotes so it doesn't break CSS rules.
*   **Line 40**: `}` means closing the function.
*   **Line 41**: ` ` means an empty line.
*   **Line 42**: `/**` means opening a jsdoc comment block.
*   **Line 43**: ` * @param {Record<string, unknown>} settings — merged site settings from API` means documenting the input.
*   **Line 44**: ` * @returns {{ hero: string, side: string, why: string, mosaic: string, avatars: string[] }}` means documenting the output.
*   **Line 45**: ` */` means closing the comment block.
*   **Line 46**: `export function resolveHomeBentoVisuals(settings) {` means defining the main function that coordinates all the images for the home page.
*   **Line 47**: `  const d = homeBentoDefaults;` means creating a shorthand variable for the defaults.
*   **Line 48**: `  const hero = pick(settings, 'homeBentoHeroImage', d.hero);` means checking settings for a custom Hero image, otherwise using the default.
*   **Line 49**: `  const side = pick(settings, 'homeBentoSideImage', d.side);` means checking settings for a custom Side image.
*   **Line 50**: `  const why = pick(settings, 'homeBentoWhyImage', d.why);` means checking settings for a custom 'Why Visit' image.
*   **Line 51**: `  const mosaic = pick(settings, 'homeBentoMosaicImage', d.mosaic);` means checking settings for a custom Mosaic image.
*   **Line 52**: `  const a1 = pick(settings, 'homeBentoAvatar1', d.avatars[0]);` means checking settings for custom Avatar 1.
*   **Line 53**: `  const a2 = pick(settings, 'homeBentoAvatar2', d.avatars[1]);` means checking settings for custom Avatar 2.
*   **Line 54**: `  const a3 = pick(settings, 'homeBentoAvatar3', d.avatars[2]);` means checking settings for custom Avatar 3.
*   **Line 55**: `  const avatars = [a1, a2, a3].filter(Boolean);` means grouping the 3 avatars into an array and removing any blank ones.
*   **Line 56**: `  return { hero, side, why, mosaic, avatars };` means returning the final collection of URLs for the React component to display.
*   **Line 57**: `}` means closing the function.
*   **Line 58**: ` ` means an empty line.
*   **Line 59**: `const AVATAR_SETTING_KEYS = ['homeBentoAvatar1', 'homeBentoAvatar2', 'homeBentoAvatar3'];` means defining an array of the database keys used for the avatar images.
*   **Line 60**: ` ` means an empty line.
*   **Line 61**: `/**` means opening a jsdoc comment block.
*   **Line 62**: ` * Three hero avatar slots: Admin URL per slot wins; otherwise top-rated **directory** places with photos.` means a comment explaining that live database photos override stock photos.
*   **Line 63**: ` * @param {Record<string, unknown>} settings` means documenting the settings parameter.
*   **Line 64**: ` * @param {unknown[]} places` means documenting the array of all places in the database.
*   **Line 65**: ` * @param {(place: Record<string, unknown>) => string | null | undefined} imageUrlForPlace` means documenting a helper function that extracts images from place objects.
*   **Line 66**: ` * @returns {{ href: string | null, placeId: string | null }[]}` means documenting the final array structure.
*   **Line 67**: ` */` means closing the jsdoc block.
*   **Line 68**: `export function resolveBentoAvatarSlots(settings, places, imageUrlForPlace) {` means defining the complex function that decides what goes into the 3 circular photo slots on the hero image.
*   **Line 69**: `  const src = typeof imageUrlForPlace === 'function' ? imageUrlForPlace : () => null;` means ensuring the image extraction helper is a valid function.
*   **Line 70**: `  const list = Array.isArray(places) ? places : [];` means safely parsing the places list.
*   **Line 71**: `  const sorted = [...list].sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0));` means sorting all places in the database so the highest-rated ones are at the front of the list.
*   **Line 72**: `  const withImages = sorted.filter((p) => {` means filtering the list down to only places that actually have photos attached to them.
*   **Line 73**: `    const u = src(p);` means extracting the image URL for the current place.
*   **Line 74**: `    return typeof u === 'string' && u.trim().length > 0;` means keeping the place only if the image URL is a valid string.
*   **Line 75**: `  });` means closing the filter block.
*   **Line 76**: `  let poolIdx = 0;` means setting a counter to track our position in the list of available images.
*   **Line 77**: `  const usedIds = new Set();` means creating a Set to ensure we don't show the exact same place twice in the 3 circle slots.
*   **Line 78**: `  /** @type {{ href: string | null, placeId: string | null }[]} */` means documenting the upcoming array.
*   **Line 79**: `  const slots = [];` means initializing the empty array to hold our 3 chosen avatars.
*   **Line 80**: ` ` means an empty line.
*   **Line 81**: `  for (let i = 0; i < 3; i++) {` means starting a loop that will run exactly 3 times (once for each circle slot).
*   **Line 82**: `    const override = pick(settings, AVATAR_SETTING_KEYS[i], '');` means checking if the admin has explicitly set a custom photo for this specific slot.
*   **Line 83**: `    if (override) {` means if a custom photo exists...
*   **Line 84**: `      slots.push({ href: override, placeId: null });` means adding the custom photo to the slot, noting that it doesn't link to any specific place.
*   **Line 85**: `      continue;` means skipping to the next loop iteration (the next slot).
*   **Line 86**: `    }` means closing the if block.
*   **Line 87**: `    let found = null;` means initializing a variable to track if we found a suitable place image.
*   **Line 88**: `    while (poolIdx < withImages.length) {` means looping through our available high-rated places.
*   **Line 89**: `      const p = withImages[poolIdx++];` means getting the next place in line and incrementing the counter.
*   **Line 90**: `      const id = p?.id != null ? String(p.id) : '';` means extracting the place's unique ID.
*   **Line 91**: `      if (!id || usedIds.has(id)) continue;` means skipping this place if it doesn't have an ID or if we already used it for a previous circle.
*   **Line 92**: `      const hrefRaw = src(p);` means extracting the raw image URL.
*   **Line 93**: `      const href = typeof hrefRaw === 'string' && hrefRaw.trim() ? hrefRaw.trim() : null;` means cleaning the URL string safely.
*   **Line 94**: `      if (!href) continue;` means skipping if the URL is broken.
*   **Line 95**: `      usedIds.add(id);` means marking this place ID as "used" so we don't repeat it.
*   **Line 96**: `      found = { href, placeId: id };` means we successfully found an image and its corresponding place link.
*   **Line 97**: `      break;` means stopping the while loop since we filled the slot.
*   **Line 98**: `    }` means closing the while loop.
*   **Line 99**: `    slots.push(found || { href: null, placeId: null });` means adding the found image to the array, or a blank placeholder if we ran out of images.
*   **Line 100**: `  }` means closing the main 3-slot for loop.
*   **Line 101**: ` ` means an empty line.
*   **Line 102**: `  let sortedIdx = 0;` means creating a fallback counter for a secondary pass.
*   **Line 103**: `  for (let i = 0; i < slots.length; i++) {` means looping through our 3 slots one last time to double check them.
*   **Line 104**: `    if (slots[i].href || slots[i].placeId) continue;` means skipping the slot if it successfully found an image earlier.
*   **Line 105**: `    while (sortedIdx < sorted.length) {` means looping through the main sorted list if we had blank slots. (This is a safety net).
*   **Line 106**: `      const p = sorted[sortedIdx++];` means getting the next place.
*   **Line 107**: `      const id = p?.id != null ? String(p.id) : '';` means getting the ID.
*   **Line 108**: `      if (!id || usedIds.has(id)) continue;` means skipping if used.
*   **Line 109**: `      usedIds.add(id);` means marking as used.
*   **Line 110**: `      const hrefRaw = src(p);` means getting the image.
*   **Line 111**: `      const href = typeof hrefRaw === 'string' && hrefRaw.trim() ? hrefRaw.trim() : null;` means cleaning the URL.
*   **Line 112**: `      slots[i] = { href, placeId: id };` means assigning the fallback image to the blank slot.
*   **Line 113**: `      break;` means stopping the fallback search for this slot.
*   **Line 114**: `    }` means closing the while loop.
*   **Line 115**: `  }` means closing the for loop.
*   **Line 116**: ` ` means an empty line.
*   **Line 117**: `  return slots;` means returning the final array of 3 image URLs to be rendered as circles on the home page.
*   **Line 118**: `}` means closing the function.
*   **Line 119**: ` ` means the end of the file.

## `client/src/pages/Explore.jsx`
*   **Line 1**: `import { useState, useEffect, useCallback, useMemo } from 'react';` means importing a necessary component, module, or hook.
*   **Line 2**: `import { Link } from 'react-router-dom';` means importing a necessary component, module, or hook.
*   **Line 3**: `import api, { getPlaceImageUrl } from '../api/client';` means importing a necessary component, module, or hook.
*   **Line 4**: `import { useLanguage } from '../context/LanguageContext';` means importing a necessary component, module, or hook.
*   **Line 5**: `import { useAuth } from '../context/AuthContext';` means importing a necessary component, module, or hook.
*   **Line 6**: `import { useSiteSettings } from '../context/SiteSettingsContext';` means importing a necessary component, module, or hook.
*   **Line 7**: `import EventsAndToursSection from '../components/EventsAndToursSection';` means importing a necessary component, module, or hook.
*   **Line 8**: `import { trackEvent } from '../utils/analytics';` means importing a necessary component, module, or hook.
*   **Line 9**: `import { homeBentoDefaults, resolveHomeBentoVisuals, resolveBentoAvatarSlots } from '../config/homeBentoVisuals';` means importing a necessary component, module, or hook.
*   **Line 10**: `import {` means importing a necessary component, module, or hook.
*   **Line 11**: `  getBentoHeroPreloadHref,` means executing standard component logic or rendering a nested HTML element.
*   **Line 12**: `  normalizePreloadImageHref,` means executing standard component logic or rendering a nested HTML element.
*   **Line 13**: `} from '../utils/bentoHeroImage';` means closing the current function or code block.
*   **Line 14**: `import { resolveHeroTagline } from '../config/resolveSiteTagline';` means importing a necessary component, module, or hook.
*   **Line 15**: `import {` means importing a necessary component, module, or hook.
*   **Line 16**: `  PLACES_DISCOVER_PATH,` means executing standard component logic or rendering a nested HTML element.
*   **Line 17**: `} from '../utils/discoverPaths';` means closing the current function or code block.
*   **Line 18**: `import { applyHomeSeoFromSettings } from '../utils/siteSeo';` means importing a necessary component, module, or hook.
*   **Line 19**: `import {` means importing a necessary component, module, or hook.
*   **Line 20**: `  formatDirectoryCount,` means executing standard component logic or rendering a nested HTML element.
*   **Line 21**: `} from '../utils/findYourWayGrouping';` means closing the current function or code block.
*   **Line 22**: `import {` means importing a necessary component, module, or hook.
*   **Line 23**: `  filterGeneralDirectoryPlaces,` means executing standard component logic or rendering a nested HTML element.
*   **Line 24**: `} from '../utils/placeGuideExclusions';` means closing the current function or code block.
*   **Line 25**: `` means an empty line for visual spacing.
*   **Line 26**: `// Home Section Components` means a developer comment explaining the code.
*   **Line 27**: `import HomeBento from '../components/home/HomeBento';` means importing a necessary component, module, or hook.
*   **Line 28**: `import TopPicksSection from '../components/home/TopPicksSection';` means importing a necessary component, module, or hook.
*   **Line 29**: `import CommunitySection from '../components/home/CommunitySection';` means importing a necessary component, module, or hook.
*   **Line 30**: `import PracticalSection from '../components/home/PracticalSection';` means importing a necessary component, module, or hook.
*   **Line 31**: `import PlanVisitSection from '../components/home/PlanVisitSection';` means importing a necessary component, module, or hook.
*   **Line 32**: `import BrowseThemesSection from '../components/home/BrowseThemesSection';` means importing a necessary component, module, or hook.
*   **Line 33**: `import HomeUtilityBar from '../components/home/HomeUtilityBar';` means importing a necessary component, module, or hook.
*   **Line 34**: `import HomeFooter from '../components/home/HomeFooter';` means importing a necessary component, module, or hook.
*   **Line 35**: `` means an empty line for visual spacing.
*   **Line 36**: `import './css/Explore.css';` means importing a necessary component, module, or hook.
*   **Line 37**: `import './css/CommunityFeedRedesign.css';` means importing a necessary component, module, or hook.
*   **Line 38**: `import './css/PlanYourVisitRedesign.css';` means importing a necessary component, module, or hook.
*   **Line 39**: `import './css/FindYourWayRedesign.css';` means importing a necessary component, module, or hook.
*   **Line 40**: `import './css/BrowseThemesRedesign.css';` means importing a necessary component, module, or hook.
*   **Line 41**: `` means an empty line for visual spacing.
*   **Line 42**: `export default function Explore() {` means defining and exporting the main React component.
*   **Line 43**: `  const { t, lang } = useLanguage();` means declaring a local variable to store data.
*   **Line 44**: `  const { user } = useAuth();` means declaring a local variable to store data.
*   **Line 45**: `  const { settings } = useSiteSettings();` means declaring a local variable to store data.
*   **Line 46**: `  const [places, setPlaces] = useState([]);` means initializing a React state variable to track data changes.
*   **Line 47**: `  const [categories, setCategories] = useState([]);` means initializing a React state variable to track data changes.
*   **Line 48**: `  const [categoryCount, setCategoryCount] = useState(0);` means initializing a React state variable to track data changes.
*   **Line 49**: `  const [loading, setLoading] = useState(true);` means initializing a React state variable to track data changes.
*   **Line 50**: `  const [error, setError] = useState(null);` means initializing a React state variable to track data changes.
*   **Line 51**: `  const [communityPosts, setCommunityPosts] = useState([]);` means initializing a React state variable to track data changes.
*   **Line 52**: `  const [homeEvents, setHomeEvents] = useState([]);` means initializing a React state variable to track data changes.
*   **Line 53**: `  const [homeTours, setHomeTours] = useState([]);` means initializing a React state variable to track data changes.
*   **Line 54**: `  const [loadNonce, setLoadNonce] = useState(0);` means initializing a React state variable to track data changes.
*   **Line 55**: `` means an empty line for visual spacing.
*   **Line 56**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 57**: `    const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';` means declaring a local variable to store data.
*   **Line 58**: `    let cancelled = false;` means declaring a local variable to store data.
*   **Line 59**: `    setLoading(true);` means executing standard component logic or rendering a nested HTML element.
*   **Line 60**: `    setError(null);` means executing standard component logic or rendering a nested HTML element.
*   **Line 61**: `    Promise.allSettled([api.places.list({ lang: langParam }), api.categories.list({ lang: langParam })])` means fetching multiple pieces of data from the API simultaneously.
*   **Line 62**: `      .then((results) => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 63**: `        if (cancelled) return;` means checking a specific logic condition before proceeding.
*   **Line 64**: `        const [pRes, cRes] = results;` means declaring a local variable to store data.
*   **Line 65**: `        if (pRes.status === 'rejected') {` means checking a specific logic condition before proceeding.
*   **Line 66**: `          const err = pRes.reason;` means declaring a local variable to store data.
*   **Line 67**: `          const apiErr = err?.data?.error || err?.message;` means declaring a local variable to store data.
*   **Line 68**: `          const detail =` means declaring a local variable to store data.
*   **Line 69**: `            import.meta.env.DEV && err?.data?.detail ? '\n\n${err.data.detail}' : '';` means importing a necessary component, module, or hook.
*   **Line 70**: `          setError(String(apiErr || err || 'Failed to load') + detail);` means executing standard component logic or rendering a nested HTML element.
*   **Line 71**: `          return;` means executing standard component logic or rendering a nested HTML element.
*   **Line 72**: `        }` means closing the current function or code block.
*   **Line 73**: `        const pr = pRes.value;` means declaring a local variable to store data.
*   **Line 74**: `        const pl = pr.popular || pr.locations || [];` means declaring a local variable to store data.
*   **Line 75**: `        setPlaces(Array.isArray(pl) ? pl : []);` means executing standard component logic or rendering a nested HTML element.
*   **Line 76**: `        if (cRes.status === 'fulfilled') {` means checking a specific logic condition before proceeding.
*   **Line 77**: `          const cats = cRes.value?.categories || [];` means declaring a local variable to store data.
*   **Line 78**: `          const arr = Array.isArray(cats) ? cats : [];` means declaring a local variable to store data.
*   **Line 79**: `          setCategories(arr);` means executing standard component logic or rendering a nested HTML element.
*   **Line 80**: `          setCategoryCount(arr.length);` means executing standard component logic or rendering a nested HTML element.
*   **Line 81**: `        } else {` means closing the current function or code block.
*   **Line 82**: `          setCategories([]);` means executing standard component logic or rendering a nested HTML element.
*   **Line 83**: `          setCategoryCount(0);` means executing standard component logic or rendering a nested HTML element.
*   **Line 84**: `        }` means closing the current function or code block.
*   **Line 85**: `      })` means closing the current function or code block.
*   **Line 86**: `      .finally(() => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 87**: `        if (!cancelled) setLoading(false);` means checking a specific logic condition before proceeding.
*   **Line 88**: `      });` means closing the current function or code block.
*   **Line 89**: `    return () => {` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 90**: `      cancelled = true;` means executing standard component logic or rendering a nested HTML element.
*   **Line 91**: `    };` means closing the current function or code block.
*   **Line 92**: `  }, [lang, loadNonce]);` means closing the current function or code block.
*   **Line 93**: `` means an empty line for visual spacing.
*   **Line 94**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 95**: `    if (loading || error) return;` means checking a specific logic condition before proceeding.
*   **Line 96**: `    const hash = window.location.hash;` means declaring a local variable to store data.
*   **Line 97**: `    const allowedHashes = ['#plan', '#experience', '#why', '#plan-trip', '#download-app', '#community', '#areas'];` means declaring a local variable to store data.
*   **Line 98**: `    if (hash && allowedHashes.includes(hash)) {` means checking a specific logic condition before proceeding.
*   **Line 99**: `      const el = document.querySelector(hash);` means declaring a local variable to store data.
*   **Line 100**: `      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });` means checking a specific logic condition before proceeding.
*   **Line 101**: `    }` means closing the current function or code block.
*   **Line 102**: `  }, [loading, error]);` means closing the current function or code block.
*   **Line 103**: `` means an empty line for visual spacing.
*   **Line 104**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 105**: `    trackEvent(user, 'page_view', { page: 'home' });` means executing standard component logic or rendering a nested HTML element.
*   **Line 106**: `  }, [user]);` means closing the current function or code block.
*   **Line 107**: `` means an empty line for visual spacing.
*   **Line 108**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 109**: `    let cancelled = false;` means declaring a local variable to store data.
*   **Line 110**: `    Promise.allSettled([api.events.list({ lang }), api.tours.list({ lang })])` means fetching multiple pieces of data from the API simultaneously.
*   **Line 111**: `      .then(([evRes, toRes]) => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 112**: `        if (cancelled) return;` means checking a specific logic condition before proceeding.
*   **Line 113**: `        if (evRes.status === 'fulfilled') {` means checking a specific logic condition before proceeding.
*   **Line 114**: `          const ev = evRes.value?.events || [];` means declaring a local variable to store data.
*   **Line 115**: `          setHomeEvents(Array.isArray(ev) ? ev.slice(0, 8) : []);` means executing standard component logic or rendering a nested HTML element.
*   **Line 116**: `        }` means closing the current function or code block.
*   **Line 117**: `        if (toRes.status === 'fulfilled') {` means checking a specific logic condition before proceeding.
*   **Line 118**: `          const to = toRes.value?.featured || [];` means declaring a local variable to store data.
*   **Line 119**: `          setHomeTours(Array.isArray(to) ? to.slice(0, 8) : []);` means executing standard component logic or rendering a nested HTML element.
*   **Line 120**: `        }` means closing the current function or code block.
*   **Line 121**: `      })` means closing the current function or code block.
*   **Line 122**: `      .catch(() => {});` means executing standard component logic or rendering a nested HTML element.
*   **Line 123**: `    return () => { cancelled = true; };` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 124**: `  }, [lang]);` means closing the current function or code block.
*   **Line 125**: `` means an empty line for visual spacing.
*   **Line 126**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 127**: `    applyHomeSeoFromSettings(settings);` means executing standard component logic or rendering a nested HTML element.
*   **Line 128**: `  }, [settings.metaDescription, settings.siteName]);` means closing the current function or code block.
*   **Line 129**: `` means an empty line for visual spacing.
*   **Line 130**: `  const bentoHeroUrl = useMemo(() => resolveHomeBentoVisuals(settings).hero, [settings]);` means declaring a local variable to store data.
*   **Line 131**: `` means an empty line for visual spacing.
*   **Line 132**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 133**: `    const id = 'tripoli-preload-bento-hero';` means declaring a local variable to store data.
*   **Line 134**: `    const heroTrim = (bentoHeroUrl || '').trim();` means declaring a local variable to store data.
*   **Line 135**: `    const defaultHero = (homeBentoDefaults.hero || '').trim();` means declaring a local variable to store data.
*   **Line 136**: `    if (heroTrim === defaultHero) {` means checking a specific logic condition before proceeding.
*   **Line 137**: `      document.getElementById(id)?.remove();` means executing standard component logic or rendering a nested HTML element.
*   **Line 138**: `      return undefined;` means returning a computed value from the function.
*   **Line 139**: `    }` means closing the current function or code block.
*   **Line 140**: `    const raw = getBentoHeroPreloadHref(bentoHeroUrl);` means declaring a local variable to store data.
*   **Line 141**: `    const href = normalizePreloadImageHref(raw);` means declaring a local variable to store data.
*   **Line 142**: `    if (!href) {` means checking a specific logic condition before proceeding.
*   **Line 143**: `      document.getElementById(id)?.remove();` means executing standard component logic or rendering a nested HTML element.
*   **Line 144**: `      return undefined;` means returning a computed value from the function.
*   **Line 145**: `    }` means closing the current function or code block.
*   **Line 146**: `    let link = document.getElementById(id);` means declaring a local variable to store data.
*   **Line 147**: `    if (!link) {` means checking a specific logic condition before proceeding.
*   **Line 148**: `      link = document.createElement('link');` means executing standard component logic or rendering a nested HTML element.
*   **Line 149**: `      link.id = id;` means executing standard component logic or rendering a nested HTML element.
*   **Line 150**: `      link.rel = 'preload';` means executing standard component logic or rendering a nested HTML element.
*   **Line 151**: `      link.as = 'image';` means executing standard component logic or rendering a nested HTML element.
*   **Line 152**: `      document.head.appendChild(link);` means executing standard component logic or rendering a nested HTML element.
*   **Line 153**: `    }` means closing the current function or code block.
*   **Line 154**: `    link.href = href;` means executing standard component logic or rendering a nested HTML element.
*   **Line 155**: `    link.setAttribute('fetchpriority', 'high');` means executing standard component logic or rendering a nested HTML element.
*   **Line 156**: `    return () => {` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 157**: `      link?.remove();` means executing standard component logic or rendering a nested HTML element.
*   **Line 158**: `    };` means closing the current function or code block.
*   **Line 159**: `  }, [bentoHeroUrl]);` means closing the current function or code block.
*   **Line 160**: `` means an empty line for visual spacing.
*   **Line 161**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 162**: `    let cancelled = false;` means declaring a local variable to store data.
*   **Line 163**: `    api` means executing standard component logic or rendering a nested HTML element.
*   **Line 164**: `      .communityFeed({ limit: 48, sort: 'smart' })` means executing standard component logic or rendering a nested HTML element.
*   **Line 165**: `      .then((r) => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 166**: `        if (!cancelled) setCommunityPosts(Array.isArray(r.posts) ? r.posts : []);` means checking a specific logic condition before proceeding.
*   **Line 167**: `      })` means closing the current function or code block.
*   **Line 168**: `      .catch(() => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 169**: `        if (!cancelled) setCommunityPosts([]);` means checking a specific logic condition before proceeding.
*   **Line 170**: `      });` means closing the current function or code block.
*   **Line 171**: `    return () => {` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 172**: `      cancelled = true;` means executing standard component logic or rendering a nested HTML element.
*   **Line 173**: `    };` means closing the current function or code block.
*   **Line 174**: `  }, []);` means closing the current function or code block.
*   **Line 175**: `` means an empty line for visual spacing.
*   **Line 176**: `  const heroTitle = settings.siteName?.trim() || t('home', 'heroTitle');` means declaring a local variable to store data.
*   **Line 177**: `  const heroTagline = resolveHeroTagline(settings, t);` means declaring a local variable to store data.
*   **Line 178**: `  const appStoreHref = settings.appStoreUrl?.trim() || 'https://apps.apple.com';` means declaring a local variable to store data.
*   **Line 179**: `  const playStoreHref = settings.playStoreUrl?.trim() || 'https://play.google.com';` means declaring a local variable to store data.
*   **Line 180**: `  const showMap = settings.showMap !== false;` means declaring a local variable to store data.
*   **Line 181**: `` means an empty line for visual spacing.
*   **Line 182**: `  const placesList = Array.isArray(places) ? places : [];` means declaring a local variable to store data.
*   **Line 183**: `  const directoryPlaces = useMemo(` means declaring a local variable to store data.
*   **Line 184**: `    () => filterGeneralDirectoryPlaces(placesList, categories),` means executing standard component logic or rendering a nested HTML element.
*   **Line 185**: `    [placesList, categories]` means executing standard component logic or rendering a nested HTML element.
*   **Line 186**: `  );` means ending the HTML/JSX output block.
*   **Line 187**: `` means an empty line for visual spacing.
*   **Line 188**: `  const placeNameById = useMemo(() => {` means declaring a local variable to store data.
*   **Line 189**: `    const m = new Map();` means declaring a local variable to store data.
*   **Line 190**: `    for (const p of placesList) {` means executing standard component logic or rendering a nested HTML element.
*   **Line 191**: `      if (p?.id == null) continue;` means checking a specific logic condition before proceeding.
*   **Line 192**: `      const nm = p?.name != null ? String(p.name).trim() : '';` means declaring a local variable to store data.
*   **Line 193**: `      m.set(String(p.id), nm);` means executing standard component logic or rendering a nested HTML element.
*   **Line 194**: `    }` means closing the current function or code block.
*   **Line 195**: `    return m;` means returning a computed value from the function.
*   **Line 196**: `  }, [placesList]);` means closing the current function or code block.
*   **Line 197**: `` means an empty line for visual spacing.
*   **Line 198**: `  const bentoAvatarLinkLabel = useCallback(` means declaring a local variable to store data.
*   **Line 199**: `    (slot) => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 200**: `      if (slot.placeId) {` means checking a specific logic condition before proceeding.
*   **Line 201**: `        const name = placeNameById.get(String(slot.placeId)) || '';` means declaring a local variable to store data.
*   **Line 202**: `        if (name) return t('home', 'bentoAvatarPlaceLink').replace(/\{name\}/g, name);` means checking a specific logic condition before proceeding.
*   **Line 203**: `        return t('home', 'bentoAvatarPlaceLinkNoName');` means returning a computed value from the function.
*   **Line 204**: `      }` means closing the current function or code block.
*   **Line 205**: `      return t('home', 'bentoAvatarCommunityLink');` means returning a computed value from the function.
*   **Line 206**: `    },` means closing the current function or code block.
*   **Line 207**: `    [placeNameById, t]` means executing standard component logic or rendering a nested HTML element.
*   **Line 208**: `  );` means ending the HTML/JSX output block.
*   **Line 209**: `` means an empty line for visual spacing.
*   **Line 210**: `  const topPicks = useMemo(` means declaring a local variable to store data.
*   **Line 211**: `    () =>` means executing standard component logic or rendering a nested HTML element.
*   **Line 212**: `      directoryPlaces` means executing standard component logic or rendering a nested HTML element.
*   **Line 213**: `        .slice()` means executing standard component logic or rendering a nested HTML element.
*   **Line 214**: `        .sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0))` means executing standard component logic or rendering a nested HTML element.
*   **Line 215**: `        .slice(0, 6),` means executing standard component logic or rendering a nested HTML element.
*   **Line 216**: `    [directoryPlaces]` means executing standard component logic or rendering a nested HTML element.
*   **Line 217**: `  );` means ending the HTML/JSX output block.
*   **Line 218**: `` means an empty line for visual spacing.
*   **Line 219**: `  if (loading) {` means checking a specific logic condition before proceeding.
*   **Line 220**: `    return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 221**: `      <div className="vd vd-home">` means opening a generic layout container (div).
*   **Line 222**: `        <section className="vd-hero">` means opening a major semantic page section.
*   **Line 223**: `          <h1 className="vd-hero-title">{heroTitle}</h1>` means displaying a formatted heading title.
*   **Line 224**: `        </section>` means closing the page section.
*   **Line 225**: `        <div className="vd-loading">` means opening a generic layout container (div).
*   **Line 226**: `          <div className="vd-loading-spinner" aria-hidden="true" />` means opening a generic layout container (div).
*   **Line 227**: `          <span>{t('home', 'loading')}</span>` means opening an inline text wrapper (span).
*   **Line 228**: `        </div>` means closing the layout container.
*   **Line 229**: `      </div>` means closing the layout container.
*   **Line 230**: `    );` means ending the HTML/JSX output block.
*   **Line 231**: `  }` means closing the current function or code block.
*   **Line 232**: `` means an empty line for visual spacing.
*   **Line 233**: `  if (error) {` means checking a specific logic condition before proceeding.
*   **Line 234**: `    return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 235**: `      <div className="vd vd-home">` means opening a generic layout container (div).
*   **Line 236**: `        <section className="vd-hero">` means opening a major semantic page section.
*   **Line 237**: `          <h1 className="vd-hero-title">{heroTitle}</h1>` means displaying a formatted heading title.
*   **Line 238**: `        </section>` means closing the page section.
*   **Line 239**: `        <div className="vd-error vd-error-panel" role="alert">` means opening a generic layout container (div).
*   **Line 240**: `          <h2 className="vd-error-panel-title">{t('home', 'loadErrorTitle')}</h2>` means displaying a formatted heading title.
*   **Line 241**: `          <p className="vd-error-panel-hint">{t('home', 'loadErrorHint')}</p>` means opening a text paragraph element.
*   **Line 242**: `          <p className="vd-error-panel-detail" style={{ textAlign: 'center' }}>` means opening a text paragraph element.
*   **Line 243**: `            {error}` means executing embedded JavaScript logic within the HTML.
*   **Line 244**: `          </p>` means closing the text paragraph.
*   **Line 245**: `          <div className="vd-error-actions">` means opening a generic layout container (div).
*   **Line 246**: `            <button` means rendering a clickable button element.
*   **Line 247**: `              type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 248**: `              className="vd-btn vd-btn--primary"` means applying specific CSS styling classes to the element.
*   **Line 249**: `              onClick={() => setLoadNonce((n) => n + 1)}` means attaching a click-event listener to handle user interaction.
*   **Line 250**: `            >` means executing standard component logic or rendering a nested HTML element.
*   **Line 251**: `              {t('home', 'loadErrorRetry')}` means executing embedded JavaScript logic within the HTML.
*   **Line 252**: `            </button>` means closing the button element.
*   **Line 253**: `            <Link to={PLACES_DISCOVER_PATH} className="vd-btn vd-btn--outline">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 254**: `              {t('home', 'loadErrorBrowse')}` means executing embedded JavaScript logic within the HTML.
*   **Line 255**: `            </Link>` means closing the navigation link.
*   **Line 256**: `          </div>` means closing the layout container.
*   **Line 257**: `        </div>` means closing the layout container.
*   **Line 258**: `      </div>` means closing the layout container.
*   **Line 259**: `    );` means ending the HTML/JSX output block.
*   **Line 260**: `  }` means closing the current function or code block.
*   **Line 261**: `` means an empty line for visual spacing.
*   **Line 262**: `  const placeCountStr = formatDirectoryCount(directoryPlaces.length, lang);` means declaring a local variable to store data.
*   **Line 263**: `  const categoryCountStr = formatDirectoryCount(categoryCount, lang);` means declaring a local variable to store data.
*   **Line 264**: `  const bentoV = resolveHomeBentoVisuals(settings);` means declaring a local variable to store data.
*   **Line 265**: `  const bentoAvatarSlots = resolveBentoAvatarSlots(settings, placesList, (p) =>` means declaring a local variable to store data.
*   **Line 266**: `    getPlaceImageUrl(p?.image || (Array.isArray(p?.images) && p.images[0]))` means executing standard component logic or rendering a nested HTML element.
*   **Line 267**: `  );` means ending the HTML/JSX output block.
*   **Line 268**: `  const showBentoAvatarStack = bentoAvatarSlots.some((s) => s.href || s.placeId);` means declaring a local variable to store data.
*   **Line 269**: `` means an empty line for visual spacing.
*   **Line 270**: `  return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 271**: `    <div className="vd vd-home">` means opening a generic layout container (div).
*   **Line 272**: `      <HomeBento` means executing standard component logic or rendering a nested HTML element.
*   **Line 273**: `        t={t}` means executing standard component logic or rendering a nested HTML element.
*   **Line 274**: `        heroTitle={heroTitle}` means executing standard component logic or rendering a nested HTML element.
*   **Line 275**: `        heroTagline={heroTagline}` means executing standard component logic or rendering a nested HTML element.
*   **Line 276**: `        bentoV={bentoV}` means executing standard component logic or rendering a nested HTML element.
*   **Line 277**: `        showBentoAvatarStack={showBentoAvatarStack}` means executing standard component logic or rendering a nested HTML element.
*   **Line 278**: `        bentoAvatarSlots={bentoAvatarSlots}` means executing standard component logic or rendering a nested HTML element.
*   **Line 279**: `        bentoAvatarLinkLabel={bentoAvatarLinkLabel}` means executing standard component logic or rendering a nested HTML element.
*   **Line 280**: `        placeCountStr={placeCountStr}` means executing standard component logic or rendering a nested HTML element.
*   **Line 281**: `        categoryCountStr={categoryCountStr}` means executing standard component logic or rendering a nested HTML element.
*   **Line 282**: `        appStoreHref={appStoreHref}` means executing standard component logic or rendering a nested HTML element.
*   **Line 283**: `        playStoreHref={playStoreHref}` means executing standard component logic or rendering a nested HTML element.
*   **Line 284**: `      />` means executing standard component logic or rendering a nested HTML element.
*   **Line 285**: `` means an empty line for visual spacing.
*   **Line 286**: `      {/\* ` means executing embedded JavaScript logic within the HTML.
*   **Line 287**: `      <BrowseThemesSection` means executing standard component logic or rendering a nested HTML element.
*   **Line 288**: `        t={t}` means executing standard component logic or rendering a nested HTML element.
*   **Line 289**: `        lang={lang}` means executing standard component logic or rendering a nested HTML element.
*   **Line 290**: `        places={directoryPlaces}` means executing standard component logic or rendering a nested HTML element.
*   **Line 291**: `        categories={categories}` means executing standard component logic or rendering a nested HTML element.
*   **Line 292**: `      />` means executing standard component logic or rendering a nested HTML element.
*   **Line 293**: `      \*/}` means executing standard component logic or rendering a nested HTML element.
*   **Line 294**: `` means an empty line for visual spacing.
*   **Line 295**: `` means an empty line for visual spacing.
*   **Line 296**: `      <TopPicksSection ` means executing standard component logic or rendering a nested HTML element.
*   **Line 297**: `        places={topPicks} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 298**: `        t={t} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 299**: `        moreTo={PLACES_DISCOVER_PATH} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 300**: `      />` means executing standard component logic or rendering a nested HTML element.
*   **Line 301**: `` means an empty line for visual spacing.
*   **Line 302**: `      <EventsAndToursSection ` means executing standard component logic or rendering a nested HTML element.
*   **Line 303**: `        events={homeEvents} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 304**: `        tours={homeTours} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 305**: `        t={t} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 306**: `      />` means executing standard component logic or rendering a nested HTML element.
*   **Line 307**: `` means an empty line for visual spacing.
*   **Line 308**: `      <CommunitySection ` means executing standard component logic or rendering a nested HTML element.
*   **Line 309**: `        posts={communityPosts} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 310**: `        t={t} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 311**: `      />` means executing standard component logic or rendering a nested HTML element.
*   **Line 312**: `` means an empty line for visual spacing.
*   **Line 313**: `      <PracticalSection` means executing standard component logic or rendering a nested HTML element.
*   **Line 314**: `        t={t}` means executing standard component logic or rendering a nested HTML element.
*   **Line 315**: `        places={placesList}` means executing standard component logic or rendering a nested HTML element.
*   **Line 316**: `        showMap={showMap}` means executing standard component logic or rendering a nested HTML element.
*   **Line 317**: `        userTips={user?.showTips !== false}` means executing standard component logic or rendering a nested HTML element.
*   **Line 318**: `      />` means executing standard component logic or rendering a nested HTML element.
*   **Line 319**: `` means an empty line for visual spacing.
*   **Line 320**: `      <PlanVisitSection` means executing standard component logic or rendering a nested HTML element.
*   **Line 321**: `        t={t}` means executing standard component logic or rendering a nested HTML element.
*   **Line 322**: `        lang={lang}` means executing standard component logic or rendering a nested HTML element.
*   **Line 323**: `        showMap={showMap}` means executing standard component logic or rendering a nested HTML element.
*   **Line 324**: `      />` means executing standard component logic or rendering a nested HTML element.
*   **Line 325**: `` means an empty line for visual spacing.
*   **Line 326**: `      <HomeUtilityBar ` means executing standard component logic or rendering a nested HTML element.
*   **Line 327**: `        t={t} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 328**: `        showMap={showMap} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 329**: `      />` means executing standard component logic or rendering a nested HTML element.
*   **Line 330**: `` means an empty line for visual spacing.
*   **Line 331**: `      <HomeFooter ` means executing standard component logic or rendering a nested HTML element.
*   **Line 332**: `        settings={settings} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 333**: `        t={t} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 334**: `        showMap={showMap} ` means executing standard component logic or rendering a nested HTML element.
*   **Line 335**: `      />` means executing standard component logic or rendering a nested HTML element.
*   **Line 336**: `    </div>` means closing the layout container.
*   **Line 337**: `  );` means ending the HTML/JSX output block.
*   **Line 338**: `}` means closing the current function or code block.
*   **Line 339**: `` means an empty line for visual spacing.

## `client/src/components/home/HomeBento.jsx`
*   **Line 38**: `    <section id="download-app" className="vd-home-bento">` means opening a major semantic page section.
*   **Line 39**: `      <div className="vd-container vd-home-bento-inner">` means opening a generic layout container (div).
*   **Line 40**: `        <div className="vd-home-bento-grid">` means opening a generic layout container (div).
*   **Line 41**: `          <div className="vd-bento-hero-why-bundle">` means opening a generic layout container (div).
*   **Line 42**: `            <div className="vd-bento-card vd-bento-hero-main">` means opening a generic layout container (div).
*   **Line 43**: `              {isDefaultCityHeroPath(bentoV.hero) ? (` means executing embedded JavaScript logic within the HTML.
*   **Line 44**: `                <picture>` means opening a text paragraph element.
*   **Line 45**: `                  <source media="(max-width: 767px)" srcSet="/oscar-niemeyer-arch.jpg" />` means executing standard component logic or rendering a nested HTML element.
*   **Line 46**: `                  <source media="(min-width: 768px)" srcSet="/oscar-niemeyer-arch-wide.jpg" />` means executing standard component logic or rendering a nested HTML element.
*   **Line 47**: `                  <source type="image/webp" srcSet={cityHeroWebpSrcSet()} sizes={CITY_HERO_SIZES} />` means executing standard component logic or rendering a nested HTML element.
*   **Line 48**: `                  <img` means rendering an image graphic onto the page.
*   **Line 49**: `                    className="vd-bento-hero-main-photo"` means applying specific CSS styling classes to the element.
*   **Line 50**: `                    alt=""` means executing standard component logic or rendering a nested HTML element.
*   **Line 51**: `                    draggable={false}` means executing standard component logic or rendering a nested HTML element.
*   **Line 52**: `                    {...getBentoHeroImgProps(bentoV.hero)}` means executing embedded JavaScript logic within the HTML.
*   **Line 53**: `                  />` means executing standard component logic or rendering a nested HTML element.
*   **Line 54**: `                </picture>` means executing standard component logic or rendering a nested HTML element.
*   **Line 55**: `              ) : (` means executing standard component logic or rendering a nested HTML element.
*   **Line 56**: `                <img` means rendering an image graphic onto the page.
*   **Line 57**: `                  className="vd-bento-hero-main-photo"` means applying specific CSS styling classes to the element.
*   **Line 58**: `                  alt=""` means executing standard component logic or rendering a nested HTML element.
*   **Line 59**: `                  draggable={false}` means executing standard component logic or rendering a nested HTML element.
*   **Line 60**: `                  {...getBentoHeroImgProps(bentoV.hero)}` means executing embedded JavaScript logic within the HTML.
*   **Line 61**: `                />` means executing standard component logic or rendering a nested HTML element.
*   **Line 62**: `              )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 63**: `              <div className="vd-bento-hero-main-scrim" aria-hidden="true" />` means opening a generic layout container (div).
*   **Line 64**: `              <div className="vd-bento-hero-main-content">` means opening a generic layout container (div).
*   **Line 65**: `                <div className="vd-bento-hero-copy">` means opening a generic layout container (div).
*   **Line 66**: `                  <h1 className="vd-bento-hero-title">{heroTitle}</h1>` means displaying a formatted heading title.
*   **Line 67**: `                  <p className="vd-bento-hero-tagline">{heroTagline}</p>` means opening a text paragraph element.
*   **Line 68**: `                </div>` means closing the layout container.
*   **Line 69**: `                <div className="vd-bento-hero-meta">` means opening a generic layout container (div).
*   **Line 70**: `                  <div className="vd-bento-hero-ctas">` means opening a generic layout container (div).
*   **Line 71**: `                    <Link to="/plan" className="vd-bento-btn vd-bento-btn--primary">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 72**: `                      {t('home', 'webTripPlannerCta')}` means executing embedded JavaScript logic within the HTML.
*   **Line 73**: `                      <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />` means displaying a custom vector graphic icon.
*   **Line 74**: `                    </Link>` means closing the navigation link.
*   **Line 75**: `                  </div>` means closing the layout container.
*   **Line 76**: `                  {showBentoAvatarStack && (` means executing embedded JavaScript logic within the HTML.
*   **Line 77**: `                    <div` means opening a generic layout container (div).
*   **Line 78**: `                      className="vd-bento-avatar-stack"` means applying specific CSS styling classes to the element.
*   **Line 79**: `                      role="group"` means executing standard component logic or rendering a nested HTML element.
*   **Line 80**: `                      aria-label={t('home', 'bentoAvatarStackAria')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 81**: `                    >` means executing standard component logic or rendering a nested HTML element.
*   **Line 82**: `                      {bentoAvatarSlots.map((slot, i) => {` means executing embedded JavaScript logic within the HTML.
*   **Line 83**: `                        const to = slot.placeId ? '/place/${slot.placeId}' : COMMUNITY_PATH;` means declaring a local variable to store data.
*   **Line 84**: `                        const key = slot.placeId ? 'bento-av-${slot.placeId}' : 'bento-av-${i}';` means declaring a local variable to store data.
*   **Line 85**: `                        return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 86**: `                          <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 87**: `                            key={key}` means executing standard component logic or rendering a nested HTML element.
*   **Line 88**: `                            to={to}` means executing standard component logic or rendering a nested HTML element.
*   **Line 89**: `                            className="vd-bento-avatar"` means applying specific CSS styling classes to the element.
*   **Line 90**: `                            aria-label={bentoAvatarLinkLabel(slot)}` means executing standard component logic or rendering a nested HTML element.
*   **Line 91**: `                            style={` means executing standard component logic or rendering a nested HTML element.
*   **Line 92**: `                              slot.href` means executing standard component logic or rendering a nested HTML element.
*   **Line 93**: `                                ? { backgroundImage: bentoCssUrl(supabaseOptimizeForThumbnail(slot.href, 120)) }` means executing standard component logic or rendering a nested HTML element.
*   **Line 94**: `                                : undefined` means executing standard component logic or rendering a nested HTML element.
*   **Line 95**: `                            }` means closing the current function or code block.
*   **Line 96**: `                          >` means executing standard component logic or rendering a nested HTML element.
*   **Line 97**: `                            {!slot.href && <Icon name="travel_explore" size={22} aria-hidden />}` means executing embedded JavaScript logic within the HTML.
*   **Line 98**: `                          </Link>` means closing the navigation link.
*   **Line 99**: `                        );` means ending the HTML/JSX output block.
*   **Line 100**: `                      })}` means closing the current function or code block.
*   **Line 101**: `                    </div>` means closing the layout container.
*   **Line 102**: `                  )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 103**: `                </div>` means closing the layout container.
*   **Line 104**: `              </div>` means closing the layout container.
*   **Line 105**: `            </div>` means closing the layout container.
*   **Line 106**: `` means an empty line for visual spacing.
*   **Line 107**: `            <div className="vd-bento-card vd-bento-why-intro">` means opening a generic layout container (div).
*   **Line 108**: `              <div className="vd-bento-why-intro-top">` means opening a generic layout container (div).
*   **Line 109**: `                <h2 className="vd-bento-why-intro-title">{t('home', 'whyVisitTitle')}</h2>` means displaying a formatted heading title.
*   **Line 110**: `              </div>` means closing the layout container.
*   **Line 111**: `              <p className="vd-bento-why-intro-sub">{t('home', 'whyVisitSub')}</p>` means opening a text paragraph element.
*   **Line 112**: `              <div className="vd-bento-why-intro-footer">` means opening a generic layout container (div).
*   **Line 113**: `                <Link to={PLACES_DISCOVER_PATH} className="vd-bento-why-intro-link">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 114**: `                  <span>{t('home', 'seeAllWays')}</span>` means opening an inline text wrapper (span).
*   **Line 115**: `                  <Icon name="arrow_forward" size={20} aria-hidden="true" />` means displaying a custom vector graphic icon.
*   **Line 116**: `                </Link>` means closing the navigation link.
*   **Line 117**: `              </div>` means closing the layout container.
*   **Line 118**: `            </div>` means closing the layout container.
*   **Line 119**: `          </div>` means closing the layout container.
*   **Line 120**: `` means an empty line for visual spacing.
*   **Line 121**: `          <div className="vd-bento-card vd-bento-hero-side vd-bento-web-hub">` means opening a generic layout container (div).
*   **Line 122**: `            <div className="vd-bento-web-hub-inner">` means opening a generic layout container (div).
*   **Line 123**: `              <p className="vd-bento-web-hub-kicker">{t('home', 'useWebCta')}</p>` means opening a text paragraph element.
*   **Line 124**: `              <div className="vd-bento-web-hub-header">` means opening a generic layout container (div).
*   **Line 125**: `                <div className="vd-bento-web-hub-titles">` means opening a generic layout container (div).
*   **Line 126**: `                  <p className="vd-bento-web-hub-name">{t('home', 'bentoWebHubTitle')}</p>` means opening a text paragraph element.
*   **Line 127**: `                  <p className="vd-bento-web-hub-sub">{t('home', 'bentoWebHubSub')}</p>` means opening a text paragraph element.
*   **Line 128**: `                </div>` means closing the layout container.
*   **Line 129**: `              </div>` means closing the layout container.
*   **Line 130**: `              <ul className="vd-bento-web-hub-facts">` means executing standard component logic or rendering a nested HTML element.
*   **Line 131**: `                <li>{renderTextWithBold(t('home', 'bentoWebHubFact1'))}</li>` means executing standard component logic or rendering a nested HTML element.
*   **Line 132**: `                <li>{renderTextWithBold(t('home', 'bentoWebHubFact2'))}</li>` means executing standard component logic or rendering a nested HTML element.
*   **Line 133**: `                <li>{renderTextWithBold(t('home', 'bentoWebHubFact3'))}</li>` means executing standard component logic or rendering a nested HTML element.
*   **Line 134**: `              </ul>` means executing standard component logic or rendering a nested HTML element.
*   **Line 135**: `              <p className="vd-bento-web-hub-footnote">{t('home', 'bentoWebHubFootnote')}</p>` means opening a text paragraph element.
*   **Line 136**: `              <Link to="/plan" className="vd-bento-web-hub-cta">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 137**: `                <span className="vd-bento-web-hub-cta-label">{t('home', 'bentoWebHubCta')}</span>` means opening an inline text wrapper (span).
*   **Line 138**: `                <Icon name="arrow_forward" size={20} aria-hidden="true" />` means displaying a custom vector graphic icon.
*   **Line 139**: `              </Link>` means closing the navigation link.
*   **Line 140**: `            </div>` means closing the layout container.
*   **Line 141**: `          </div>` means closing the layout container.
*   **Line 142**: `` means an empty line for visual spacing.
*   **Line 143**: `          <div` means opening a generic layout container (div).
*   **Line 144**: `            id="why"` means executing standard component logic or rendering a nested HTML element.
*   **Line 145**: `            className="vd-bento-card vd-bento-mosaic"` means applying specific CSS styling classes to the element.
*   **Line 146**: `            style={{ '--bento-mosaic-img': bentoCssUrl(bentoV.mosaic) }}` means executing standard component logic or rendering a nested HTML element.
*   **Line 147**: `          >` means executing standard component logic or rendering a nested HTML element.
*   **Line 148**: `            <div className="vd-bento-mosaic-bg" aria-hidden="true" />` means opening a generic layout container (div).
*   **Line 149**: `            <div className="vd-bento-mosaic-top">` means opening a generic layout container (div).
*   **Line 150**: `              <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 151**: `                to={COMMUNITY_PATH}` means executing standard component logic or rendering a nested HTML element.
*   **Line 152**: `                className="vd-bento-mosaic-snap vd-bento-mosaic-snap--phone"` means applying specific CSS styling classes to the element.
*   **Line 153**: `                aria-label={'${t('home', 'bentoMosaicSnapAria')}: ${placeCountStr} ${t('home', 'bentoMosaicSnapPlacesUnit')}, ${categoryCountStr} ${t('home', 'bentoMosaicSnapCategoriesUnit')}'}` means executing standard component logic or rendering a nested HTML element.
*   **Line 154**: `              >` means executing standard component logic or rendering a nested HTML element.
*   **Line 155**: `                <span className="vd-bento-mosaic-snap-glow" aria-hidden="true" />` means opening an inline text wrapper (span).
*   **Line 156**: `                <span className="vd-bento-mosaic-snap-body">` means opening an inline text wrapper (span).
*   **Line 157**: `                  <span className="vd-bento-mosaic-snap-line">` means opening an inline text wrapper (span).
*   **Line 158**: `                    <strong className="vd-bento-mosaic-snap-n">{placeCountStr}</strong>` means executing standard component logic or rendering a nested HTML element.
*   **Line 159**: `                    <span className="vd-bento-mosaic-snap-u">{t('home', 'bentoMosaicSnapPlacesUnit')}</span>` means opening an inline text wrapper (span).
*   **Line 160**: `                    <span className="vd-bento-mosaic-snap-sep" aria-hidden="true">` means opening an inline text wrapper (span).
*   **Line 161**: `                      ·` means executing standard component logic or rendering a nested HTML element.
*   **Line 162**: `                    </span>` means closing the inline text wrapper.
*   **Line 163**: `                    <strong className="vd-bento-mosaic-snap-n">{categoryCountStr}</strong>` means executing standard component logic or rendering a nested HTML element.
*   **Line 164**: `                    <span className="vd-bento-mosaic-snap-u">{t('home', 'bentoMosaicSnapCategoriesUnit')}</span>` means opening an inline text wrapper (span).
*   **Line 165**: `                  </span>` means closing the inline text wrapper.
*   **Line 166**: `                  <span className="vd-bento-mosaic-snap-sub">{t('home', 'bentoMosaicSnapSub')}</span>` means opening an inline text wrapper (span).
*   **Line 167**: `                </span>` means closing the inline text wrapper.
*   **Line 168**: `                <span className="vd-bento-mosaic-snap-arrow" aria-hidden="true">` means opening an inline text wrapper (span).
*   **Line 169**: `                  <Icon name="arrow_forward" size={18} />` means displaying a custom vector graphic icon.
*   **Line 170**: `                </span>` means closing the inline text wrapper.
*   **Line 171**: `              </Link>` means closing the navigation link.
*   **Line 172**: `              <div className="vd-bento-stat-grid vd-bento-mosaic-stats-desktop">` means opening a generic layout container (div).
*   **Line 173**: `                <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 174**: `                  to={COMMUNITY_PATH}` means executing standard component logic or rendering a nested HTML element.
*   **Line 175**: `                  className="vd-bento-stat vd-bento-stat--dark vd-bento-stat--link"` means applying specific CSS styling classes to the element.
*   **Line 176**: `                  aria-label={'${placeCountStr} ${t('home', 'bentoStatPlaces')}'}` means executing standard component logic or rendering a nested HTML element.
*   **Line 177**: `                >` means executing standard component logic or rendering a nested HTML element.
*   **Line 178**: `                  <strong className="vd-bento-stat-num">{placeCountStr}</strong>` means executing standard component logic or rendering a nested HTML element.
*   **Line 179**: `                  <span className="vd-bento-stat-label">{t('home', 'bentoStatPlaces')}</span>` means opening an inline text wrapper (span).
*   **Line 180**: `                </Link>` means closing the navigation link.
*   **Line 181**: `                <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 182**: `                  to={PLACES_DISCOVER_PATH}` means executing standard component logic or rendering a nested HTML element.
*   **Line 183**: `                  className="vd-bento-stat vd-bento-stat--light vd-bento-stat--link"` means applying specific CSS styling classes to the element.
*   **Line 184**: `                  aria-label={'${categoryCountStr} ${t('home', 'bentoStatCategories')}'}` means executing standard component logic or rendering a nested HTML element.
*   **Line 185**: `                >` means executing standard component logic or rendering a nested HTML element.
*   **Line 186**: `                  <strong className="vd-bento-stat-num">{categoryCountStr}</strong>` means executing standard component logic or rendering a nested HTML element.
*   **Line 187**: `                  <span className="vd-bento-stat-label">{t('home', 'bentoStatCategories')}</span>` means opening an inline text wrapper (span).
*   **Line 188**: `                  <span className="vd-bento-stat-cta" aria-hidden="true">` means opening an inline text wrapper (span).
*   **Line 189**: `                    <Icon name="arrow_forward" size={16} />` means displaying a custom vector graphic icon.
*   **Line 190**: `                  </span>` means closing the inline text wrapper.
*   **Line 191**: `                </Link>` means closing the navigation link.
*   **Line 192**: `              </div>` means closing the layout container.
*   **Line 193**: `            </div>` means closing the layout container.
*   **Line 194**: `` means an empty line for visual spacing.
*   **Line 195**: `            <div className="vd-bento-mosaic-panel">` means opening a generic layout container (div).
*   **Line 196**: `              <p className="vd-bento-panel-kicker vd-bento-panel-kicker--desktop">{t('home', 'bentoMosaicKicker')}</p>` means opening a text paragraph element.
*   **Line 197**: `              <div className="vd-bento-mosaic-panel-grid">` means opening a generic layout container (div).
*   **Line 198**: `                <div className="vd-bento-mosaic-panel-copy">` means opening a generic layout container (div).
*   **Line 199**: `                  <p className="vd-bento-panel-note vd-bento-panel-note--desktop">{t('home', 'bentoSiteGuideAppNote')}</p>` means opening a text paragraph element.
*   **Line 200**: `                  <p className="vd-bento-panel-lead-short">{t('home', 'bentoSiteGuideLeadShort')}</p>` means opening a text paragraph element.
*   **Line 201**: `                </div>` means closing the layout container.
*   **Line 202**: `                <div className="vd-bento-mosaic-panel-apps">` means opening a generic layout container (div).
*   **Line 203**: `                  <p className="vd-bento-panel-badges-label">{t('home', 'bentoSiteGuideAppStoreLabel')}</p>` means opening a text paragraph element.
*   **Line 204**: `                  <div className="vd-bento-panel-badges">` means opening a generic layout container (div).
*   **Line 205**: `                    <a` means executing standard component logic or rendering a nested HTML element.
*   **Line 206**: `                      href={appStoreHref}` means executing standard component logic or rendering a nested HTML element.
*   **Line 207**: `                      target="_blank"` means executing standard component logic or rendering a nested HTML element.
*   **Line 208**: `                      rel="noopener noreferrer"` means executing standard component logic or rendering a nested HTML element.
*   **Line 209**: `                      className="vd-download-app-badge vd-download-app-badge--apple"` means applying specific CSS styling classes to the element.
*   **Line 210**: `                      aria-label={t('home', 'getOnAppStore')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 211**: `                    >` means executing standard component logic or rendering a nested HTML element.
*   **Line 212**: `                      <Icon name="phone_iphone" size={20} />` means displaying a custom vector graphic icon.
*   **Line 213**: `                      <span>{t('home', 'getOnAppStore')}</span>` means opening an inline text wrapper (span).
*   **Line 214**: `                    </a>` means executing standard component logic or rendering a nested HTML element.
*   **Line 215**: `                    <a` means executing standard component logic or rendering a nested HTML element.
*   **Line 216**: `                      href={playStoreHref}` means executing standard component logic or rendering a nested HTML element.
*   **Line 217**: `                      target="_blank"` means executing standard component logic or rendering a nested HTML element.
*   **Line 218**: `                      rel="noopener noreferrer"` means executing standard component logic or rendering a nested HTML element.
*   **Line 219**: `                      className="vd-download-app-badge vd-download-app-badge--google"` means applying specific CSS styling classes to the element.
*   **Line 220**: `                      aria-label={t('home', 'getOnGooglePlay')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 221**: `                    >` means executing standard component logic or rendering a nested HTML element.
*   **Line 222**: `                      <Icon name="android" size={22} />` means displaying a custom vector graphic icon.
*   **Line 223**: `                      <span>{t('home', 'getOnGooglePlay')}</span>` means opening an inline text wrapper (span).
*   **Line 224**: `                    </a>` means executing standard component logic or rendering a nested HTML element.
*   **Line 225**: `                  </div>` means closing the layout container.
*   **Line 226**: `                </div>` means closing the layout container.
*   **Line 227**: `              </div>` means closing the layout container.
*   **Line 228**: `            </div>` means closing the layout container.
*   **Line 229**: `` means an empty line for visual spacing.
*   **Line 230**: `            <div className="vd-bento-mosaic-footer">` means opening a generic layout container (div).
*   **Line 231**: `              <Link to={PLACES_DISCOVER_PATH} className="vd-bento-mosaic-cta">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 232**: `                {t('home', 'seeAllWays')}` means executing embedded JavaScript logic within the HTML.
*   **Line 233**: `                <Icon name="arrow_forward" className="vd-btn-arrow" size={16} />` means displaying a custom vector graphic icon.
*   **Line 234**: `              </Link>` means closing the navigation link.
*   **Line 235**: `            </div>` means closing the layout container.
*   **Line 236**: `          </div>` means closing the layout container.
*   **Line 237**: `        </div>` means closing the layout container.
*   **Line 238**: `      </div>` means closing the layout container.
*   **Line 239**: `    </section>` means closing the page section.
*   **Line 240**: `  );` means ending the HTML/JSX output block.
*   **Line 241**: `}` means closing the current function or code block.
*   **Line 242**: `` means an empty line for visual spacing.

## `client/src/components/home/TopPicksSection.jsx`
*   **Line 1**: `import { useState, useEffect, useCallback, useRef } from 'react';` means importing a necessary component, module, or hook.
*   **Line 2**: `import { Link, useNavigate } from 'react-router-dom';` means importing a necessary component, module, or hook.
*   **Line 3**: `import { getPlaceImageUrl } from '../../api/client';` means importing a necessary component, module, or hook.
*   **Line 4**: `import DeliveryImg from '../DeliveryImg';` means importing a necessary component, module, or hook.
*   **Line 5**: `import { useAuth } from '../../context/AuthContext';` means importing a necessary component, module, or hook.
*   **Line 6**: `import { useToast } from '../../context/ToastContext';` means importing a necessary component, module, or hook.
*   **Line 7**: `import { useFavourites } from '../../context/FavouritesContext';` means importing a necessary component, module, or hook.
*   **Line 8**: `import Icon from '../Icon';` means importing a necessary component, module, or hook.
*   **Line 9**: `` means an empty line for visual spacing.
*   **Line 10**: `export default function TopPicksSection({ places, t, moreTo }) {` means defining and exporting the main React component.
*   **Line 11**: `  const navigate = useNavigate();` means declaring a local variable to store data.
*   **Line 12**: `  const { user } = useAuth();` means declaring a local variable to store data.
*   **Line 13**: `  const { showToast } = useToast();` means declaring a local variable to store data.
*   **Line 14**: `  const { isFavourite, toggleFavourite: commitFavouriteToggle } = useFavourites();` means declaring a local variable to store data.
*   **Line 15**: `  const safePlaces = Array.isArray(places) ? places : [];` means declaring a local variable to store data.
*   **Line 16**: `  const [index, setIndex] = useState(0);` means initializing a React state variable to track data changes.
*   **Line 17**: `  const carouselRef = useRef(null);` means declaring a local variable to store data.
*   **Line 18**: `  const [isVisible, setIsVisible] = useState(false);` means initializing a React state variable to track data changes.
*   **Line 19**: `` means an empty line for visual spacing.
*   **Line 20**: `  // Watch whether carousel has entered the viewport` means a developer comment explaining the code.
*   **Line 21**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 22**: `    const el = carouselRef.current;` means declaring a local variable to store data.
*   **Line 23**: `    if (!el || typeof IntersectionObserver === 'undefined') {` means checking a specific logic condition before proceeding.
*   **Line 24**: `      setIsVisible(true);` means executing standard component logic or rendering a nested HTML element.
*   **Line 25**: `      return undefined;` means returning a computed value from the function.
*   **Line 26**: `    }` means closing the current function or code block.
*   **Line 27**: `    const obs = new IntersectionObserver(` means declaring a local variable to store data.
*   **Line 28**: `      ([entry]) => setIsVisible(!!entry?.isIntersecting),` means executing standard component logic or rendering a nested HTML element.
*   **Line 29**: `      { threshold: 0.3 }` means executing embedded JavaScript logic within the HTML.
*   **Line 30**: `    );` means ending the HTML/JSX output block.
*   **Line 31**: `    obs.observe(el);` means executing standard component logic or rendering a nested HTML element.
*   **Line 32**: `    return () => obs.disconnect();` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 33**: `  }, []);` means closing the current function or code block.
*   **Line 34**: `` means an empty line for visual spacing.
*   **Line 35**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 36**: `    if (safePlaces.length <= 1 || !isVisible) return;` means checking a specific logic condition before proceeding.
*   **Line 37**: `    const id = setInterval(() => {` means declaring a local variable to store data.
*   **Line 38**: `      setIndex((i) => (i + 1) % safePlaces.length);` means executing standard component logic or rendering a nested HTML element.
*   **Line 39**: `    }, 10000);` means closing the current function or code block.
*   **Line 40**: `    return () => clearInterval(id);` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 41**: `  }, [safePlaces.length, isVisible]);` means closing the current function or code block.
*   **Line 42**: `` means an empty line for visual spacing.
*   **Line 43**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 44**: `    setIndex((i) => (safePlaces.length ? Math.min(i, safePlaces.length - 1) : 0));` means executing standard component logic or rendering a nested HTML element.
*   **Line 45**: `  }, [safePlaces.length]);` means closing the current function or code block.
*   **Line 46**: `` means an empty line for visual spacing.
*   **Line 47**: `  const handlePrev = useCallback((e) => {` means declaring a local variable to store data.
*   **Line 48**: `    e?.preventDefault();` means executing standard component logic or rendering a nested HTML element.
*   **Line 49**: `    setIndex((i) => (i - 1 + safePlaces.length) % safePlaces.length);` means executing standard component logic or rendering a nested HTML element.
*   **Line 50**: `  }, [safePlaces.length]);` means closing the current function or code block.
*   **Line 51**: `` means an empty line for visual spacing.
*   **Line 52**: `  const handleNext = useCallback((e) => {` means declaring a local variable to store data.
*   **Line 53**: `    e?.preventDefault();` means executing standard component logic or rendering a nested HTML element.
*   **Line 54**: `    setIndex((i) => (i + 1) % safePlaces.length);` means executing standard component logic or rendering a nested HTML element.
*   **Line 55**: `  }, [safePlaces.length]);` means closing the current function or code block.
*   **Line 56**: `` means an empty line for visual spacing.
*   **Line 57**: `  const onCarouselKeyDown = useCallback(` means declaring a local variable to store data.
*   **Line 58**: `    (e) => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 59**: `      if (safePlaces.length <= 1) return;` means checking a specific logic condition before proceeding.
*   **Line 60**: `      if (e.key === 'ArrowRight') {` means checking a specific logic condition before proceeding.
*   **Line 61**: `        e.preventDefault();` means executing standard component logic or rendering a nested HTML element.
*   **Line 62**: `        setIndex((i) => (i + 1) % safePlaces.length);` means executing standard component logic or rendering a nested HTML element.
*   **Line 63**: `      } else if (e.key === 'ArrowLeft') {` means closing the current function or code block.
*   **Line 64**: `        e.preventDefault();` means executing standard component logic or rendering a nested HTML element.
*   **Line 65**: `        setIndex((i) => (i - 1 + safePlaces.length) % safePlaces.length);` means executing standard component logic or rendering a nested HTML element.
*   **Line 66**: `      } else if (e.key === 'Home') {` means closing the current function or code block.
*   **Line 67**: `        e.preventDefault();` means executing standard component logic or rendering a nested HTML element.
*   **Line 68**: `        setIndex(0);` means executing standard component logic or rendering a nested HTML element.
*   **Line 69**: `      } else if (e.key === 'End') {` means closing the current function or code block.
*   **Line 70**: `        e.preventDefault();` means executing standard component logic or rendering a nested HTML element.
*   **Line 71**: `        setIndex(safePlaces.length - 1);` means executing standard component logic or rendering a nested HTML element.
*   **Line 72**: `      }` means closing the current function or code block.
*   **Line 73**: `    },` means closing the current function or code block.
*   **Line 74**: `    [safePlaces.length]` means executing standard component logic or rendering a nested HTML element.
*   **Line 75**: `  );` means ending the HTML/JSX output block.
*   **Line 76**: `` means an empty line for visual spacing.
*   **Line 77**: `  const toggleFavourite = useCallback(` means declaring a local variable to store data.
*   **Line 78**: `    async (e, placeId) => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 79**: `      e.preventDefault();` means executing standard component logic or rendering a nested HTML element.
*   **Line 80**: `      e.stopPropagation();` means executing standard component logic or rendering a nested HTML element.
*   **Line 81**: `      if (!user) {` means checking a specific logic condition before proceeding.
*   **Line 82**: `        navigate('/login', { state: { from: 'favourite' } });` means executing standard component logic or rendering a nested HTML element.
*   **Line 83**: `        return;` means executing standard component logic or rendering a nested HTML element.
*   **Line 84**: `      }` means closing the current function or code block.
*   **Line 85**: `      const id = placeId != null ? String(placeId) : '';` means declaring a local variable to store data.
*   **Line 86**: `      if (!id) return;` means checking a specific logic condition before proceeding.
*   **Line 87**: `      const r = await commitFavouriteToggle(id);` means declaring a local variable to store data.
*   **Line 88**: `      if (r.reason === 'auth') {` means checking a specific logic condition before proceeding.
*   **Line 89**: `        navigate('/login', { state: { from: 'favourite' } });` means executing standard component logic or rendering a nested HTML element.
*   **Line 90**: `        return;` means executing standard component logic or rendering a nested HTML element.
*   **Line 91**: `      }` means closing the current function or code block.
*   **Line 92**: `      if (!r.ok) {` means checking a specific logic condition before proceeding.
*   **Line 93**: `        if (r.reason === 'busy') return;` means checking a specific logic condition before proceeding.
*   **Line 94**: `        showToast(t('feedback', 'favouriteUpdateFailed'), 'error');` means executing standard component logic or rendering a nested HTML element.
*   **Line 95**: `        return;` means executing standard component logic or rendering a nested HTML element.
*   **Line 96**: `      }` means closing the current function or code block.
*   **Line 97**: `      showToast(t('feedback', r.added ? 'favouriteAdded' : 'favouriteRemoved'), 'success');` means executing standard component logic or rendering a nested HTML element.
*   **Line 98**: `    },` means closing the current function or code block.
*   **Line 99**: `    [user, commitFavouriteToggle, navigate, showToast, t]` means executing standard component logic or rendering a nested HTML element.
*   **Line 100**: `  );` means ending the HTML/JSX output block.
*   **Line 101**: `` means an empty line for visual spacing.
*   **Line 102**: `  if (safePlaces.length === 0) return null;` means checking a specific logic condition before proceeding.
*   **Line 103**: `` means an empty line for visual spacing.
*   **Line 104**: `  return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 105**: `    <section className="vd-section vd-top-picks">` means opening a major semantic page section.
*   **Line 106**: `      <div className="vd-container">` means opening a generic layout container (div).
*   **Line 107**: `        <header className="vd-top-picks-header">` means opening a header block for the section.
*   **Line 108**: `          <div className="vd-top-picks-header-row">` means opening a generic layout container (div).
*   **Line 109**: `            <div className="vd-top-picks-heading-text">` means opening a generic layout container (div).
*   **Line 110**: `              <h2 className="vd-top-picks-title">{t('home', 'topPicks')}</h2>` means displaying a formatted heading title.
*   **Line 111**: `              <p className="vd-top-picks-subtitle">{t('home', 'topPicksSub')}</p>` means opening a text paragraph element.
*   **Line 112**: `            </div>` means closing the layout container.
*   **Line 113**: `            {moreTo ? (` means executing embedded JavaScript logic within the HTML.
*   **Line 114**: `              <Link to={moreTo} className="vd-community-feed-more">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 115**: `                {t('discover', 'seeAllDiscover')}` means executing embedded JavaScript logic within the HTML.
*   **Line 116**: `                <Icon name="arrow_forward" size={18} />` means displaying a custom vector graphic icon.
*   **Line 117**: `              </Link>` means closing the navigation link.
*   **Line 118**: `            ) : null}` means executing standard component logic or rendering a nested HTML element.
*   **Line 119**: `          </div>` means closing the layout container.
*   **Line 120**: `        </header>` means closing the header block.
*   **Line 121**: `` means an empty line for visual spacing.
*   **Line 122**: `        <div` means opening a generic layout container (div).
*   **Line 123**: `          ref={carouselRef}` means executing standard component logic or rendering a nested HTML element.
*   **Line 124**: `          className="vd-top-picks-carousel"` means applying specific CSS styling classes to the element.
*   **Line 125**: `          tabIndex={0}` means executing standard component logic or rendering a nested HTML element.
*   **Line 126**: `          role="region"` means executing standard component logic or rendering a nested HTML element.
*   **Line 127**: `          aria-roledescription="carousel"` means executing standard component logic or rendering a nested HTML element.
*   **Line 128**: `          aria-label={t('home', 'topPicksCarouselLabel')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 129**: `          onKeyDown={onCarouselKeyDown}` means executing standard component logic or rendering a nested HTML element.
*   **Line 130**: `        >` means executing standard component logic or rendering a nested HTML element.
*   **Line 131**: `          <div` means opening a generic layout container (div).
*   **Line 132**: `            className="vd-top-picks-track"` means applying specific CSS styling classes to the element.
*   **Line 133**: `            style={{ ` means executing standard component logic or rendering a nested HTML element.
*   **Line 134**: `              transform: 'translateX(calc(-${index} \* (100% + 24px)))', ` means executing standard component logic or rendering a nested HTML element.
*   **Line 135**: `              gap: '24px',` means executing standard component logic or rendering a nested HTML element.
*   **Line 136**: `              direction: 'ltr' ` means executing standard component logic or rendering a nested HTML element.
*   **Line 137**: `            }}` means closing the current function or code block.
*   **Line 138**: `          >` means executing standard component logic or rendering a nested HTML element.
*   **Line 139**: `            {safePlaces.map((p, slideIndex) => {` means executing embedded JavaScript logic within the HTML.
*   **Line 140**: `              if (!p || p.id == null) return null;` means checking a specific logic condition before proceeding.
*   **Line 141**: `              const placeId = String(p.id);` means declaring a local variable to store data.
*   **Line 142**: `              const safeImg = getPlaceImageUrl(p.image || (p.images && p.images[0])) || null;` means declaring a local variable to store data.
*   **Line 143**: `              const name = p.name != null ? String(p.name) : '';` means declaring a local variable to store data.
*   **Line 144**: `              const desc = p.description != null ? String(p.description) : '';` means declaring a local variable to store data.
*   **Line 145**: `              const ratingNum = Number(p.rating);` means declaring a local variable to store data.
*   **Line 146**: `              const rating = Number.isFinite(ratingNum) ? ratingNum : null;` means declaring a local variable to store data.
*   **Line 147**: `              const placeIsSaved = isFavourite(String(p.id));` means declaring a local variable to store data.
*   **Line 148**: `              const heartAria = user` means declaring a local variable to store data.
*   **Line 149**: `                ? (placeIsSaved ? t('home', 'removeFromFavourites') : t('home', 'addToFavourites'))` means executing standard component logic or rendering a nested HTML element.
*   **Line 150**: `                : t('home', 'signInToSave');` means executing standard component logic or rendering a nested HTML element.
*   **Line 151**: `              const titleId = 'vd-top-picks-title-${placeId}';` means declaring a local variable to store data.
*   **Line 152**: `              return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 153**: `                <article key={placeId} className="vd-top-picks-card vd-top-picks-card--split-hit">` means executing standard component logic or rendering a nested HTML element.
*   **Line 154**: `                  <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 155**: `                    to={'/place/${placeId}'}` means executing standard component logic or rendering a nested HTML element.
*   **Line 156**: `                    className="vd-top-picks-card-bg vd-top-picks-card-bg--hit"` means applying specific CSS styling classes to the element.
*   **Line 157**: `                    tabIndex={-1}` means executing standard component logic or rendering a nested HTML element.
*   **Line 158**: `                    aria-hidden="true"` means executing standard component logic or rendering a nested HTML element.
*   **Line 159**: `                  >` means executing standard component logic or rendering a nested HTML element.
*   **Line 160**: `                    {safeImg ? (` means executing embedded JavaScript logic within the HTML.
*   **Line 161**: `                      <DeliveryImg` means executing standard component logic or rendering a nested HTML element.
*   **Line 162**: `                        url={safeImg}` means executing standard component logic or rendering a nested HTML element.
*   **Line 163**: `                        preset="topPicks"` means executing standard component logic or rendering a nested HTML element.
*   **Line 164**: `                        alt=""` means executing standard component logic or rendering a nested HTML element.
*   **Line 165**: `                        loading={slideIndex === 0 ? 'eager' : 'lazy'}` means executing standard component logic or rendering a nested HTML element.
*   **Line 166**: `                        fetchPriority={slideIndex === 0 ? 'high' : undefined}` means executing standard component logic or rendering a nested HTML element.
*   **Line 167**: `                      />` means executing standard component logic or rendering a nested HTML element.
*   **Line 168**: `                    ) : (` means executing standard component logic or rendering a nested HTML element.
*   **Line 169**: `                      <span className="vd-top-picks-fallback">{t('home', 'place')}</span>` means opening an inline text wrapper (span).
*   **Line 170**: `                    )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 171**: `                  </Link>` means closing the navigation link.
*   **Line 172**: `                  <div className="vd-top-picks-card-body">` means opening a generic layout container (div).
*   **Line 173**: `                    <div className="vd-top-picks-card-content">` means opening a generic layout container (div).
*   **Line 174**: `                      <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 175**: `                        to={'/place/${placeId}'}` means executing standard component logic or rendering a nested HTML element.
*   **Line 176**: `                        className="vd-top-picks-card-text-hit"` means applying specific CSS styling classes to the element.
*   **Line 177**: `                        aria-labelledby={titleId}` means executing standard component logic or rendering a nested HTML element.
*   **Line 178**: `                        aria-describedby={desc ? '${titleId}-desc' : undefined}` means executing standard component logic or rendering a nested HTML element.
*   **Line 179**: `                      >` means executing standard component logic or rendering a nested HTML element.
*   **Line 180**: `                        <span className="vd-top-picks-eyebrow">{t('home', 'topPickEyebrow')}</span>` means opening an inline text wrapper (span).
*   **Line 181**: `                        <h3 id={titleId} className="vd-top-picks-name">` means displaying a formatted heading title.
*   **Line 182**: `                          {name}` means executing embedded JavaScript logic within the HTML.
*   **Line 183**: `                        </h3>` means closing the heading element.
*   **Line 184**: `                        {desc ? (` means executing embedded JavaScript logic within the HTML.
*   **Line 185**: `                          <p id={'${titleId}-desc'} className="vd-top-picks-desc">` means opening a text paragraph element.
*   **Line 186**: `                            {desc}` means executing embedded JavaScript logic within the HTML.
*   **Line 187**: `                          </p>` means closing the text paragraph.
*   **Line 188**: `                        ) : null}` means executing standard component logic or rendering a nested HTML element.
*   **Line 189**: `                        <div className="vd-top-picks-details">` means opening a generic layout container (div).
*   **Line 190**: `                          {rating != null && rating > 0 && (` means executing embedded JavaScript logic within the HTML.
*   **Line 191**: `                            <span className="vd-top-picks-detail vd-top-picks-detail--rating">` means opening an inline text wrapper (span).
*   **Line 192**: `                              <Icon name="star" size={16} /> {rating.toFixed(1)}` means displaying a custom vector graphic icon.
*   **Line 193**: `                            </span>` means closing the inline text wrapper.
*   **Line 194**: `                          )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 195**: `                        </div>` means closing the layout container.
*   **Line 196**: `                      </Link>` means closing the navigation link.
*   **Line 197**: `                    </div>` means closing the layout container.
*   **Line 198**: `                    <div className="vd-top-picks-glass-footer">` means opening a generic layout container (div).
*   **Line 199**: `                      <div className="vd-top-picks-cta-row">` means opening a generic layout container (div).
*   **Line 200**: `                        <Link to={'/place/${placeId}'} className="vd-top-picks-read-now">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 201**: `                          {t('home', 'topPicksReadMore')}` means executing embedded JavaScript logic within the HTML.
*   **Line 202**: `                          <Icon name="arrow_forward" size={18} className="vd-btn-arrow" />` means displaying a custom vector graphic icon.
*   **Line 203**: `                        </Link>` means closing the navigation link.
*   **Line 204**: `                        <div className="vd-top-picks-card-floating-actions">` means opening a generic layout container (div).
*   **Line 205**: `                          <button` means rendering a clickable button element.
*   **Line 206**: `                            type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 207**: `                            className={'vd-top-picks-action-btn vd-top-picks-action-btn--heart ${placeIsSaved ? 'vd-top-picks-action-btn--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 208**: `                            onClick={(e) => toggleFavourite(e, placeId)}` means attaching a click-event listener to handle user interaction.
*   **Line 209**: `                            aria-label={heartAria}` means executing standard component logic or rendering a nested HTML element.
*   **Line 210**: `                          >` means executing standard component logic or rendering a nested HTML element.
*   **Line 211**: `                            <Icon name={placeIsSaved ? 'favorite' : 'favorite_border'} size={24} />` means displaying a custom vector graphic icon.
*   **Line 212**: `                          </button>` means closing the button element.
*   **Line 213**: `                        </div>` means closing the layout container.
*   **Line 214**: `                      </div>` means closing the layout container.
*   **Line 215**: `                    </div>` means closing the layout container.
*   **Line 216**: `                  </div>` means closing the layout container.
*   **Line 217**: `                </article>` means executing standard component logic or rendering a nested HTML element.
*   **Line 218**: `              );` means ending the HTML/JSX output block.
*   **Line 219**: `            })}` means closing the current function or code block.
*   **Line 220**: `          </div>` means closing the layout container.
*   **Line 221**: `` means an empty line for visual spacing.
*   **Line 222**: `          {safePlaces.length > 1 && (` means executing embedded JavaScript logic within the HTML.
*   **Line 223**: `            <div className="vd-top-picks-nav" aria-hidden="true">` means opening a generic layout container (div).
*   **Line 224**: `              <button` means rendering a clickable button element.
*   **Line 225**: `                type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 226**: `                className="vd-top-picks-arrow vd-top-picks-arrow--prev"` means applying specific CSS styling classes to the element.
*   **Line 227**: `                onClick={handlePrev}` means attaching a click-event listener to handle user interaction.
*   **Line 228**: `                aria-label={t('home', 'prevSlide')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 229**: `              >` means executing standard component logic or rendering a nested HTML element.
*   **Line 230**: `                <Icon name="chevron_left" size={28} />` means displaying a custom vector graphic icon.
*   **Line 231**: `              </button>` means closing the button element.
*   **Line 232**: `              <button` means rendering a clickable button element.
*   **Line 233**: `                type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 234**: `                className="vd-top-picks-arrow vd-top-picks-arrow--next"` means applying specific CSS styling classes to the element.
*   **Line 235**: `                onClick={handleNext}` means attaching a click-event listener to handle user interaction.
*   **Line 236**: `                aria-label={t('home', 'nextSlide')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 237**: `              >` means executing standard component logic or rendering a nested HTML element.
*   **Line 238**: `                <Icon name="chevron_right" size={28} />` means displaying a custom vector graphic icon.
*   **Line 239**: `              </button>` means closing the button element.
*   **Line 240**: `            </div>` means closing the layout container.
*   **Line 241**: `          )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 242**: `        </div>` means closing the layout container.
*   **Line 243**: `` means an empty line for visual spacing.
*   **Line 244**: `        <footer className="vd-top-picks-carousel-footer">` means opening a footer block.
*   **Line 245**: `          <div className="vd-top-picks-counter">` means opening a generic layout container (div).
*   **Line 246**: `            <span className="vd-top-picks-counter-label">{t('home', 'topPicksCounterLabel')}</span>` means opening an inline text wrapper (span).
*   **Line 247**: `            <div className="vd-top-picks-counter-nums">` means opening a generic layout container (div).
*   **Line 248**: `              <span className="vd-top-picks-counter-current">{String(index + 1).padStart(2, '0')}</span>` means opening an inline text wrapper (span).
*   **Line 249**: `              <span className="vd-top-picks-counter-sep">/</span>` means opening an inline text wrapper (span).
*   **Line 250**: `              <span className="vd-top-picks-counter-total">{String(safePlaces.length).padStart(2, '0')}</span>` means opening an inline text wrapper (span).
*   **Line 251**: `            </div>` means closing the layout container.
*   **Line 252**: `          </div>` means closing the layout container.
*   **Line 253**: `` means an empty line for visual spacing.
*   **Line 254**: `          <div className="vd-top-picks-dots" role="tablist">` means opening a generic layout container (div).
*   **Line 255**: `            {safePlaces.map((_, i) => (` means executing embedded JavaScript logic within the HTML.
*   **Line 256**: `              <button` means rendering a clickable button element.
*   **Line 257**: `                key={i}` means executing standard component logic or rendering a nested HTML element.
*   **Line 258**: `                type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 259**: `                role="tab"` means executing standard component logic or rendering a nested HTML element.
*   **Line 260**: `                aria-selected={i === index}` means executing standard component logic or rendering a nested HTML element.
*   **Line 261**: `                aria-label={t('home', 'goToSlide').replace('{n}', i + 1)}` means executing standard component logic or rendering a nested HTML element.
*   **Line 262**: `                className={'vd-top-picks-dot ${i === index ? 'vd-top-picks-dot--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 263**: `                onClick={() => setIndex(i)}` means attaching a click-event listener to handle user interaction.
*   **Line 264**: `              />` means executing standard component logic or rendering a nested HTML element.
*   **Line 265**: `            ))}` means executing standard component logic or rendering a nested HTML element.
*   **Line 266**: `          </div>` means closing the layout container.
*   **Line 267**: `        </footer>` means closing the footer block.
*   **Line 268**: `      </div>` means closing the layout container.
*   **Line 269**: `    </section>` means closing the page section.
*   **Line 270**: `  );` means ending the HTML/JSX output block.
*   **Line 271**: `}` means closing the current function or code block.
*   **Line 272**: `` means an empty line for visual spacing.

## `client/src/components/home/PracticalSection.jsx`
*   **Line 1**: `import { Link } from 'react-router-dom';` means importing a necessary component, module, or hook.
*   **Line 2**: `import Icon from '../Icon';` means importing a necessary component, module, or hook.
*   **Line 3**: `import FindYourWayMap from '../FindYourWayMap';` means importing a necessary component, module, or hook.
*   **Line 4**: `import { COMMUNITY_PATH, PLACES_DISCOVER_PATH } from '../../utils/discoverPaths';` means importing a necessary component, module, or hook.
*   **Line 5**: `` means an empty line for visual spacing.
*   **Line 6**: `export default function PracticalSection({ ` means defining and exporting the main React component.
*   **Line 7**: `  t, ` means executing standard component logic or rendering a nested HTML element.
*   **Line 8**: `  places = [], ` means executing standard component logic or rendering a nested HTML element.
*   **Line 9**: `  showMap = true, ` means executing standard component logic or rendering a nested HTML element.
*   **Line 10**: `  userTips = true ` means executing standard component logic or rendering a nested HTML element.
*   **Line 11**: `}) {` means closing the current function or code block.
*   **Line 12**: `  const safeT = (ns, key) => (t && typeof t === 'function' ? t(ns, key) : key);` means declaring a local variable to store data.
*   **Line 13**: `  ` means an empty line for visual spacing.
*   **Line 14**: `  return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 15**: `    <>` means executing standard component logic or rendering a nested HTML element.
*   **Line 16**: `      <section` means opening a major semantic page section.
*   **Line 17**: `        className="vd-section vd-experience-tripoli vd-find-your-way vd-find-your-way--practical"` means applying specific CSS styling classes to the element.
*   **Line 18**: `        aria-labelledby="find-your-way-practical-title"` means executing standard component logic or rendering a nested HTML element.
*   **Line 19**: `      >` means executing standard component logic or rendering a nested HTML element.
*   **Line 20**: `        <div className="vd-container">` means opening a generic layout container (div).
*   **Line 21**: `          <header className="vd-find-your-way-header vd-find-your-way-header--practical">` means opening a header block for the section.
*   **Line 22**: `            <h2 id="find-your-way-practical-title" className="vd-find-your-way-title">` means displaying a formatted heading title.
*   **Line 23**: `              {safeT('home', 'findYourWayPracticalTitle')}` means executing embedded JavaScript logic within the HTML.
*   **Line 24**: `            </h2>` means closing the heading element.
*   **Line 25**: `            <p className="vd-find-your-way-sub">{safeT('home', 'findYourWayPracticalSub')}</p>` means opening a text paragraph element.
*   **Line 26**: `          </header>` means closing the header block.
*   **Line 27**: `` means an empty line for visual spacing.
*   **Line 28**: `          <div className="vd-find-your-way-main-grid vd-find-your-way-main-grid--practical-split">` means opening a generic layout container (div).
*   **Line 29**: `            <div className="vd-find-your-way-areas-panel">` means opening a generic layout container (div).
*   **Line 30**: `              <div id="areas" className="vd-plan-trip-block vd-find-your-way-areas-card vd-find-your-way-areas-card--map">` means opening a generic layout container (div).
*   **Line 31**: `                <div className="vd-find-your-way-areas-card-intro">` means opening a generic layout container (div).
*   **Line 32**: `                  <h3 className="vd-plan-trip-block-title">{safeT('home', 'areasTitle')}</h3>` means displaying a formatted heading title.
*   **Line 33**: `                  <p className="vd-plan-trip-block-desc">{safeT('home', 'areasMapSub')}</p>` means opening a text paragraph element.
*   **Line 34**: `                  {showMap && (` means executing embedded JavaScript logic within the HTML.
*   **Line 35**: `                    <div className="vd-plan-trip-inline-actions vd-find-your-way-areas-map-link vd-find-your-way-areas-map-link--home-preview">` means opening a generic layout container (div).
*   **Line 36**: `                      <Link to="/map" className="vd-plan-trip-inline-link">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 37**: `                        {safeT('home', 'viewMapCta')}` means executing embedded JavaScript logic within the HTML.
*   **Line 38**: `                        <Icon name="arrow_forward" size={18} aria-hidden />` means displaying a custom vector graphic icon.
*   **Line 39**: `                      </Link>` means closing the navigation link.
*   **Line 40**: `                    </div>` means closing the layout container.
*   **Line 41**: `                  )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 42**: `                </div>` means closing the layout container.
*   **Line 43**: `                <FindYourWayMap places={places} t={t} loadEager />` means executing standard component logic or rendering a nested HTML element.
*   **Line 44**: `              </div>` means closing the layout container.
*   **Line 45**: `            </div>` means closing the layout container.
*   **Line 46**: `` means an empty line for visual spacing.
*   **Line 47**: `            <aside` means executing standard component logic or rendering a nested HTML element.
*   **Line 48**: `              className="vd-find-your-way-practical-aside"` means applying specific CSS styling classes to the element.
*   **Line 49**: `              aria-labelledby="find-your-way-nav-aside-title"` means executing standard component logic or rendering a nested HTML element.
*   **Line 50**: `            >` means executing standard component logic or rendering a nested HTML element.
*   **Line 51**: `              <div className="vd-plan-trip-block vd-find-your-way-practical-aside-card">` means opening a generic layout container (div).
*   **Line 52**: `                <h3 id="find-your-way-nav-aside-title" className="vd-plan-trip-block-title">` means displaying a formatted heading title.
*   **Line 53**: `                  {safeT('home', 'findYourWayNavAsideTitle')}` means executing embedded JavaScript logic within the HTML.
*   **Line 54**: `                </h3>` means closing the heading element.
*   **Line 55**: `                <p className="vd-plan-trip-block-desc">{safeT('home', 'findYourWayNavAsideLead')}</p>` means opening a text paragraph element.
*   **Line 56**: `                <ul className="vd-find-your-way-practical-aside-list">` means executing standard component logic or rendering a nested HTML element.
*   **Line 57**: `                  <li>{safeT('home', 'findYourWayNavAsideBullet1')}</li>` means executing standard component logic or rendering a nested HTML element.
*   **Line 58**: `                  <li>{safeT('home', 'findYourWayNavAsideBullet2')}</li>` means executing standard component logic or rendering a nested HTML element.
*   **Line 59**: `                  <li>{safeT('home', 'findYourWayNavAsideBullet3')}</li>` means executing standard component logic or rendering a nested HTML element.
*   **Line 60**: `                </ul>` means executing standard component logic or rendering a nested HTML element.
*   **Line 61**: `                <div className="vd-plan-trip-inline-actions vd-find-your-way-practical-aside-actions">` means opening a generic layout container (div).
*   **Line 62**: `                  <Link to="/map" className="vd-plan-trip-inline-link">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 63**: `                    {safeT('home', 'viewMapCta')}` means executing embedded JavaScript logic within the HTML.
*   **Line 64**: `                    <Icon name="arrow_forward" size={18} aria-hidden />` means displaying a custom vector graphic icon.
*   **Line 65**: `                  </Link>` means closing the navigation link.
*   **Line 66**: `                  <Link to="/plan" className="vd-plan-trip-inline-link vd-plan-trip-inline-link--secondary">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 67**: `                    {safeT('home', 'gettingThereCta')}` means executing embedded JavaScript logic within the HTML.
*   **Line 68**: `                    <Icon name="arrow_forward" size={18} aria-hidden />` means displaying a custom vector graphic icon.
*   **Line 69**: `                  </Link>` means closing the navigation link.
*   **Line 70**: `                </div>` means closing the layout container.
*   **Line 71**: `              </div>` means closing the layout container.
*   **Line 72**: `              <div` means opening a generic layout container (div).
*   **Line 73**: `                className="vd-find-your-way-practical-quick"` means applying specific CSS styling classes to the element.
*   **Line 74**: `                aria-label={safeT('home', 'findYourWayPracticalQuickTitle')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 75**: `              >` means executing standard component logic or rendering a nested HTML element.
*   **Line 76**: `                <p className="vd-find-your-way-practical-quick-title">` means opening a text paragraph element.
*   **Line 77**: `                  {safeT('home', 'findYourWayPracticalQuickTitle')}` means executing embedded JavaScript logic within the HTML.
*   **Line 78**: `                </p>` means closing the text paragraph.
*   **Line 79**: `                <div className="vd-find-your-way-practical-quick-grid">` means opening a generic layout container (div).
*   **Line 80**: `                  <Link to={PLACES_DISCOVER_PATH} className="vd-find-your-way-practical-quick-link">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 81**: `                    <Icon name="explore" size={20} aria-hidden />` means displaying a custom vector graphic icon.
*   **Line 82**: `                    <span>{safeT('home', 'findYourWayPracticalQuickDiscover')}</span>` means opening an inline text wrapper (span).
*   **Line 83**: `                  </Link>` means closing the navigation link.
*   **Line 84**: `                  <Link to="/plan" className="vd-find-your-way-practical-quick-link">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 85**: `                    <Icon name="calendar_month" size={20} aria-hidden />` means displaying a custom vector graphic icon.
*   **Line 86**: `                    <span>{safeT('home', 'findYourWayPracticalQuickPlan')}</span>` means opening an inline text wrapper (span).
*   **Line 87**: `                  </Link>` means closing the navigation link.
*   **Line 88**: `                  <Link to={COMMUNITY_PATH} className="vd-find-your-way-practical-quick-link">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 89**: `                    <Icon name="chat_bubble_outline" size={20} aria-hidden />` means displaying a custom vector graphic icon.
*   **Line 90**: `                    <span>{safeT('home', 'findYourWayPracticalQuickCommunity')}</span>` means opening an inline text wrapper (span).
*   **Line 91**: `                  </Link>` means closing the navigation link.
*   **Line 92**: `                </div>` means closing the layout container.
*   **Line 93**: `              </div>` means closing the layout container.
*   **Line 94**: `            </aside>` means executing standard component logic or rendering a nested HTML element.
*   **Line 95**: `          </div>` means closing the layout container.
*   **Line 96**: `        </div>` means closing the layout container.
*   **Line 97**: `      </section>` means closing the page section.
*   **Line 98**: `` means an empty line for visual spacing.
*   **Line 99**: `      {!userTips && (` means executing embedded JavaScript logic within the HTML.
*   **Line 100**: `        <section id="plan-trip" className="vd-section vd-plan-trip-one vd-plan-trip-one--tips">` means opening a major semantic page section.
*   **Line 101**: `          <div className="vd-container">` means opening a generic layout container (div).
*   **Line 102**: `            <header className="vd-plan-trip-header">` means opening a header block for the section.
*   **Line 103**: `              <h2 className="vd-plan-trip-section-title">{safeT('home', 'planTripTipsSectionTitle')}</h2>` means displaying a formatted heading title.
*   **Line 104**: `              <p className="vd-plan-trip-section-sub">{safeT('home', 'planTripTipsSectionSub')}</p>` means opening a text paragraph element.
*   **Line 105**: `            </header>` means closing the header block.
*   **Line 106**: `            <div className="vd-plan-trip-block vd-plan-trip-block--compact">` means opening a generic layout container (div).
*   **Line 107**: `              <p className="vd-plan-trip-block-desc">{safeT('home', 'planTripTipsFallback')}</p>` means opening a text paragraph element.
*   **Line 108**: `              <div className="vd-plan-trip-inline-actions">` means opening a generic layout container (div).
*   **Line 109**: `                <Link to="/plan" className="vd-plan-trip-inline-link">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 110**: `                  {safeT('home', 'gettingThereCta')}` means executing embedded JavaScript logic within the HTML.
*   **Line 111**: `                  <Icon name="arrow_forward" size={18} />` means displaying a custom vector graphic icon.
*   **Line 112**: `                </Link>` means closing the navigation link.
*   **Line 113**: `                <Link to={PLACES_DISCOVER_PATH} className="vd-plan-trip-inline-link">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 114**: `                  {safeT('home', 'seeAllWays')}` means executing embedded JavaScript logic within the HTML.
*   **Line 115**: `                  <Icon name="arrow_forward" size={18} />` means displaying a custom vector graphic icon.
*   **Line 116**: `                </Link>` means closing the navigation link.
*   **Line 117**: `              </div>` means closing the layout container.
*   **Line 118**: `            </div>` means closing the layout container.
*   **Line 119**: `          </div>` means closing the layout container.
*   **Line 120**: `        </section>` means closing the page section.
*   **Line 121**: `      )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 122**: `    </>` means executing standard component logic or rendering a nested HTML element.
*   **Line 123**: `  );` means ending the HTML/JSX output block.
*   **Line 124**: `}` means closing the current function or code block.
*   **Line 125**: `` means an empty line for visual spacing.

## `client/src/components/home/PlanVisitSection.jsx`
*   **Line 1**: `import { useState, useEffect } from 'react';` means importing a necessary component, module, or hook.
*   **Line 2**: `import { Link } from 'react-router-dom';` means importing a necessary component, module, or hook.
*   **Line 3**: `import Icon from '../Icon';` means importing a necessary component, module, or hook.
*   **Line 4**: `import { getApiOrigin } from '../../utils/apiOrigin';` means importing a necessary component, module, or hook.
*   **Line 5**: `` means an empty line for visual spacing.
*   **Line 6**: `const TRIPOLI_TIMEZONE = 'Asia/Beirut';` means declaring a local variable to store data.
*   **Line 7**: `` means an empty line for visual spacing.
*   **Line 8**: `function TripoliClock({ title, condition, locale, dateLabel, timezoneLabel }) {` means defining a local helper function.
*   **Line 9**: `  const [now, setNow] = useState(() => new Date());` means initializing a React state variable to track data changes.
*   **Line 10**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 11**: `    const t = setInterval(() => setNow(new Date()), 1000);` means declaring a local variable to store data.
*   **Line 12**: `    return () => clearInterval(t);` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 13**: `  }, []);` means closing the current function or code block.
*   **Line 14**: `  const opts = { timeZone: TRIPOLI_TIMEZONE };` means declaring a local variable to store data.
*   **Line 15**: `  const safeLocale = typeof locale === 'string' ? locale : 'en-GB';` means declaring a local variable to store data.
*   **Line 16**: `  const timeStr = now.toLocaleTimeString(safeLocale, { ...opts, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });` means declaring a local variable to store data.
*   **Line 17**: `  const dateStr = now.toLocaleDateString(safeLocale, { ...opts, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });` means declaring a local variable to store data.
*   **Line 18**: `  const safeTitle = title ?? '';` means declaring a local variable to store data.
*   **Line 19**: `  const safeCondition = condition ?? '';` means declaring a local variable to store data.
*   **Line 20**: `  const safeDateLabel = dateLabel ?? 'Date';` means declaring a local variable to store data.
*   **Line 21**: `  const safeTimezoneLabel = timezoneLabel ?? 'Time zone';` means declaring a local variable to store data.
*   **Line 22**: `  return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 23**: `    <div className="vd-widget vd-widget--open vd-tripoli-clock" aria-live="polite" aria-label={safeTitle || 'Tripoli local time'}>` means opening a generic layout container (div).
*   **Line 24**: `      <div className="vd-widget-left">` means opening a generic layout container (div).
*   **Line 25**: `        <h3 className="vd-widget-title">{safeTitle}</h3>` means displaying a formatted heading title.
*   **Line 26**: `        <div className="vd-widget-main">` means opening a generic layout container (div).
*   **Line 27**: `          <span className="vd-widget-value vd-tripoli-clock-time">{timeStr}</span>` means opening an inline text wrapper (span).
*   **Line 28**: `          <span className="vd-widget-icon vd-tripoli-clock-icon" aria-hidden="true" title="Tripoli local time">` means opening an inline text wrapper (span).
*   **Line 29**: `            <svg width="34" height="34" viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">` means executing standard component logic or rendering a nested HTML element.
*   **Line 30**: `              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />` means executing standard component logic or rendering a nested HTML element.
*   **Line 31**: `              <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />` means opening a text paragraph element.
*   **Line 32**: `            </svg>` means executing standard component logic or rendering a nested HTML element.
*   **Line 33**: `          </span>` means closing the inline text wrapper.
*   **Line 34**: `        </div>` means closing the layout container.
*   **Line 35**: `        <p className="vd-widget-condition">{safeCondition}</p>` means opening a text paragraph element.
*   **Line 36**: `      </div>` means closing the layout container.
*   **Line 37**: `      <div className="vd-widget-right">` means opening a generic layout container (div).
*   **Line 38**: `        <div className="vd-widget-details">` means opening a generic layout container (div).
*   **Line 39**: `          <div className="vd-widget-detail">` means opening a generic layout container (div).
*   **Line 40**: `            <span className="vd-widget-detail-label">{safeDateLabel}</span>` means opening an inline text wrapper (span).
*   **Line 41**: `            <span className="vd-widget-detail-value">{dateStr}</span>` means opening an inline text wrapper (span).
*   **Line 42**: `          </div>` means closing the layout container.
*   **Line 43**: `          <div className="vd-widget-detail">` means opening a generic layout container (div).
*   **Line 44**: `            <span className="vd-widget-detail-label">{safeTimezoneLabel}</span>` means opening an inline text wrapper (span).
*   **Line 45**: `            <span className="vd-widget-detail-value">Asia/Beirut</span>` means opening an inline text wrapper (span).
*   **Line 46**: `        </div>` means closing the layout container.
*   **Line 47**: `      </div>` means closing the layout container.
*   **Line 48**: `      </div>` means closing the layout container.
*   **Line 49**: `    </div>` means closing the layout container.
*   **Line 50**: `  );` means ending the HTML/JSX output block.
*   **Line 51**: `}` means closing the current function or code block.
*   **Line 52**: `` means an empty line for visual spacing.
*   **Line 53**: `function tripoliWeatherApiUrl() {` means defining a local helper function.
*   **Line 54**: `  const base = getApiOrigin();` means declaring a local variable to store data.
*   **Line 55**: `  const path = '/api/public/weather/tripoli';` means declaring a local variable to store data.
*   **Line 56**: `  return base ? '${base}${path}' : path;` means returning a computed value from the function.
*   **Line 57**: `}` means closing the current function or code block.
*   **Line 58**: `` means an empty line for visual spacing.
*   **Line 59**: `function wmoToConditionKey(code) {` means defining a local helper function.
*   **Line 60**: `  if (code === 0 || code === 1) return 'weatherSunny';` means checking a specific logic condition before proceeding.
*   **Line 61**: `  if (code === 2) return 'weatherPartlyCloudy';` means checking a specific logic condition before proceeding.
*   **Line 62**: `  if (code === 3) return 'weatherCloudy';` means checking a specific logic condition before proceeding.
*   **Line 63**: `  if (code === 45 || code === 48) return 'weatherFog';` means checking a specific logic condition before proceeding.
*   **Line 64**: `  if (code >= 51 && code <= 57) return 'weatherDrizzle';` means checking a specific logic condition before proceeding.
*   **Line 65**: `  if (code >= 61 && code <= 67 || (code >= 80 && code <= 82)) return 'weatherRain';` means checking a specific logic condition before proceeding.
*   **Line 66**: `  if (code >= 71 && code <= 77) return 'weatherSnow';` means checking a specific logic condition before proceeding.
*   **Line 67**: `  if (code >= 95 && code <= 99) return 'weatherThunderstorm';` means checking a specific logic condition before proceeding.
*   **Line 68**: `  return 'weatherSunny';` means returning a computed value from the function.
*   **Line 69**: `}` means closing the current function or code block.
*   **Line 70**: `` means an empty line for visual spacing.
*   **Line 71**: `function WeatherIcon({ code }) {` means defining a local helper function.
*   **Line 72**: `  if (code === 0 || code === 1) return <span className="vd-weather-sun" aria-hidden="true" />;` means checking a specific logic condition before proceeding.
*   **Line 73**: `  if (code === 2) return <span className="vd-weather-partly-cloudy" aria-hidden="true" />;` means checking a specific logic condition before proceeding.
*   **Line 74**: `  if (code === 3) return <span className="vd-weather-cloudy" aria-hidden="true" />;` means checking a specific logic condition before proceeding.
*   **Line 75**: `  if (code >= 51 && code <= 67 || (code >= 80 && code <= 82)) return <span className="vd-weather-rain" aria-hidden="true" />;` means checking a specific logic condition before proceeding.
*   **Line 76**: `  if (code >= 95 && code <= 99) return <span className="vd-weather-storm" aria-hidden="true" />;` means checking a specific logic condition before proceeding.
*   **Line 77**: `  return <span className="vd-weather-sun" aria-hidden="true" />;` means returning a computed value from the function.
*   **Line 78**: `}` means closing the current function or code block.
*   **Line 79**: `` means an empty line for visual spacing.
*   **Line 80**: `function WeatherTripoli({` means defining a local helper function.
*   **Line 81**: `  title,` means executing standard component logic or rendering a nested HTML element.
*   **Line 82**: `  sunriseLabel,` means executing standard component logic or rendering a nested HTML element.
*   **Line 83**: `  sunsetLabel,` means executing standard component logic or rendering a nested HTML element.
*   **Line 84**: `  lowLabel,` means executing standard component logic or rendering a nested HTML element.
*   **Line 85**: `  highLabel,` means executing standard component logic or rendering a nested HTML element.
*   **Line 86**: `  humidityLabel,` means executing standard component logic or rendering a nested HTML element.
*   **Line 87**: `  windLabel,` means executing standard component logic or rendering a nested HTML element.
*   **Line 88**: `  celsiusLabel,` means executing standard component logic or rendering a nested HTML element.
*   **Line 89**: `  fahrenheitLabel,` means executing standard component logic or rendering a nested HTML element.
*   **Line 90**: `  t,` means executing standard component logic or rendering a nested HTML element.
*   **Line 91**: `}) {` means closing the current function or code block.
*   **Line 92**: `  const [data, setData] = useState(null);` means initializing a React state variable to track data changes.
*   **Line 93**: `  const [loading, setLoading] = useState(true);` means initializing a React state variable to track data changes.
*   **Line 94**: `  const [error, setError] = useState(null);` means initializing a React state variable to track data changes.
*   **Line 95**: `  const [unit, setUnit] = useState('c');` means initializing a React state variable to track data changes.
*   **Line 96**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 97**: `    let cancelled = false;` means declaring a local variable to store data.
*   **Line 98**: `    const url = tripoliWeatherApiUrl();` means declaring a local variable to store data.
*   **Line 99**: `    fetch(url)` means executing standard component logic or rendering a nested HTML element.
*   **Line 100**: `      .then((res) => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 101**: `        if (!res.ok) {` means checking a specific logic condition before proceeding.
*   **Line 102**: `          throw new Error(res.status === 502 ? 'Weather temporarily unavailable' : 'HTTP ${res.status}');` means executing standard component logic or rendering a nested HTML element.
*   **Line 103**: `        }` means closing the current function or code block.
*   **Line 104**: `        return res.json();` means returning a computed value from the function.
*   **Line 105**: `      })` means closing the current function or code block.
*   **Line 106**: `      .then((json) => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 107**: `        if (!cancelled) setData(json);` means checking a specific logic condition before proceeding.
*   **Line 108**: `      })` means closing the current function or code block.
*   **Line 109**: `      .catch((err) => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 110**: `        if (!cancelled) setError(String(err?.message ?? err ?? 'Failed to load'));` means checking a specific logic condition before proceeding.
*   **Line 111**: `      })` means closing the current function or code block.
*   **Line 112**: `      .finally(() => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 113**: `        if (!cancelled) setLoading(false);` means checking a specific logic condition before proceeding.
*   **Line 114**: `      });` means closing the current function or code block.
*   **Line 115**: `    return () => {` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 116**: `      cancelled = true;` means executing standard component logic or rendering a nested HTML element.
*   **Line 117**: `    };` means closing the current function or code block.
*   **Line 118**: `  }, []);` means closing the current function or code block.
*   **Line 119**: `` means an empty line for visual spacing.
*   **Line 120**: `  if (loading || error || !data || !data.current || !data.daily) {` means checking a specific logic condition before proceeding.
*   **Line 121**: `    return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 122**: `      <div className="vd-widget vd-widget--open vd-weather-tripoli">` means opening a generic layout container (div).
*   **Line 123**: `        <h3 className="vd-widget-title">{title ?? 'Weather'}</h3>` means displaying a formatted heading title.
*   **Line 124**: `        <div className="vd-widget-loading">` means opening a generic layout container (div).
*   **Line 125**: `          {loading ? t('home', 'loading') : '—'}` means executing embedded JavaScript logic within the HTML.
*   **Line 126**: `        </div>` means closing the layout container.
*   **Line 127**: `      </div>` means closing the layout container.
*   **Line 128**: `    );` means ending the HTML/JSX output block.
*   **Line 129**: `  }` means closing the current function or code block.
*   **Line 130**: `` means an empty line for visual spacing.
*   **Line 131**: `  const cur = data.current;` means declaring a local variable to store data.
*   **Line 132**: `  const daily = data.daily;` means declaring a local variable to store data.
*   **Line 133**: `  const tempC = cur && typeof cur.temperature_2m === 'number' ? cur.temperature_2m : 0;` means declaring a local variable to store data.
*   **Line 134**: `  const tempF = (tempC \* 9) / 5 + 32;` means declaring a local variable to store data.
*   **Line 135**: `  const displayTemp = unit === 'c' ? '${Number(tempC).toFixed(1)}°' : '${Number(tempF).toFixed(1)}°';` means declaring a local variable to store data.
*   **Line 136**: `  const conditionKey = wmoToConditionKey(cur && typeof cur.weather_code === 'number' ? cur.weather_code : 0);` means declaring a local variable to store data.
*   **Line 137**: `  const lowC = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null;` means declaring a local variable to store data.
*   **Line 138**: `  const highC = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null;` means declaring a local variable to store data.
*   **Line 139**: `  const lowF = lowC != null && typeof lowC === 'number' ? (lowC \* 9) / 5 + 32 : null;` means declaring a local variable to store data.
*   **Line 140**: `  const highF = highC != null && typeof highC === 'number' ? (highC \* 9) / 5 + 32 : null;` means declaring a local variable to store data.
*   **Line 141**: `  const sunriseArr = Array.isArray(daily.sunrise) ? daily.sunrise[0] : null;` means declaring a local variable to store data.
*   **Line 142**: `  const sunsetArr = Array.isArray(daily.sunset) ? daily.sunset[0] : null;` means declaring a local variable to store data.
*   **Line 143**: `  const sunrise = typeof sunriseArr === 'string' && sunriseArr.length >= 16 ? sunriseArr.slice(11, 16) : '—';` means declaring a local variable to store data.
*   **Line 144**: `  const sunset = typeof sunsetArr === 'string' && sunsetArr.length >= 16 ? sunsetArr.slice(11, 16) : '—';` means declaring a local variable to store data.
*   **Line 145**: `  const humidity = cur && typeof cur.relative_humidity_2m === 'number' ? '${cur.relative_humidity_2m}%' : '—';` means declaring a local variable to store data.
*   **Line 146**: `  const wind = cur && (typeof cur.wind_speed_10m === 'number' || typeof cur.wind_speed_10m === 'string') ? '${cur.wind_speed_10m} km/h' : '—';` means declaring a local variable to store data.
*   **Line 147**: `` means an empty line for visual spacing.
*   **Line 148**: `  return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 149**: `    <div className="vd-widget vd-widget--open vd-weather-tripoli" aria-label={title || 'Weather in Tripoli'}>` means opening a generic layout container (div).
*   **Line 150**: `      <div className="vd-widget-left">` means opening a generic layout container (div).
*   **Line 151**: `        <h3 className="vd-widget-title">{title}</h3>` means displaying a formatted heading title.
*   **Line 152**: `        <div className="vd-widget-main">` means opening a generic layout container (div).
*   **Line 153**: `          <span className="vd-widget-value vd-weather-temp">{displayTemp}</span>` means opening an inline text wrapper (span).
*   **Line 154**: `          <span className="vd-widget-icon vd-weather-icon" aria-hidden="true">` means opening an inline text wrapper (span).
*   **Line 155**: `            <WeatherIcon code={cur.weather_code} />` means executing standard component logic or rendering a nested HTML element.
*   **Line 156**: `          </span>` means closing the inline text wrapper.
*   **Line 157**: `        </div>` means closing the layout container.
*   **Line 158**: `        <p className="vd-widget-condition">{t('home', conditionKey)}</p>` means opening a text paragraph element.
*   **Line 159**: `        <div className="vd-widget-units">` means opening a generic layout container (div).
*   **Line 160**: `          <button type="button" className={unit === 'c' ? 'vd-widget-unit vd-widget-unit--active' : 'vd-widget-unit'} onClick={() => setUnit('c')}>{celsiusLabel}</button>` means rendering a clickable button element.
*   **Line 161**: `          <button type="button" className={unit === 'f' ? 'vd-widget-unit vd-widget-unit--active' : 'vd-widget-unit'} onClick={() => setUnit('f')}>{fahrenheitLabel}</button>` means rendering a clickable button element.
*   **Line 162**: `        </div>` means closing the layout container.
*   **Line 163**: `      </div>` means closing the layout container.
*   **Line 164**: `      <div className="vd-widget-right">` means opening a generic layout container (div).
*   **Line 165**: `        <div className="vd-widget-details">` means opening a generic layout container (div).
*   **Line 166**: `          <div className="vd-widget-detail">` means opening a generic layout container (div).
*   **Line 167**: `            <span className="vd-widget-detail-label">{sunriseLabel}</span>` means opening an inline text wrapper (span).
*   **Line 168**: `            <span className="vd-widget-detail-value">{sunrise}</span>` means opening an inline text wrapper (span).
*   **Line 169**: `          </div>` means closing the layout container.
*   **Line 170**: `          <div className="vd-widget-detail">` means opening a generic layout container (div).
*   **Line 171**: `            <span className="vd-widget-detail-label">{sunsetLabel}</span>` means opening an inline text wrapper (span).
*   **Line 172**: `            <span className="vd-widget-detail-value">{sunset}</span>` means opening an inline text wrapper (span).
*   **Line 173**: `          </div>` means closing the layout container.
*   **Line 174**: `          <div className="vd-widget-detail">` means opening a generic layout container (div).
*   **Line 175**: `            <span className="vd-widget-detail-label">{lowLabel}</span>` means opening an inline text wrapper (span).
*   **Line 176**: `            <span className="vd-widget-detail-value">{unit === 'c' ? (lowC != null ? '${Number(lowC).toFixed(1)}°' : '—') : (lowF != null ? '${Number(lowF).toFixed(1)}°' : '—')}</span>` means opening an inline text wrapper (span).
*   **Line 177**: `          </div>` means closing the layout container.
*   **Line 178**: `          <div className="vd-widget-detail">` means opening a generic layout container (div).
*   **Line 179**: `            <span className="vd-widget-detail-label">{highLabel}</span>` means opening an inline text wrapper (span).
*   **Line 180**: `            <span className="vd-widget-detail-value">{unit === 'c' ? (highC != null ? '${Number(highC).toFixed(1)}°' : '—') : (highF != null ? '${Number(highF).toFixed(1)}°' : '—')}</span>` means opening an inline text wrapper (span).
*   **Line 181**: `          </div>` means closing the layout container.
*   **Line 182**: `          <div className="vd-widget-detail">` means opening a generic layout container (div).
*   **Line 183**: `            <span className="vd-widget-detail-label">{humidityLabel}</span>` means opening an inline text wrapper (span).
*   **Line 184**: `            <span className="vd-widget-detail-value">{humidity}</span>` means opening an inline text wrapper (span).
*   **Line 185**: `          </div>` means closing the layout container.
*   **Line 186**: `          <div className="vd-widget-detail">` means opening a generic layout container (div).
*   **Line 187**: `            <span className="vd-widget-detail-label">{windLabel}</span>` means opening an inline text wrapper (span).
*   **Line 188**: `            <span className="vd-widget-detail-value">{wind}</span>` means opening an inline text wrapper (span).
*   **Line 189**: `          </div>` means closing the layout container.
*   **Line 190**: `        </div>` means closing the layout container.
*   **Line 191**: `      </div>` means closing the layout container.
*   **Line 192**: `    </div>` means closing the layout container.
*   **Line 193**: `  );` means ending the HTML/JSX output block.
*   **Line 194**: `}` means closing the current function or code block.
*   **Line 195**: `` means an empty line for visual spacing.
*   **Line 196**: `export default function PlanVisitSection({ t, lang, showMap }) {` means defining and exporting the main React component.
*   **Line 197**: `  return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 198**: `    <section id="plan" className="vd-section vd-plan">` means opening a major semantic page section.
*   **Line 199**: `      <div className="vd-container vd-plan-inner">` means opening a generic layout container (div).
*   **Line 200**: `        <h2 className="vd-plan-title">{t('home', 'planTitle')}</h2>` means displaying a formatted heading title.
*   **Line 201**: `        <div className="vd-plan-card">` means opening a generic layout container (div).
*   **Line 202**: `          <div className="vd-widgets-row">` means opening a generic layout container (div).
*   **Line 203**: `            <TripoliClock` means executing standard component logic or rendering a nested HTML element.
*   **Line 204**: `              title={t('home', 'tripoliClockLabel')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 205**: `              condition={t('home', 'tripoliClockCondition')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 206**: `              locale={lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-FR' : 'en-GB'}` means executing standard component logic or rendering a nested HTML element.
*   **Line 207**: `              dateLabel={t('home', 'tripoliClockDate')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 208**: `              timezoneLabel={t('home', 'tripoliClockTimezone')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 209**: `            />` means executing standard component logic or rendering a nested HTML element.
*   **Line 210**: `            <WeatherTripoli` means executing standard component logic or rendering a nested HTML element.
*   **Line 211**: `              title={t('home', 'weatherInTripoli')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 212**: `              sunriseLabel={t('home', 'weatherSunrise')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 213**: `              sunsetLabel={t('home', 'weatherSunset')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 214**: `              lowLabel={t('home', 'weatherLow')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 215**: `              highLabel={t('home', 'weatherHigh')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 216**: `              humidityLabel={t('home', 'weatherHumidity')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 217**: `              windLabel={t('home', 'weatherWind')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 218**: `              celsiusLabel={t('home', 'weatherCelsius')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 219**: `              fahrenheitLabel={t('home', 'weatherFahrenheit')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 220**: `              t={t}` means executing standard component logic or rendering a nested HTML element.
*   **Line 221**: `            />` means executing standard component logic or rendering a nested HTML element.
*   **Line 222**: `          </div>` means closing the layout container.
*   **Line 223**: `        </div>` means closing the layout container.
*   **Line 224**: `        <p className="vd-plan-text">{t('home', 'planText')}</p>` means opening a text paragraph element.
*   **Line 225**: `        {showMap && (` means executing embedded JavaScript logic within the HTML.
*   **Line 226**: `          <div className="vd-plan-ctas">` means opening a generic layout container (div).
*   **Line 227**: `            <Link to="/map" className="vd-btn vd-btn--primary">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 228**: `              {t('home', 'viewMapCta')}` means executing embedded JavaScript logic within the HTML.
*   **Line 229**: `              <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />` means displaying a custom vector graphic icon.
*   **Line 230**: `            </Link>` means closing the navigation link.
*   **Line 231**: `          </div>` means closing the layout container.
*   **Line 232**: `        )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 233**: `      </div>` means closing the layout container.
*   **Line 234**: `    </section>` means closing the page section.
*   **Line 235**: `  );` means ending the HTML/JSX output block.
*   **Line 236**: `}` means closing the current function or code block.
*   **Line 237**: `` means an empty line for visual spacing.

## `client/src/components/home/BrowseThemesSection.jsx`
*   **Line 1**: `import { Link } from 'react-router-dom';` means importing a necessary component, module, or hook.
*   **Line 2**: `import Icon from '../Icon';` means importing a necessary component, module, or hook.
*   **Line 3**: `import {` means importing a necessary component, module, or hook.
*   **Line 4**: `  WAYS_CONFIG,` means executing standard component logic or rendering a nested HTML element.
*   **Line 5**: `  groupPlacesByWay,` means executing standard component logic or rendering a nested HTML element.
*   **Line 6**: `  countDirectoryCategoriesForWay,` means executing standard component logic or rendering a nested HTML element.
*   **Line 7**: `  formatFindYourWayThemeTitle,` means executing standard component logic or rendering a nested HTML element.
*   **Line 8**: `} from '../../utils/findYourWayGrouping';` means closing the current function or code block.
*   **Line 9**: `import { discoverSearchUrl } from '../../utils/discoverPaths';` means importing a necessary component, module, or hook.
*   **Line 10**: `` means an empty line for visual spacing.
*   **Line 11**: `/\*\* Latin digits for stat tiles (consistent with mixed-language UI). \*/` means a developer comment explaining the code.
*   **Line 12**: `function formatDirectoryCount(n, lang) {` means defining a local helper function.
*   **Line 13**: `  const safe = Number.isFinite(n) ? Math.max(0, Math.floor(Number(n))) : 0;` means declaring a local variable to store data.
*   **Line 14**: `  const locale = lang === 'fr' ? 'fr' : 'en';` means declaring a local variable to store data.
*   **Line 15**: `  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(safe);` means returning a computed value from the function.
*   **Line 16**: `}` means closing the current function or code block.
*   **Line 17**: `` means an empty line for visual spacing.
*   **Line 18**: `/\*\* How many distinct directory categories appear in a theme bucket (via listing metadata). \*/` means a developer comment explaining the code.
*   **Line 19**: `function themeCategoryStats(bucket, categories) {` means defining a local helper function.
*   **Line 20**: `  const ids = new Set();` means declaring a local variable to store data.
*   **Line 21**: `  for (const p of bucket || []) {` means executing standard component logic or rendering a nested HTML element.
*   **Line 22**: `    const id = p.categoryId ?? p.category_id;` means declaring a local variable to store data.
*   **Line 23**: `    if (id != null) ids.add(String(id));` means checking a specific logic condition before proceeding.
*   **Line 24**: `  }` means closing the current function or code block.
*   **Line 25**: `  const known = new Set((categories || []).map((c) => String(c.id)));` means declaring a local variable to store data.
*   **Line 26**: `  let resolved = 0;` means declaring a local variable to store data.
*   **Line 27**: `  ids.forEach((id) => {` means executing standard component logic or rendering a nested HTML element.
*   **Line 28**: `    if (known.has(id)) resolved += 1;` means checking a specific logic condition before proceeding.
*   **Line 29**: `  });` means closing the current function or code block.
*   **Line 30**: `  return { categoryCount: resolved, listingCount: (bucket || []).length };` means returning a computed value from the function.
*   **Line 31**: `}` means closing the current function or code block.
*   **Line 32**: `` means an empty line for visual spacing.
*   **Line 33**: `export default function BrowseThemesSection({` means defining and exporting the main React component.
*   **Line 34**: `  t,` means executing standard component logic or rendering a nested HTML element.
*   **Line 35**: `  lang,` means executing standard component logic or rendering a nested HTML element.
*   **Line 36**: `  places = [],` means executing standard component logic or rendering a nested HTML element.
*   **Line 37**: `  categories = [],` means executing standard component logic or rendering a nested HTML element.
*   **Line 38**: `}) {` means closing the current function or code block.
*   **Line 39**: `  const safeT = (ns, key) => (t && typeof t === 'function' ? t(ns, key) : key);` means declaring a local variable to store data.
*   **Line 40**: `  const placesByWay = groupPlacesByWay(places, categories);` means declaring a local variable to store data.
*   **Line 41**: `  const stepClass = ['vd-find-your-way-row--a', 'vd-find-your-way-row--b', 'vd-find-your-way-row--c', 'vd-find-your-way-row--d'];` means declaring a local variable to store data.
*   **Line 42**: `  ` means an empty line for visual spacing.
*   **Line 43**: `  return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 44**: `    <section` means opening a major semantic page section.
*   **Line 45**: `      id="experience"` means executing standard component logic or rendering a nested HTML element.
*   **Line 46**: `      className="vd-section vd-experience-tripoli vd-find-your-way vd-find-your-way--deck vd-find-your-way--map-themes"` means applying specific CSS styling classes to the element.
*   **Line 47**: `      aria-labelledby="browse-map-themes-title"` means executing standard component logic or rendering a nested HTML element.
*   **Line 48**: `    >` means executing standard component logic or rendering a nested HTML element.
*   **Line 49**: `      <div className="vd-container">` means opening a generic layout container (div).
*   **Line 50**: `        <header className="vd-find-your-way-header">` means opening a header block for the section.
*   **Line 51**: `          <h2 id="browse-map-themes-title" className="vd-find-your-way-title">` means displaying a formatted heading title.
*   **Line 52**: `            {safeT('home', 'findYourWayThemeDeckLabel')}` means executing embedded JavaScript logic within the HTML.
*   **Line 53**: `          </h2>` means closing the heading element.
*   **Line 54**: `        </header>` means closing the header block.
*   **Line 55**: `` means an empty line for visual spacing.
*   **Line 56**: `        <div className="vd-find-your-way-deck" role="list">` means opening a generic layout container (div).
*   **Line 57**: `          {WAYS_CONFIG.map((way, i) => {` means executing embedded JavaScript logic within the HTML.
*   **Line 58**: `            const bucket = placesByWay.get(way.wayKey) || [];` means declaring a local variable to store data.
*   **Line 59**: `            const { categoryCount: categoriesWithListings, listingCount } = themeCategoryStats(bucket, categories);` means declaring a local variable to store data.
*   **Line 60**: `            const directoryCategoryCount = countDirectoryCategoriesForWay(way.wayKey, categories);` means declaring a local variable to store data.
*   **Line 61**: `            const categoryCount = Math.max(directoryCategoryCount, categoriesWithListings);` means declaring a local variable to store data.
*   **Line 62**: `            const idx = String(i + 1).padStart(2, '0');` means declaring a local variable to store data.
*   **Line 63**: `            const stagger = stepClass[i % stepClass.length];` means declaring a local variable to store data.
*   **Line 64**: `            const asideNumber =` means declaring a local variable to store data.
*   **Line 65**: `              categoryCount > 0` means executing standard component logic or rendering a nested HTML element.
*   **Line 66**: `                ? formatDirectoryCount(categoryCount, lang)` means executing standard component logic or rendering a nested HTML element.
*   **Line 67**: `                : listingCount > 0` means executing standard component logic or rendering a nested HTML element.
*   **Line 68**: `                  ? formatDirectoryCount(listingCount, lang)` means executing standard component logic or rendering a nested HTML element.
*   **Line 69**: `                  : null;` means executing standard component logic or rendering a nested HTML element.
*   **Line 70**: `            const asideLabel =` means declaring a local variable to store data.
*   **Line 71**: `              categoryCount > 0` means executing standard component logic or rendering a nested HTML element.
*   **Line 72**: `                ? safeT('home', 'findYourWayCategoriesUnit')` means executing standard component logic or rendering a nested HTML element.
*   **Line 73**: `                : listingCount > 0` means executing standard component logic or rendering a nested HTML element.
*   **Line 74**: `                  ? safeT('home', 'findYourWayThemeEntriesLabel')` means executing standard component logic or rendering a nested HTML element.
*   **Line 75**: `                  : null;` means executing standard component logic or rendering a nested HTML element.
*   **Line 76**: `            const titleFromCategories = formatFindYourWayThemeTitle(` means declaring a local variable to store data.
*   **Line 77**: `              way.wayKey,` means executing standard component logic or rendering a nested HTML element.
*   **Line 78**: `              categories,` means executing standard component logic or rendering a nested HTML element.
*   **Line 79**: `              lang,` means executing standard component logic or rendering a nested HTML element.
*   **Line 80**: `              (n) => safeT('home', 'findYourWayThemeMore').split('{count}').join(String(n))` means executing standard component logic or rendering a nested HTML element.
*   **Line 81**: `            );` means ending the HTML/JSX output block.
*   **Line 82**: `            const rowTitle = titleFromCategories || safeT('home', way.titleKey);` means declaring a local variable to store data.
*   **Line 83**: `            const discoverTo = way.discoverQ ? discoverSearchUrl(way.discoverQ) : discoverSearchUrl('');` means declaring a local variable to store data.
*   **Line 84**: `            return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 85**: `              <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 86**: `                key={way.wayKey}` means executing standard component logic or rendering a nested HTML element.
*   **Line 87**: `                to={discoverTo}` means executing standard component logic or rendering a nested HTML element.
*   **Line 88**: `                className={'vd-find-your-way-row ${stagger}'}` means applying specific CSS styling classes to the element.
*   **Line 89**: `                role="listitem"` means executing standard component logic or rendering a nested HTML element.
*   **Line 90**: `              >` means executing standard component logic or rendering a nested HTML element.
*   **Line 91**: `                <span className="vd-find-your-way-row-index" aria-hidden="true">` means opening an inline text wrapper (span).
*   **Line 92**: `                  {idx}` means executing embedded JavaScript logic within the HTML.
*   **Line 93**: `                </span>` means closing the inline text wrapper.
*   **Line 94**: `                <span className="vd-find-your-way-row-glyph" aria-hidden="true">` means opening an inline text wrapper (span).
*   **Line 95**: `                  <Icon name={way.icon} size={26} />` means displaying a custom vector graphic icon.
*   **Line 96**: `                </span>` means closing the inline text wrapper.
*   **Line 97**: `                <div className="vd-find-your-way-row-copy">` means opening a generic layout container (div).
*   **Line 98**: `                  <span className="vd-find-your-way-row-theme">{safeT('home', 'findYourWayRowKicker')}</span>` means opening an inline text wrapper (span).
*   **Line 99**: `                  <h3 className="vd-find-your-way-row-title">{rowTitle}</h3>` means displaying a formatted heading title.
*   **Line 100**: `                  <p className="vd-find-your-way-row-desc">{safeT('home', way.descKey)}</p>` means opening a text paragraph element.
*   **Line 101**: `                  <p className="vd-find-your-way-row-detail">{safeT('home', way.detailKey)}</p>` means opening a text paragraph element.
*   **Line 102**: `                </div>` means closing the layout container.
*   **Line 103**: `                <div className="vd-find-your-way-row-aside">` means opening a generic layout container (div).
*   **Line 104**: `                  {asideNumber != null ? (` means executing embedded JavaScript logic within the HTML.
*   **Line 105**: `                    <span className="vd-find-your-way-count">` means opening an inline text wrapper (span).
*   **Line 106**: `                      <strong>{asideNumber}</strong>` means executing standard component logic or rendering a nested HTML element.
*   **Line 107**: `                      <span className="vd-find-your-way-count-label">{asideLabel}</span>` means opening an inline text wrapper (span).
*   **Line 108**: `                    </span>` means closing the inline text wrapper.
*   **Line 109**: `                  ) : (` means executing standard component logic or rendering a nested HTML element.
*   **Line 110**: `                    <span className="vd-find-your-way-count vd-find-your-way-count--empty">` means opening an inline text wrapper (span).
*   **Line 111**: `                      {safeT('home', 'findYourWayComingSoon')}` means executing embedded JavaScript logic within the HTML.
*   **Line 112**: `                    </span>` means closing the inline text wrapper.
*   **Line 113**: `                  )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 114**: `                  <span className="vd-find-your-way-row-chevron" aria-hidden="true">` means opening an inline text wrapper (span).
*   **Line 115**: `                    <Icon name="arrow_forward" size={22} />` means displaying a custom vector graphic icon.
*   **Line 116**: `                  </span>` means closing the inline text wrapper.
*   **Line 117**: `                </div>` means closing the layout container.
*   **Line 118**: `              </Link>` means closing the navigation link.
*   **Line 119**: `            );` means ending the HTML/JSX output block.
*   **Line 120**: `          })}` means closing the current function or code block.
*   **Line 121**: `        </div>` means closing the layout container.
*   **Line 122**: `` means an empty line for visual spacing.
*   **Line 123**: `        <div className="vd-find-your-way-cta-wrap">` means opening a generic layout container (div).
*   **Line 124**: `          <Link to={discoverSearchUrl('')} className="vd-find-your-way-cta">` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 125**: `            {safeT('home', 'seeAllWaysDiscover')}` means executing embedded JavaScript logic within the HTML.
*   **Line 126**: `            <Icon name="arrow_forward" size={20} />` means displaying a custom vector graphic icon.
*   **Line 127**: `          </Link>` means closing the navigation link.
*   **Line 128**: `        </div>` means closing the layout container.
*   **Line 129**: `      </div>` means closing the layout container.
*   **Line 130**: `    </section>` means closing the page section.
*   **Line 131**: `  );` means ending the HTML/JSX output block.
*   **Line 132**: `}` means closing the current function or code block.
*   **Line 133**: `` means an empty line for visual spacing.

## `client/src/components/Layout.jsx`
*   **Line 1**: `import { useState, useEffect, useRef } from 'react';` means importing a necessary component, module, or hook.
*   **Line 2**: `import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';` means importing a necessary component, module, or hook.
*   **Line 3**: `import { useAuth } from '../context/AuthContext';` means importing a necessary component, module, or hook.
*   **Line 4**: `import { useLanguage } from '../context/LanguageContext';` means importing a necessary component, module, or hook.
*   **Line 5**: `import { useToast } from '../context/ToastContext';` means importing a necessary component, module, or hook.
*   **Line 6**: `import { useSiteSettings } from '../context/SiteSettingsContext';` means importing a necessary component, module, or hook.
*   **Line 7**: `import Icon from './Icon';` means importing a necessary component, module, or hook.
*   **Line 8**: `import GlobalSearchBar from './GlobalSearchBar';` means importing a necessary component, module, or hook.
*   **Line 9**: `import BackToTop from './BackToTop';` means importing a necessary component, module, or hook.
*   **Line 10**: `import { COMMUNITY_PATH, PLACES_DISCOVER_PATH } from '../utils/discoverPaths';` means importing a necessary component, module, or hook.
*   **Line 11**: `import './css/Layout.css';` means importing a necessary component, module, or hook.
*   **Line 12**: `` means an empty line for visual spacing.
*   **Line 13**: `const langLabels = { en: 'EN', ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', fr: 'FR' };` means declaring a local variable to store data.
*   **Line 14**: `const AI_BANNER_DISMISSED_KEY = 'tripoli_ai_banner_dismissed';` means declaring a local variable to store data.
*   **Line 15**: `` means an empty line for visual spacing.
*   **Line 16**: `export default function Layout() {` means defining and exporting the main React component.
*   **Line 17**: `  const { user, logout } = useAuth();` means declaring a local variable to store data.
*   **Line 18**: `  const { lang, setLanguage, t } = useLanguage();` means declaring a local variable to store data.
*   **Line 19**: `  const { showToast } = useToast();` means declaring a local variable to store data.
*   **Line 20**: `  const { settings } = useSiteSettings();` means declaring a local variable to store data.
*   **Line 21**: `  const navigate = useNavigate();` means declaring a local variable to store data.
*   **Line 22**: `  const location = useLocation();` means declaring a local variable to store data.
*   **Line 23**: `  const [menuOpen, setMenuOpen] = useState(false);` means initializing a React state variable to track data changes.
*   **Line 24**: `  const [langOpen, setLangOpen] = useState(false);` means initializing a React state variable to track data changes.
*   **Line 25**: `  const [aiBannerDismissed, setAiBannerDismissed] = useState(() => {` means initializing a React state variable to track data changes.
*   **Line 26**: `    try {` means executing standard component logic or rendering a nested HTML element.
*   **Line 27**: `      return localStorage.getItem(AI_BANNER_DISMISSED_KEY) === '1';` means returning a computed value from the function.
*   **Line 28**: `    } catch {` means closing the current function or code block.
*   **Line 29**: `      return false;` means returning a computed value from the function.
*   **Line 30**: `    }` means closing the current function or code block.
*   **Line 31**: `  });` means closing the current function or code block.
*   **Line 32**: `  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);` means initializing a React state variable to track data changes.
*   **Line 33**: `  /\*\* One-time banner after email verification (set from VerifyEmail via sessionStorage). \*/` means a developer comment explaining the code.
*   **Line 34**: `  const [verifyWelcomeBanner, setVerifyWelcomeBanner] = useState(null);` means initializing a React state variable to track data changes.
*   **Line 35**: `  const langRef = useRef(null);` means declaring a local variable to store data.
*   **Line 36**: `  const langDrawerRef = useRef(null);` means declaring a local variable to store data.
*   **Line 37**: `  const isHome = location.pathname === '/';` means declaring a local variable to store data.
*   **Line 38**: `  const isActivitiesHub = location.pathname === '/activities';` means declaring a local variable to store data.
*   **Line 39**: `  const navActivitiesHubActive = isActivitiesHub;` means declaring a local variable to store data.
*   **Line 40**: `  const isPlan = location.pathname === '/plan';` means declaring a local variable to store data.
*   **Line 41**: `  const isCommunityHub =` means declaring a local variable to store data.
*   **Line 42**: `    location.pathname === COMMUNITY_PATH || location.pathname.startsWith('${COMMUNITY_PATH}/');` means executing standard component logic or rendering a nested HTML element.
*   **Line 43**: `  const isMapPage = location.pathname === '/map';` means declaring a local variable to store data.
*   **Line 44**: `  const isTripsPage = location.pathname === '/trips' || location.pathname.startsWith('/trips/');` means declaring a local variable to store data.
*   **Line 45**: `  const isPlaceDiscoverPage =` means declaring a local variable to store data.
*   **Line 46**: `    location.pathname === PLACES_DISCOVER_PATH || location.pathname.startsWith('${PLACES_DISCOVER_PATH}/');` means executing standard component logic or rendering a nested HTML element.
*   **Line 47**: `  const isAboutTripoliPage = location.pathname === '/about-tripoli';` means declaring a local variable to store data.
*   **Line 48**: `  const handleLogout = () => {` means declaring a local variable to store data.
*   **Line 49**: `    logout();` means executing standard component logic or rendering a nested HTML element.
*   **Line 50**: `    setMenuOpen(false);` means executing standard component logic or rendering a nested HTML element.
*   **Line 51**: `    showToast(t('feedback', 'signedOut'), 'info');` means executing standard component logic or rendering a nested HTML element.
*   **Line 52**: `    navigate('/');` means executing standard component logic or rendering a nested HTML element.
*   **Line 53**: `  };` means closing the current function or code block.
*   **Line 54**: `` means an empty line for visual spacing.
*   **Line 55**: `  const closeMenu = () => {` means declaring a local variable to store data.
*   **Line 56**: `    setMenuOpen(false);` means executing standard component logic or rendering a nested HTML element.
*   **Line 57**: `  };` means closing the current function or code block.
*   **Line 58**: `` means an empty line for visual spacing.
*   **Line 59**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 60**: `    if (!langOpen) return;` means checking a specific logic condition before proceeding.
*   **Line 61**: `    const close = (e) => {` means declaring a local variable to store data.
*   **Line 62**: `      const inDesktop = langRef.current && langRef.current.contains(e.target);` means declaring a local variable to store data.
*   **Line 63**: `      const inDrawer = langDrawerRef.current && langDrawerRef.current.contains(e.target);` means declaring a local variable to store data.
*   **Line 64**: `      if (!inDesktop && !inDrawer) setLangOpen(false);` means checking a specific logic condition before proceeding.
*   **Line 65**: `    };` means closing the current function or code block.
*   **Line 66**: `    document.addEventListener('click', close);` means executing standard component logic or rendering a nested HTML element.
*   **Line 67**: `    return () => document.removeEventListener('click', close);` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 68**: `  }, [langOpen]);` means closing the current function or code block.
*   **Line 69**: `` means an empty line for visual spacing.
*   **Line 70**: `  /\* Tablet / collapsed header: keep page from scrolling behind the drawer \*/` means a developer comment explaining the code.
*   **Line 71**: `  const lockScroll = menuOpen || mobileSearchOpen;` means declaring a local variable to store data.
*   **Line 72**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 73**: `    if (!lockScroll) return;` means checking a specific logic condition before proceeding.
*   **Line 74**: `    const prev = document.body.style.overflow;` means declaring a local variable to store data.
*   **Line 75**: `    document.body.style.overflow = 'hidden';` means executing standard component logic or rendering a nested HTML element.
*   **Line 76**: `    return () => {` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 77**: `      document.body.style.overflow = prev;` means executing standard component logic or rendering a nested HTML element.
*   **Line 78**: `    };` means closing the current function or code block.
*   **Line 79**: `  }, [lockScroll]);` means closing the current function or code block.
*   **Line 80**: `` means an empty line for visual spacing.
*   **Line 81**: `  useEffect(() => {` means setting up a React side-effect hook that runs automatically (e.g., fetching data or listening to events).
*   **Line 82**: `    if (!user) return;` means checking a specific logic condition before proceeding.
*   **Line 83**: `    try {` means executing standard component logic or rendering a nested HTML element.
*   **Line 84**: `      const raw = sessionStorage.getItem('tripoli-welcome-after-verify');` means declaring a local variable to store data.
*   **Line 85**: `      if (!raw) return;` means checking a specific logic condition before proceeding.
*   **Line 86**: `      sessionStorage.removeItem('tripoli-welcome-after-verify');` means executing standard component logic or rendering a nested HTML element.
*   **Line 87**: `      const data = JSON.parse(raw);` means declaring a local variable to store data.
*   **Line 88**: `      if (!data || typeof data.at !== 'number' || Date.now() - data.at > 120000) return;` means checking a specific logic condition before proceeding.
*   **Line 89**: `      setVerifyWelcomeBanner({` means executing standard component logic or rendering a nested HTML element.
*   **Line 90**: `        name: (data.name && String(data.name).trim()) || user.name || 'there',` means executing standard component logic or rendering a nested HTML element.
*   **Line 91**: `        emailSent: data.welcomeEmailSent === true,` means executing standard component logic or rendering a nested HTML element.
*   **Line 92**: `      });` means closing the current function or code block.
*   **Line 93**: `    } catch {` means closing the current function or code block.
*   **Line 94**: `      /\* ignore \*/` means a developer comment explaining the code.
*   **Line 95**: `    }` means closing the current function or code block.
*   **Line 96**: `  }, [user?.id]);` means closing the current function or code block.
*   **Line 97**: `` means an empty line for visual spacing.
*   **Line 98**: `  return (` means starting the HTML/JSX output that will be rendered to the screen.
*   **Line 99**: `    <div className="layout">` means opening a generic layout container (div).
*   **Line 100**: `      <header id="site-header" className={'header header--vd ${menuOpen ? 'menu-open' : ''}'}>` means opening a header block for the section.
*   **Line 101**: `        <div className="header-inner">` means opening a generic layout container (div).
*   **Line 102**: `          <div className="header-row header-row--main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>` means opening a generic layout container (div).
*   **Line 103**: `            <button` means rendering a clickable button element.
*   **Line 104**: `              type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 105**: `              className="nav-toggle"` means applying specific CSS styling classes to the element.
*   **Line 106**: `              onClick={() => setMenuOpen((o) => !o)}` means attaching a click-event listener to handle user interaction.
*   **Line 107**: `              aria-label={menuOpen ? t('nav', 'closeMenu') : t('nav', 'openMenu')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 108**: `              aria-expanded={menuOpen}` means executing standard component logic or rendering a nested HTML element.
*   **Line 109**: `            >` means executing standard component logic or rendering a nested HTML element.
*   **Line 110**: `              <span className="nav-toggle-bar" />` means opening an inline text wrapper (span).
*   **Line 111**: `              <span className="nav-toggle-bar" />` means opening an inline text wrapper (span).
*   **Line 112**: `              <span className="nav-toggle-bar" />` means opening an inline text wrapper (span).
*   **Line 113**: `            </button>` means closing the button element.
*   **Line 114**: `` means an empty line for visual spacing.
*   **Line 115**: `            <Link to="/" className="logo-wrap" onClick={closeMenu}>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 116**: `              <span className="logo-stack">` means opening an inline text wrapper (span).
*   **Line 117**: `                <span className="logo-mark" aria-hidden="true">` means opening an inline text wrapper (span).
*   **Line 118**: `                  <img src="/tripoli-lebanon-icon.svg" alt="" className="header-emblem-icon" width="40" height="40" />` means rendering an image graphic onto the page.
*   **Line 119**: `                </span>` means closing the inline text wrapper.
*   **Line 120**: `                <span className="logo">{settings.siteName?.trim() || t('nav', 'visitTripoli')}</span>` means opening an inline text wrapper (span).
*   **Line 121**: `              </span>` means closing the inline text wrapper.
*   **Line 122**: `              <span className="logo-tagline logo-tagline--brand">{t('nav', 'navBrandTagline')}</span>` means opening an inline text wrapper (span).
*   **Line 123**: `            </Link>` means closing the navigation link.
*   **Line 124**: `` means an empty line for visual spacing.
*   **Line 125**: `            <div className="header-mobile-right">` means opening a generic layout container (div).
*   **Line 126**: `              <button` means rendering a clickable button element.
*   **Line 127**: `                type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 128**: `                className="nav-icon nav-icon--search"` means applying specific CSS styling classes to the element.
*   **Line 129**: `                onClick={() => {` means attaching a click-event listener to handle user interaction.
*   **Line 130**: `                  setMobileSearchOpen(true);` means executing standard component logic or rendering a nested HTML element.
*   **Line 131**: `                  closeMenu();` means executing standard component logic or rendering a nested HTML element.
*   **Line 132**: `                }}` means closing the current function or code block.
*   **Line 133**: `                aria-label={t('nav', 'search')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 134**: `                aria-expanded={mobileSearchOpen}` means executing standard component logic or rendering a nested HTML element.
*   **Line 135**: `              >` means executing standard component logic or rendering a nested HTML element.
*   **Line 136**: `                <Icon name="search" size={22} />` means displaying a custom vector graphic icon.
*   **Line 137**: `              </button>` means closing the button element.
*   **Line 138**: `              <Link to="/favourites" className="nav-icon" onClick={closeMenu} aria-label={t('nav', 'myFavourites')}><Icon name="favorite" size={22} /></Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 139**: `              {user ? (` means executing embedded JavaScript logic within the HTML.
*   **Line 140**: `                <Link to="/profile" className="nav-icon nav-icon--profile" onClick={closeMenu} aria-label={t('nav', 'profile')}><Icon name="person" size={22} /></Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 141**: `              ) : (` means executing standard component logic or rendering a nested HTML element.
*   **Line 142**: `                <Link to="/login" className="nav-icon nav-icon--profile" onClick={closeMenu} aria-label={t('nav', 'signIn')}><Icon name="person" size={22} /></Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 143**: `              )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 144**: `            </div>` means closing the layout container.
*   **Line 145**: `            <div style={{ flex: 1 }} aria-hidden="true" />` means opening a generic layout container (div).
*   **Line 146**: `            ` means an empty line for visual spacing.
*   **Line 147**: `            <nav className={'nav nav--vd nav--main ${menuOpen ? 'nav-open' : ''}'}>` means executing standard component logic or rendering a nested HTML element.
*   **Line 148**: `              <Link to="/" className={'nav-link nav-link--home ${isHome ? 'nav-link--active' : ''}'} onClick={closeMenu}>{t('nav', 'home')}</Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 149**: `              <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 150**: `                to={PLACES_DISCOVER_PATH}` means executing standard component logic or rendering a nested HTML element.
*   **Line 151**: `                className={'nav-link ${isPlaceDiscoverPage ? 'nav-link--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 152**: `                onClick={closeMenu}` means attaching a click-event listener to handle user interaction.
*   **Line 153**: `              >` means executing standard component logic or rendering a nested HTML element.
*   **Line 154**: `                {t('nav', 'discoverPlaces')}` means executing embedded JavaScript logic within the HTML.
*   **Line 155**: `              </Link>` means closing the navigation link.
*   **Line 156**: `              <Link to="/map" className={'nav-link ${isMapPage ? 'nav-link--active' : ''}'} onClick={closeMenu}>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 157**: `                {t('nav', 'viewMapNav')}` means executing embedded JavaScript logic within the HTML.
*   **Line 158**: `              </Link>` means closing the navigation link.
*   **Line 159**: `              <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 160**: `                to={COMMUNITY_PATH}` means executing standard component logic or rendering a nested HTML element.
*   **Line 161**: `                className={'nav-link ${isCommunityHub ? 'nav-link--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 162**: `                onClick={closeMenu}` means attaching a click-event listener to handle user interaction.
*   **Line 163**: `              >` means executing standard component logic or rendering a nested HTML element.
*   **Line 164**: `                {t('nav', 'communityFeed')}` means executing embedded JavaScript logic within the HTML.
*   **Line 165**: `              </Link>` means closing the navigation link.
*   **Line 166**: `              <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 167**: `                to="/activities"` means executing standard component logic or rendering a nested HTML element.
*   **Line 168**: `                className={'nav-link ${navActivitiesHubActive ? 'nav-link--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 169**: `                onClick={closeMenu}` means attaching a click-event listener to handle user interaction.
*   **Line 170**: `              >` means executing standard component logic or rendering a nested HTML element.
*   **Line 171**: `                {t('nav', 'activitiesHubNav')}` means executing embedded JavaScript logic within the HTML.
*   **Line 172**: `              </Link>` means closing the navigation link.
*   **Line 173**: `              <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 174**: `                to="/about-tripoli"` means executing standard component logic or rendering a nested HTML element.
*   **Line 175**: `                className={'nav-link ${isAboutTripoliPage ? 'nav-link--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 176**: `                onClick={closeMenu}` means attaching a click-event listener to handle user interaction.
*   **Line 177**: `              >` means executing standard component logic or rendering a nested HTML element.
*   **Line 178**: `                {t('nav', 'megaAboutTripoli')}` means executing embedded JavaScript logic within the HTML.
*   **Line 179**: `              </Link>` means closing the navigation link.
*   **Line 180**: `              <Link to="/plan" className={'nav-link nav-link--plan ${isPlan ? 'nav-link--active' : ''}'} onClick={closeMenu}>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 181**: `                {t('nav', 'planYourVisit')}` means executing embedded JavaScript logic within the HTML.
*   **Line 182**: `              </Link>` means closing the navigation link.
*   **Line 183**: `            </nav>` means executing standard component logic or rendering a nested HTML element.
*   **Line 184**: `` means an empty line for visual spacing.
*   **Line 185**: `            <div className="header-meta">` means opening a generic layout container (div).
*   **Line 186**: `              <div className={'nav-lang-wrap ${langOpen ? 'nav-lang-wrap--open' : ''}'} ref={langRef}>` means opening a generic layout container (div).
*   **Line 187**: `                <button` means rendering a clickable button element.
*   **Line 188**: `                  type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 189**: `                  className="nav-lang-trigger"` means applying specific CSS styling classes to the element.
*   **Line 190**: `                  onClick={() => setLangOpen((o) => !o)}` means attaching a click-event listener to handle user interaction.
*   **Line 191**: `                  aria-haspopup="listbox"` means executing standard component logic or rendering a nested HTML element.
*   **Line 192**: `                  aria-expanded={langOpen}` means executing standard component logic or rendering a nested HTML element.
*   **Line 193**: `                  aria-label={t('nav', 'languageSelect')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 194**: `                >` means executing standard component logic or rendering a nested HTML element.
*   **Line 195**: `                  <span className="nav-lang-label">{langLabels[lang] || lang.toUpperCase()}</span>` means opening an inline text wrapper (span).
*   **Line 196**: `                  <Icon name="expand_more" className="nav-chevron" size={20} />` means displaying a custom vector graphic icon.
*   **Line 197**: `                </button>` means closing the button element.
*   **Line 198**: `                {langOpen && (` means executing embedded JavaScript logic within the HTML.
*   **Line 199**: `                  <ul className="nav-lang-dropdown" role="listbox">` means executing standard component logic or rendering a nested HTML element.
*   **Line 200**: `                    {['en', 'ar', 'fr'].map((code) => (` means executing embedded JavaScript logic within the HTML.
*   **Line 201**: `                      <li key={code} role="option" aria-selected={lang === code}>` means executing standard component logic or rendering a nested HTML element.
*   **Line 202**: `                        <button` means rendering a clickable button element.
*   **Line 203**: `                          type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 204**: `                          className={'nav-lang-option ${lang === code ? 'nav-lang-option--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 205**: `                          onClick={() => {` means attaching a click-event listener to handle user interaction.
*   **Line 206**: `                           setLanguage(code);` means executing standard component logic or rendering a nested HTML element.
*   **Line 207**: `                           setLangOpen(false);` means executing standard component logic or rendering a nested HTML element.
*   **Line 208**: `                           closeMenu();` means executing standard component logic or rendering a nested HTML element.
*   **Line 209**: `                           showToast(t('feedback', 'languageChanged'), 'success');` means executing standard component logic or rendering a nested HTML element.
*   **Line 210**: `                         }}` means closing the current function or code block.
*   **Line 211**: `                        >` means executing standard component logic or rendering a nested HTML element.
*   **Line 212**: `                          {code === 'en' ? 'English' : code === 'ar' ? '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'Fran\u00e7ais'}` means executing embedded JavaScript logic within the HTML.
*   **Line 213**: `                        </button>` means closing the button element.
*   **Line 214**: `                      </li>` means executing standard component logic or rendering a nested HTML element.
*   **Line 215**: `                    ))}` means executing standard component logic or rendering a nested HTML element.
*   **Line 216**: `                  </ul>` means executing standard component logic or rendering a nested HTML element.
*   **Line 217**: `                )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 218**: `              </div>` means closing the layout container.
*   **Line 219**: `            </div>` means closing the layout container.
*   **Line 220**: `          </div>` means closing the layout container.
*   **Line 221**: `` means an empty line for visual spacing.
*   **Line 222**: `          {/\* Row 2: global search (desktop), favourites, profile / sign in, sign up \*/}` means executing embedded JavaScript logic within the HTML.
*   **Line 223**: `          <div className="header-row header-row--secondary">` means opening a generic layout container (div).
*   **Line 224**: `            <div className="header-search-slot header-search-slot--desktop">` means opening a generic layout container (div).
*   **Line 225**: `              <GlobalSearchBar idPrefix="header-search" onPick={closeMenu} />` means executing standard component logic or rendering a nested HTML element.
*   **Line 226**: `            </div>` means closing the layout container.
*   **Line 227**: `            <div className="header-row--secondary-actions">` means opening a generic layout container (div).
*   **Line 228**: `            <Link to="/favourites" className="nav-icon" onClick={closeMenu} aria-label={t('nav', 'myFavourites')}><Icon name="favorite" size={22} /></Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 229**: `            {user ? (` means executing embedded JavaScript logic within the HTML.
*   **Line 230**: `              <>` means executing standard component logic or rendering a nested HTML element.
*   **Line 231**: `                {user.isAdmin && (` means executing embedded JavaScript logic within the HTML.
*   **Line 232**: `                  <Link to="/admin" className="nav-link nav-link--auth" onClick={closeMenu}>{t('nav', 'admin')}</Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 233**: `                )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 234**: `                {user && (user.isBusinessOwner || (user.ownedPlaceCount ?? 0) > 0) && (` means executing embedded JavaScript logic within the HTML.
*   **Line 235**: `                  <Link to="/business" className="nav-link nav-link--auth" onClick={closeMenu}>{t('nav', 'myBusiness')}</Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 236**: `                )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 237**: `                <Link to="/messages" className="nav-link nav-link--auth" onClick={closeMenu}>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 238**: `                  {t('nav', 'venueMessages')}` means executing embedded JavaScript logic within the HTML.
*   **Line 239**: `                </Link>` means closing the navigation link.
*   **Line 240**: `                <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 241**: `                  to="/trips"` means executing standard component logic or rendering a nested HTML element.
*   **Line 242**: `                  className={'nav-link nav-link--auth ${isTripsPage ? 'nav-link--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 243**: `                  onClick={closeMenu}` means attaching a click-event listener to handle user interaction.
*   **Line 244**: `                >` means executing standard component logic or rendering a nested HTML element.
*   **Line 245**: `                  {t('nav', 'myTrips')}` means executing embedded JavaScript logic within the HTML.
*   **Line 246**: `                </Link>` means closing the navigation link.
*   **Line 247**: `                <Link to="/profile" className="nav-link nav-link--auth" onClick={closeMenu}>{user.name || t('nav', 'profile')}</Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 248**: `                <button type="button" className="btn-outline btn-sm btn-vd" onClick={handleLogout}>{t('nav', 'logOut')}</button>` means rendering a clickable button element.
*   **Line 249**: `              </>` means executing standard component logic or rendering a nested HTML element.
*   **Line 250**: `            ) : (` means executing standard component logic or rendering a nested HTML element.
*   **Line 251**: `              <>` means executing standard component logic or rendering a nested HTML element.
*   **Line 252**: `                <Link to="/login" className="nav-link nav-link--auth" onClick={closeMenu}>{t('nav', 'signIn')}</Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 253**: `                <Link to="/register" className="btn-primary btn-sm btn-vd" onClick={closeMenu}>{t('nav', 'signUp')}</Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 254**: `              </>` means executing standard component logic or rendering a nested HTML element.
*   **Line 255**: `            )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 256**: `            </div>` means closing the layout container.
*   **Line 257**: `          </div>` means closing the layout container.
*   **Line 258**: `        </div>` means closing the layout container.
*   **Line 259**: `` means an empty line for visual spacing.
*   **Line 260**: `        {/\* Mobile drawer: close X, logo/emblem, nav list, Language + Login footer \*/}` means executing embedded JavaScript logic within the HTML.
*   **Line 261**: `        <div className={'header-drawer ${menuOpen ? 'header-drawer--open' : ''}'} aria-hidden={!menuOpen}>` means opening a generic layout container (div).
*   **Line 262**: `          <div className="header-drawer__header">` means opening a generic layout container (div).
*   **Line 263**: `            <button` means rendering a clickable button element.
*   **Line 264**: `              type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 265**: `              className="header-drawer__close"` means applying specific CSS styling classes to the element.
*   **Line 266**: `              onClick={closeMenu}` means attaching a click-event listener to handle user interaction.
*   **Line 267**: `              aria-label={t('nav', 'closeMenu')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 268**: `            >` means executing standard component logic or rendering a nested HTML element.
*   **Line 269**: `              <Icon name="close" size={24} />` means displaying a custom vector graphic icon.
*   **Line 270**: `            </button>` means closing the button element.
*   **Line 271**: `            <div className="header-drawer__brand">` means opening a generic layout container (div).
*   **Line 272**: `              <div className="header-drawer__brand-lockup">` means opening a generic layout container (div).
*   **Line 273**: `                <span className="logo-stack logo-stack--drawer">` means opening an inline text wrapper (span).
*   **Line 274**: `                  <span className="logo-mark" aria-hidden="true">` means opening an inline text wrapper (span).
*   **Line 275**: `                    <img src="/tripoli-lebanon-icon.svg" alt="" className="header-emblem-icon" width="40" height="40" />` means rendering an image graphic onto the page.
*   **Line 276**: `                  </span>` means closing the inline text wrapper.
*   **Line 277**: `                  <span className="header-drawer__title">{settings.siteName?.trim() || t('nav', 'visitTripoli')}</span>` means opening an inline text wrapper (span).
*   **Line 278**: `                </span>` means closing the inline text wrapper.
*   **Line 279**: `                <span className="header-drawer__subtitle header-drawer__subtitle--brand">{t('nav', 'navBrandTagline')}</span>` means opening an inline text wrapper (span).
*   **Line 280**: `              </div>` means closing the layout container.
*   **Line 281**: `            </div>` means closing the layout container.
*   **Line 282**: `          </div>` means closing the layout container.
*   **Line 283**: `          <nav className="nav nav--vd nav--main nav--drawer">` means executing standard component logic or rendering a nested HTML element.
*   **Line 284**: `            <Link to="/" className={'nav-link nav-link--home ${isHome ? 'nav-link--active' : ''}'} onClick={closeMenu}>{t('nav', 'home')}</Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 285**: `            <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 286**: `              to={PLACES_DISCOVER_PATH}` means executing standard component logic or rendering a nested HTML element.
*   **Line 287**: `              className={'nav-link ${isPlaceDiscoverPage ? 'nav-link--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 288**: `              onClick={closeMenu}` means attaching a click-event listener to handle user interaction.
*   **Line 289**: `            >` means executing standard component logic or rendering a nested HTML element.
*   **Line 290**: `              {t('nav', 'discoverPlaces')}` means executing embedded JavaScript logic within the HTML.
*   **Line 291**: `            </Link>` means closing the navigation link.
*   **Line 292**: `            <Link to="/map" className={'nav-link ${isMapPage ? 'nav-link--active' : ''}'} onClick={closeMenu}>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 293**: `              {t('nav', 'viewMapNav')}` means executing embedded JavaScript logic within the HTML.
*   **Line 294**: `            </Link>` means closing the navigation link.
*   **Line 295**: `            <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 296**: `              to={COMMUNITY_PATH}` means executing standard component logic or rendering a nested HTML element.
*   **Line 297**: `              className={'nav-link ${isCommunityHub ? 'nav-link--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 298**: `              onClick={closeMenu}` means attaching a click-event listener to handle user interaction.
*   **Line 299**: `            >` means executing standard component logic or rendering a nested HTML element.
*   **Line 300**: `              {t('nav', 'communityFeed')}` means executing embedded JavaScript logic within the HTML.
*   **Line 301**: `            </Link>` means closing the navigation link.
*   **Line 302**: `            <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 303**: `              to="/activities"` means executing standard component logic or rendering a nested HTML element.
*   **Line 304**: `              className={'nav-link ${navActivitiesHubActive ? 'nav-link--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 305**: `              onClick={closeMenu}` means attaching a click-event listener to handle user interaction.
*   **Line 306**: `            >` means executing standard component logic or rendering a nested HTML element.
*   **Line 307**: `              {t('nav', 'activitiesHubNav')}` means executing embedded JavaScript logic within the HTML.
*   **Line 308**: `            </Link>` means closing the navigation link.
*   **Line 309**: `            <Link` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 310**: `              to="/about-tripoli"` means executing standard component logic or rendering a nested HTML element.
*   **Line 311**: `              className={'nav-link ${isAboutTripoliPage ? 'nav-link--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 312**: `              onClick={closeMenu}` means attaching a click-event listener to handle user interaction.
*   **Line 313**: `            >` means executing standard component logic or rendering a nested HTML element.
*   **Line 314**: `              {t('nav', 'megaAboutTripoli')}` means executing embedded JavaScript logic within the HTML.
*   **Line 315**: `            </Link>` means closing the navigation link.
*   **Line 316**: `            <Link to="/plan" className={'nav-link nav-link--plan ${isPlan ? 'nav-link--active' : ''}'} onClick={closeMenu}>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 317**: `              {t('nav', 'planYourVisit')}` means executing embedded JavaScript logic within the HTML.
*   **Line 318**: `            </Link>` means closing the navigation link.
*   **Line 319**: `            {user ? (` means executing embedded JavaScript logic within the HTML.
*   **Line 320**: `              <Link to="/trips" className={'nav-link ${isTripsPage ? 'nav-link--active' : ''}'} onClick={closeMenu}>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 321**: `                {t('nav', 'myTrips')}` means executing embedded JavaScript logic within the HTML.
*   **Line 322**: `              </Link>` means closing the navigation link.
*   **Line 323**: `            ) : null}` means executing standard component logic or rendering a nested HTML element.
*   **Line 324**: `          </nav>` means executing standard component logic or rendering a nested HTML element.
*   **Line 325**: `          <div className="header-drawer__footer">` means opening a generic layout container (div).
*   **Line 326**: `            <div className={'nav-lang-wrap nav-lang-wrap--drawer ${langOpen ? 'nav-lang-wrap--open' : ''}'} ref={langDrawerRef}>` means opening a generic layout container (div).
*   **Line 327**: `              <button` means rendering a clickable button element.
*   **Line 328**: `                type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 329**: `                className="btn-drawer-footer"` means applying specific CSS styling classes to the element.
*   **Line 330**: `                onClick={() => setLangOpen((o) => !o)}` means attaching a click-event listener to handle user interaction.
*   **Line 331**: `                aria-haspopup="listbox"` means executing standard component logic or rendering a nested HTML element.
*   **Line 332**: `                aria-expanded={langOpen}` means executing standard component logic or rendering a nested HTML element.
*   **Line 333**: `                aria-label="Language"` means executing standard component logic or rendering a nested HTML element.
*   **Line 334**: `              >` means executing standard component logic or rendering a nested HTML element.
*   **Line 335**: `                <span className="nav-lang-label">{langLabels[lang] || lang.toUpperCase()}</span>` means opening an inline text wrapper (span).
*   **Line 336**: `                <Icon name="expand_more" className="nav-chevron" size={20} />` means displaying a custom vector graphic icon.
*   **Line 337**: `              </button>` means closing the button element.
*   **Line 338**: `              {langOpen && (` means executing embedded JavaScript logic within the HTML.
*   **Line 339**: `                <ul className="nav-lang-dropdown nav-lang-dropdown--drawer" role="listbox">` means executing standard component logic or rendering a nested HTML element.
*   **Line 340**: `                  {['en', 'ar', 'fr'].map((code) => (` means executing embedded JavaScript logic within the HTML.
*   **Line 341**: `                    <li key={code} role="option" aria-selected={lang === code}>` means executing standard component logic or rendering a nested HTML element.
*   **Line 342**: `                      <button` means rendering a clickable button element.
*   **Line 343**: `                        type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 344**: `                        className={'nav-lang-option ${lang === code ? 'nav-lang-option--active' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 345**: `                        onClick={() => {` means attaching a click-event listener to handle user interaction.
*   **Line 346**: `                          setLanguage(code);` means executing standard component logic or rendering a nested HTML element.
*   **Line 347**: `                          setLangOpen(false);` means executing standard component logic or rendering a nested HTML element.
*   **Line 348**: `                          closeMenu();` means executing standard component logic or rendering a nested HTML element.
*   **Line 349**: `                          showToast(t('feedback', 'languageChanged'), 'success');` means executing standard component logic or rendering a nested HTML element.
*   **Line 350**: `                        }}` means closing the current function or code block.
*   **Line 351**: `                      >` means executing standard component logic or rendering a nested HTML element.
*   **Line 352**: `                        {code === 'en' ? 'English' : code === 'ar' ? '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'Fran\u00e7ais'}` means executing embedded JavaScript logic within the HTML.
*   **Line 353**: `                      </button>` means closing the button element.
*   **Line 354**: `                    </li>` means executing standard component logic or rendering a nested HTML element.
*   **Line 355**: `                  ))}` means executing standard component logic or rendering a nested HTML element.
*   **Line 356**: `                </ul>` means executing standard component logic or rendering a nested HTML element.
*   **Line 357**: `              )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 358**: `            </div>` means closing the layout container.
*   **Line 359**: `            {user ? (` means executing embedded JavaScript logic within the HTML.
*   **Line 360**: `              <>` means executing standard component logic or rendering a nested HTML element.
*   **Line 361**: `                {user.isAdmin && (` means executing embedded JavaScript logic within the HTML.
*   **Line 362**: `                  <Link to="/admin" className="btn-drawer-footer" onClick={closeMenu}>{t('nav', 'admin')}</Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 363**: `                )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 364**: `                {user && (user.isBusinessOwner || (user.ownedPlaceCount ?? 0) > 0) && (` means executing embedded JavaScript logic within the HTML.
*   **Line 365**: `                  <Link to="/business" className="btn-drawer-footer" onClick={closeMenu}>{t('nav', 'myBusiness')}</Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 366**: `                )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 367**: `                <Link to="/messages" className="btn-drawer-footer" onClick={closeMenu}>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 368**: `                  {t('nav', 'venueMessages')}` means executing embedded JavaScript logic within the HTML.
*   **Line 369**: `                </Link>` means closing the navigation link.
*   **Line 370**: `                <Link to="/profile" className="btn-drawer-footer" onClick={closeMenu}>{user.name || t('nav', 'profile')}</Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 371**: `              </>` means executing standard component logic or rendering a nested HTML element.
*   **Line 372**: `            ) : (` means executing standard component logic or rendering a nested HTML element.
*   **Line 373**: `              <Link to="/login" className="btn-drawer-footer" onClick={closeMenu}>{t('nav', 'signIn')}</Link>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 374**: `            )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 375**: `          </div>` means closing the layout container.
*   **Line 376**: `        </div>` means closing the layout container.
*   **Line 377**: `` means an empty line for visual spacing.
*   **Line 378**: `        {menuOpen && <div className="nav-overlay" onClick={closeMenu} aria-hidden="true" />}` means executing embedded JavaScript logic within the HTML.
*   **Line 379**: `      </header>` means closing the header block.
*   **Line 380**: `` means an empty line for visual spacing.
*   **Line 381**: `      {mobileSearchOpen && (` means executing embedded JavaScript logic within the HTML.
*   **Line 382**: `        <>` means executing standard component logic or rendering a nested HTML element.
*   **Line 383**: `          <div` means opening a generic layout container (div).
*   **Line 384**: `            className="header-search-mobile-backdrop"` means applying specific CSS styling classes to the element.
*   **Line 385**: `            role="presentation"` means executing standard component logic or rendering a nested HTML element.
*   **Line 386**: `            onClick={() => setMobileSearchOpen(false)}` means attaching a click-event listener to handle user interaction.
*   **Line 387**: `            aria-hidden="true"` means executing standard component logic or rendering a nested HTML element.
*   **Line 388**: `          />` means executing standard component logic or rendering a nested HTML element.
*   **Line 389**: `          <div className="header-search-mobile-panel" role="dialog" aria-modal="true" aria-label={t('nav', 'search')}>` means opening a generic layout container (div).
*   **Line 390**: `            <GlobalSearchBar` means executing standard component logic or rendering a nested HTML element.
*   **Line 391**: `              className="global-search-bar--full"` means applying specific CSS styling classes to the element.
*   **Line 392**: `              idPrefix="mobile-search"` means executing standard component logic or rendering a nested HTML element.
*   **Line 393**: `              autoFocus` means executing standard component logic or rendering a nested HTML element.
*   **Line 394**: `              onEscape={() => setMobileSearchOpen(false)}` means executing standard component logic or rendering a nested HTML element.
*   **Line 395**: `              onPick={() => setMobileSearchOpen(false)}` means executing standard component logic or rendering a nested HTML element.
*   **Line 396**: `              endAdornment={` means executing standard component logic or rendering a nested HTML element.
*   **Line 397**: `                <button` means rendering a clickable button element.
*   **Line 398**: `                  type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 399**: `                  className="global-search-bar__sheet-close"` means applying specific CSS styling classes to the element.
*   **Line 400**: `                  onClick={() => setMobileSearchOpen(false)}` means attaching a click-event listener to handle user interaction.
*   **Line 401**: `                  aria-label={t('placeDiscover', 'modalClose')}` means executing standard component logic or rendering a nested HTML element.
*   **Line 402**: `                >` means executing standard component logic or rendering a nested HTML element.
*   **Line 403**: `                  <Icon name="close" size={22} />` means displaying a custom vector graphic icon.
*   **Line 404**: `                </button>` means closing the button element.
*   **Line 405**: `              }` means closing the current function or code block.
*   **Line 406**: `            />` means executing standard component logic or rendering a nested HTML element.
*   **Line 407**: `          </div>` means closing the layout container.
*   **Line 408**: `        </>` means executing standard component logic or rendering a nested HTML element.
*   **Line 409**: `      )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 410**: `` means an empty line for visual spacing.
*   **Line 411**: `      {verifyWelcomeBanner && (` means executing embedded JavaScript logic within the HTML.
*   **Line 412**: `        <div` means opening a generic layout container (div).
*   **Line 413**: `          className="site-settings-banner site-settings-banner--announcement"` means applying specific CSS styling classes to the element.
*   **Line 414**: `          role="status"` means executing standard component logic or rendering a nested HTML element.
*   **Line 415**: `          style={{` means executing standard component logic or rendering a nested HTML element.
*   **Line 416**: `            background: 'linear-gradient(135deg, #14523a 0%, #0d3d2e 100%)',` means executing standard component logic or rendering a nested HTML element.
*   **Line 417**: `            color: '#fff',` means executing standard component logic or rendering a nested HTML element.
*   **Line 418**: `            justifyContent: 'space-between',` means executing standard component logic or rendering a nested HTML element.
*   **Line 419**: `            borderBottom: '1px solid rgba(255,255,255,0.12)',` means executing standard component logic or rendering a nested HTML element.
*   **Line 420**: `          }}` means closing the current function or code block.
*   **Line 421**: `        >` means executing standard component logic or rendering a nested HTML element.
*   **Line 422**: `          <p className="site-settings-banner-text" style={{ color: '#fff', textAlign: 'left', flex: 1 }}>` means opening a text paragraph element.
*   **Line 423**: `            {t('nav', 'welcomeBanner')` means executing embedded JavaScript logic within the HTML.
*   **Line 424**: `              .replace('{siteName}', settings.siteName?.trim() || 'Visit Tripoli')` means executing standard component logic or rendering a nested HTML element.
*   **Line 425**: `              .replace('{name}', verifyWelcomeBanner.name)}` means executing standard component logic or rendering a nested HTML element.
*   **Line 426**: `            {verifyWelcomeBanner.emailSent ? t('nav', 'welcomeBannerEmail') : '.'}` means executing embedded JavaScript logic within the HTML.
*   **Line 427**: `          </p>` means closing the text paragraph.
*   **Line 428**: `          <button` means rendering a clickable button element.
*   **Line 429**: `            type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 430**: `            className="ai-plan-banner-dismiss"` means applying specific CSS styling classes to the element.
*   **Line 431**: `            onClick={() => setVerifyWelcomeBanner(null)}` means attaching a click-event listener to handle user interaction.
*   **Line 432**: `            aria-label="Dismiss welcome message"` means executing standard component logic or rendering a nested HTML element.
*   **Line 433**: `            style={{ color: 'rgba(255,255,255,0.9)', flexShrink: 0 }}` means executing standard component logic or rendering a nested HTML element.
*   **Line 434**: `          >` means executing standard component logic or rendering a nested HTML element.
*   **Line 435**: `            <Icon name="close" size={18} />` means displaying a custom vector graphic icon.
*   **Line 436**: `          </button>` means closing the button element.
*   **Line 437**: `        </div>` means closing the layout container.
*   **Line 438**: `      )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 439**: `` means an empty line for visual spacing.
*   **Line 440**: `      {settings.maintenanceMode && (` means executing embedded JavaScript logic within the HTML.
*   **Line 441**: `        <div className="site-settings-banner site-settings-banner--maintenance" role="status">` means opening a generic layout container (div).
*   **Line 442**: `          <p className="site-settings-banner-text">{t('nav', 'maintenanceMode')}</p>` means opening a text paragraph element.
*   **Line 443**: `        </div>` means closing the layout container.
*   **Line 444**: `      )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 445**: `      {settings.announcementEnabled && settings.announcementText?.trim() && (` means executing embedded JavaScript logic within the HTML.
*   **Line 446**: `        <div className="site-settings-banner site-settings-banner--announcement" role="region" aria-label="Site announcement">` means opening a generic layout container (div).
*   **Line 447**: `          <p className="site-settings-banner-text">{settings.announcementText}</p>` means opening a text paragraph element.
*   **Line 448**: `          {settings.announcementUrl?.trim() ? (` means executing embedded JavaScript logic within the HTML.
*   **Line 449**: `            <a href={settings.announcementUrl} className="site-settings-banner-link" target="_blank" rel="noopener noreferrer">` means executing standard component logic or rendering a nested HTML element.
*   **Line 450**: `              {t('nav', 'learnMore')}` means executing embedded JavaScript logic within the HTML.
*   **Line 451**: `            </a>` means executing standard component logic or rendering a nested HTML element.
*   **Line 452**: `          ) : null}` means executing standard component logic or rendering a nested HTML element.
*   **Line 453**: `        </div>` means closing the layout container.
*   **Line 454**: `      )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 455**: `` means an empty line for visual spacing.
*   **Line 456**: `      {!aiBannerDismissed && settings.aiPlannerEnabled !== false && (` means executing embedded JavaScript logic within the HTML.
*   **Line 457**: `        <div className="ai-plan-banner" role="banner">` means opening a generic layout container (div).
*   **Line 458**: `          <p className="ai-plan-banner-text">{t('nav', 'aiPlanBanner')}</p>` means opening a text paragraph element.
*   **Line 459**: `          <div className="ai-plan-banner-actions">` means opening a generic layout container (div).
*   **Line 460**: `            <Link to="/plan/ai" className="ai-plan-banner-cta" onClick={() => setMenuOpen(false)}>` means creating a clickable React Router link to navigate to another page without a full reload.
*   **Line 461**: `              {t('nav', 'aiPlanBannerCta')}` means executing embedded JavaScript logic within the HTML.
*   **Line 462**: `            </Link>` means closing the navigation link.
*   **Line 463**: `            <button` means rendering a clickable button element.
*   **Line 464**: `              type="button"` means executing standard component logic or rendering a nested HTML element.
*   **Line 465**: `              className="ai-plan-banner-dismiss"` means applying specific CSS styling classes to the element.
*   **Line 466**: `              onClick={() => {` means attaching a click-event listener to handle user interaction.
*   **Line 467**: `                try {` means executing standard component logic or rendering a nested HTML element.
*   **Line 468**: `                  localStorage.setItem(AI_BANNER_DISMISSED_KEY, '1');` means executing standard component logic or rendering a nested HTML element.
*   **Line 469**: `                } catch {` means closing the current function or code block.
*   **Line 470**: `                  /\* ignore quota / private mode \*/` means a developer comment explaining the code.
*   **Line 471**: `                }` means closing the current function or code block.
*   **Line 472**: `                setAiBannerDismissed(true);` means executing standard component logic or rendering a nested HTML element.
*   **Line 473**: `              }}` means closing the current function or code block.
*   **Line 474**: `              aria-label="Dismiss"` means executing standard component logic or rendering a nested HTML element.
*   **Line 475**: `            >` means executing standard component logic or rendering a nested HTML element.
*   **Line 476**: `              <Icon name="close" size={18} />` means displaying a custom vector graphic icon.
*   **Line 477**: `            </button>` means closing the button element.
*   **Line 478**: `          </div>` means closing the layout container.
*   **Line 479**: `        </div>` means closing the layout container.
*   **Line 480**: `      )}` means executing standard component logic or rendering a nested HTML element.
*   **Line 481**: `` means an empty line for visual spacing.
*   **Line 482**: `      <a href="#main-content" className="skip-to-main">` means executing standard component logic or rendering a nested HTML element.
*   **Line 483**: `        {t('nav', 'skipToMain') || 'Skip to main content'}` means executing embedded JavaScript logic within the HTML.
*   **Line 484**: `      </a>` means executing standard component logic or rendering a nested HTML element.
*   **Line 485**: `      <main` means executing standard component logic or rendering a nested HTML element.
*   **Line 486**: `        id="main-content"` means executing standard component logic or rendering a nested HTML element.
*   **Line 487**: `        className={'main ${isHome || isCommunityHub || isMapPage ? 'main--full' : 'main--contained'}${isMapPage ? ' main--map' : ''}'}` means applying specific CSS styling classes to the element.
*   **Line 488**: `        tabIndex={-1}` means executing standard component logic or rendering a nested HTML element.
*   **Line 489**: `      >` means executing standard component logic or rendering a nested HTML element.
*   **Line 490**: `        <Outlet />` means executing standard component logic or rendering a nested HTML element.
*   **Line 491**: `      </main>` means executing standard component logic or rendering a nested HTML element.
*   **Line 492**: `      <BackToTop />` means executing standard component logic or rendering a nested HTML element.
*   **Line 493**: `    </div>` means closing the layout container.
*   **Line 494**: `  );` means ending the HTML/JSX output block.
*   **Line 495**: `}` means closing the current function or code block.
*   **Line 496**: `` means an empty line for visual spacing.
