import { siteSettingsDefaults } from './siteSettingsDefaults';

/** Collapse whitespace and curly apostrophes so API values match defaults. */
function normalizeTagline(s) {
  return String(s || '')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Taglines stored in DB before i18n/home copy updates — treat as unset so visitors
 * see current translations (and localized hero), not stale English.
 */
const STALE_SITE_TAGLINES = new Set(
  [
    'Trusted venues in your browser. Conversational trip help stays in the Tripoli app.',
    'Souks historiques, charme maritime et culture authentique. Informations officielles pour planifier votre séjour.',
    'Official tourism information for Tripoli, Lebanon.',
    'Explore Tripoli — places, experiences and events.',
  ].map(normalizeTagline)
);

function normalizedDefault() {
  return normalizeTagline(siteSettingsDefaults.siteTagline);
}

/**
 * @param {{ siteTagline?: string }} settings
 * @param {(ns: string, key: string) => string} t
 */
export function resolveHeroTagline(settings, t) {
  const raw = normalizeTagline(settings.siteTagline);
  const def = normalizedDefault();
  if (!raw || raw === def || STALE_SITE_TAGLINES.has(raw)) {
    return t('home', 'heroTagline');
  }
  return String(settings.siteTagline).trim();
}

/**
 * Footer line under the logo — short brand line when using defaults.
 */
export function resolveFooterTagline(settings, t) {
  const raw = normalizeTagline(settings.siteTagline);
  const def = normalizedDefault();
  if (!raw || raw === def || STALE_SITE_TAGLINES.has(raw)) {
    return t('nav', 'navBrandTagline');
  }
  return String(settings.siteTagline).trim();
}
