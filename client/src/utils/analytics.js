/**
 * Analytics helper – respects user preference (Profile → Analytics setting).
 * When user.analytics is false, no events are sent.
 * Add your tracking provider (e.g. GA, Plausible) inside trackEvent when ready.
 */

export function getAnalyticsEnabled(user) {
  return user?.analytics !== false;
}

/**
 * Call when an event occurs. No-ops if user has disabled analytics.
 * @param {object|null} user - from useAuth().user
 * @param {string} name - event name (e.g. 'page_view', 'favourite_add')
 * @param {object} [props] - optional event properties
 */
export function trackEvent(user, name, props = {}) {
  if (!getAnalyticsEnabled(user)) return;
  // Add your analytics provider here, e.g.:
  // if (window.gtag) window.gtag('event', name, props);
  // if (window.plausible) window.plausible(name, { props });
  if (import.meta.env.DEV && import.meta.env.MODE === 'development') {
    console.debug('[Analytics]', name, props);
  }
}
