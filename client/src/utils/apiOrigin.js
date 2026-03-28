/**
 * Base URL for API calls (matches logic in api/client.js getBaseUrl).
 * Extracted for modules that must not import the full API client (avoid cycles).
 */
export function getApiOrigin() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === '' || raw === undefined || raw === null) {
    if (typeof window !== 'undefined') return '';
    return 'http://localhost:3000';
  }
  return String(raw).replace(/\/$/, '');
}
