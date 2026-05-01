/**
 * Optional hard-coded Web OAuth client id (same string as server GOOGLE_CLIENT_ID).
 * Use when your host does not inject VITE_GOOGLE_CLIENT_ID at build time and the API
 * does not yet expose googleWebClientId — this id is public (GIS sends it to Google).
 *
 * Prefer: VITE_GOOGLE_CLIENT_ID in CI, or deploy the API with GOOGLE_CLIENT_ID + updated site-settings.
 */
export const FALLBACK_GOOGLE_WEB_CLIENT_ID = '904702521837-eoav388g6ne8ee47sg11rbvhmm6m7fj5.apps.googleusercontent.com';
