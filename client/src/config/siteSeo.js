/** Default metadata (fallback when admin site settings have no description). Keep in sync with index.html <title>. */
export const SITE_DEFAULT_TITLE = 'Visit Tripoli – Best spots, experiences & plans';

/** Shown after admin “Site name” in `<title>` when name is custom */
export const SITE_TITLE_SUFFIX = 'Best spots, experiences & plans';

export const SITE_BRAND_NAME = 'Visit Tripoli';

/**
 * ~155 chars — primary Google snippet + og:description baseline.
 * Admin `metaDescription` in site settings overrides at runtime on the home page.
 */
export const SITE_DEFAULT_DESCRIPTION =
  'Discover Tripoli, Lebanon: Old City heritage, souks, food, events, and maps. Plan your visit with places, community feed, and trip tools from the official visitor guide.';

/** Path under `public/`; combined with `VITE_PUBLIC_SITE_URL` for og:image in production builds */
export const SITE_OG_IMAGE_PATH = '/tripoli-lebanon-icon.svg';

export const SITE_THEME_COLOR = '#0D5C55';
