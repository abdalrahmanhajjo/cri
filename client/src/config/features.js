/**
 * Build-time toggles (Vite: set in client/.env, prefix VITE_).
 * Defaults keep current behavior (all on).
 */
function envBool(key, defaultValue = true) {
  const v = import.meta.env[key];
  if (v === undefined || v === '') return defaultValue;
  return v === '1' || v === 'true';
}

export const features = {
  /** Open-Meteo widget on home “Plan your visit” (clock stays). */
  showWeatherWidget: envBool('VITE_FEATURE_WEATHER', true),
  /** Community feed strip on home (still loads feed API when on). */
  showHomeCommunityStrip: envBool('VITE_FEATURE_HOME_COMMUNITY_STRIP', true),
  /** “Community” item in header + related prominence. Route /community still exists if linked directly. */
  showCommunityNav: envBool('VITE_FEATURE_COMMUNITY_NAV', true),
};
