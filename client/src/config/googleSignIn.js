/**
 * Optional hard-coded Web OAuth client id (same string as server GOOGLE_CLIENT_ID).
 * Use when your host does not inject VITE_GOOGLE_CLIENT_ID at build time and the API
 * does not yet expose googleWebClientId — this id is public (GIS sends it to Google).
 *
 * Prefer: VITE_GOOGLE_CLIENT_ID in CI, or deploy the API with GOOGLE_CLIENT_ID + updated site-settings.
 */
export const FALLBACK_GOOGLE_WEB_CLIENT_ID = '242210292228-5v0p7d2u863864c45u57s4t31234c567.apps.googleusercontent.com';
