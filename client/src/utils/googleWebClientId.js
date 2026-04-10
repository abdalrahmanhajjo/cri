/**
 * Read public GIS OAuth web client id from the HTML shell (build-injected meta) or a host-injected global.
 * The value is not secret — the browser exposes it to Google Identity Services anyway.
 */
export function readGoogleWebClientIdFromMeta() {
  if (typeof document === 'undefined') return '';
  try {
    const el = document.querySelector('meta[name="tripoli-google-client-id"]');
    const raw = el?.getAttribute('content');
    if (typeof raw !== 'string') return '';
    const t = raw.trim();
    return t && !t.includes('%VITE_') ? t : '';
  } catch {
    return '';
  }
}

export function readGoogleWebClientIdFromPage() {
  const meta = readGoogleWebClientIdFromMeta();
  if (meta) return meta;
  try {
    const w = typeof window !== 'undefined' ? window : null;
    const g = w?.TRIPOLI_GOOGLE_CLIENT_ID;
    if (typeof g === 'string' && g.trim()) return g.trim();
  } catch {
    /* ignore */
  }
  return '';
}
