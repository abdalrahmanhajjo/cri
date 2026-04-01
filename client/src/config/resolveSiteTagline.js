/**
 * Home hero and footer brand line always follow i18n bundles (not admin site settings).
 * This avoids stale copy stuck in site_settings JSON from overriding shipped translations.
 */

/**
 * @param {unknown} _settings
 * @param {(ns: string, key: string) => string} t
 */
export function resolveHeroTagline(_settings, t) {
  return t('home', 'heroTagline');
}

/**
 * @param {unknown} _settings
 * @param {(ns: string, key: string) => string} t
 */
export function resolveFooterTagline(_settings, t) {
  return t('nav', 'navBrandTagline');
}
