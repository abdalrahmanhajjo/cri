/**
 * Base API client logic (Vite)
 */

export function getBaseUrl() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === '' || raw === undefined || raw === null) {
    if (typeof window !== 'undefined') return '';
    return 'http://localhost:3095'; // Updated to match new default
  }
  return String(raw).replace(/\/$/, '');
}

export function fixImageUrlExtension(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/([a-f0-9]{32})(jpe?g|png|gif|webp)$/i, '$1.$2');
}

export function getImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  url = fixImageUrlExtension(url);
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const path = url.startsWith('/') ? url : '/' + url;
  if (typeof window !== 'undefined' && import.meta.env.DEV) return path;
  return getBaseUrl() + path;
}

export function getPlaceImageUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  let u = fixImageUrlExtension(url.trim());
  if (/^\s*(javascript|data|vbscript|file):/i.test(u)) return null;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  return getImageUrl(u.startsWith('/') ? u : '/' + u);
}

// Token & Storage
export function getToken() { return localStorage.getItem('token'); }
export function setToken(token) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export function getSessionCode() { return localStorage.getItem('session_code'); }
export function setSessionCode(code) {
  if (code) localStorage.setItem('session_code', code);
  else localStorage.removeItem('session_code');
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setStoredUser(user) {
  if (user) localStorage.setItem('user', JSON.stringify(user));
  else localStorage.removeItem('user');
}

export function generateSessionCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let res = '';
  for (let i = 0; i < 16; i += 1) res += chars.charAt(Math.floor(Math.random() * chars.length));
  return res;
}

function clearAuthStorageAndNotify() {
  setToken(null);
  setStoredUser(null);
  setSessionCode(null);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tripoli:auth-expired'));
}

// Fetch with Network Retry
const MAX_NETWORK_RETRIES = 2;
const NETWORK_RETRY_DELAYS_MS = [400, 1000];

async function fetchWithNetworkRetry(url, init) {
  let lastErr;
  for (let i = 0; i <= MAX_NETWORK_RETRIES; i += 1) {
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await fetch(url, init);
    } catch (e) {
      lastErr = e;
      if (e.name === 'AbortError') throw e;
      const isNetwork = /failed to fetch|networkerror|load failed|network request failed|fetch/i.test(e.message);
      if (!isNetwork || i >= MAX_NETWORK_RETRIES) break;
      await new Promise(r => setTimeout(r, NETWORK_RETRY_DELAYS_MS[i] || 1000));
    }
  }
  throw lastErr;
}

// Request with Deduplication
const getRequestCache = new Map();

export async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const token = getToken();

  // Deduplication for GET
  const cacheKey = method === 'GET' && !options.signal ? `${method}:${url}:${token?.slice(-20) || 'anon'}` : null;
  if (cacheKey && getRequestCache.has(cacheKey)) return getRequestCache.get(cacheKey);

  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const sc = getSessionCode();
  if (sc) headers['X-Session-Code'] = sc;

  const run = async (retries = 1) => {
    const res = await fetchWithNetworkRetry(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if ((res.status === 401 || (res.status === 403 && data.code === 'ACCOUNT_BLOCKED')) && token) {
        clearAuthStorageAndNotify();
      }
      if (res.status >= 500 && retries > 0) {
        await new Promise(r => setTimeout(r, 800));
        return run(retries - 1);
      }
      const err = new Error(data.error || res.statusText || 'Request failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  const promise = run()
    .finally(() => { if (cacheKey) getRequestCache.delete(cacheKey); });

  if (cacheKey) getRequestCache.set(cacheKey, promise);
  return promise;
}

export const apiBase = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};
