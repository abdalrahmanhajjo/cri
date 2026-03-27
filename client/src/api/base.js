/**
 * Base API client logic (Vite)
 */

export function getBaseUrl() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === '' || raw === undefined || raw === null) {
    if (typeof window !== 'undefined') return '';
    return 'http://localhost:3095';
  }
  return String(raw).replace(/\/$/, '');
}

export function fixImageUrlExtension(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/([a-f0-9]{32})(jpe?g|png|gif|webp)$/i, '$1.$2');
}

export function getImageUrlAlternate(url) {
  if (!url || typeof url !== 'string') return null;
  return url.replace(/\.(jpe?g|png|gif|webp)$/i, '$1');
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
  if (u.startsWith('/') && !u.startsWith('//')) return getImageUrl(u);
  if (u && !u.startsWith('//')) return getImageUrl('/' + u);
  return null;
}

export const API_ERROR_NETWORK = 'NETWORK_ERROR';
export const DEFAULT_NETWORK_ERROR_MESSAGE = 'Unable to reach the server. Check your connection and try again.';

const SESSION_CODE_KEY = 'session_code';
const MAX_RETRIES_5XX = 1;
const RETRY_DELAY_MS = 800;
const MAX_NETWORK_RETRIES = 2;
const NETWORK_RETRY_DELAYS_MS = [400, 1000];

export function getToken() { return localStorage.getItem('token'); }
export function setToken(token) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export function getSessionCode() { return localStorage.getItem(SESSION_CODE_KEY); }
export function setSessionCode(code) {
  if (code) localStorage.setItem(SESSION_CODE_KEY, code);
  else localStorage.removeItem(SESSION_CODE_KEY);
}

export function generateSessionCode() {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
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

export function clearAuthStorageAndNotify() {
  setToken(null);
  setStoredUser(null);
  setSessionCode(null);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tripoli:auth-expired'));
}

function isAbortError(e) { return e && (e.name === 'AbortError' || e.code === 20); }
function isNetworkFailure(e) {
  if (!e || isAbortError(e)) return false;
  if (e.name === 'TypeError') return true;
  const m = String(e.message || '');
  return /failed to fetch|networkerror|load failed|network request failed|fetch/i.test(m);
}
function wrapNetworkError(lastErr) {
  const err = new Error(isNetworkFailure(lastErr) ? DEFAULT_NETWORK_ERROR_MESSAGE : lastErr?.message || 'Request failed');
  err.code = isNetworkFailure(lastErr) ? API_ERROR_NETWORK : 'FETCH_ERROR';
  err.cause = lastErr;
  return err;
}
function sleepAbortable(ms, signal) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { resolve(); }, ms);
    const onAbort = () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); };
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function fetchWithNetworkRetry(url, init) {
  let lastErr;
  for (let i = 0; i <= MAX_NETWORK_RETRIES; i += 1) {
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try { return await fetch(url, init); } catch (e) {
      lastErr = e;
      if (isAbortError(e)) throw e;
      if (!isNetworkFailure(e) || i >= MAX_NETWORK_RETRIES) break;
      await sleepAbortable(NETWORK_RETRY_DELAYS_MS[i] ?? 1200, init?.signal);
    }
  }
  throw wrapNetworkError(lastErr);
}

const getRequestCache = new Map();

export async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const token = getToken();
  const authKey = token ? `:${token.slice(-20)}` : ':anon';
  const cacheKey = method === 'GET' ? `${method}:${url}${authKey}` : null;
  if (cacheKey && !options.signal) {
    const cached = getRequestCache.get(cacheKey);
    if (cached) return cached;
  }
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const sc = getSessionCode();
  if (sc) headers['X-Session-Code'] = sc;

  const run = async (retries = MAX_RETRIES_5XX) => {
    const res = await fetchWithNetworkRetry(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if ((res.status === 401 || (res.status === 403 && data.code === 'ACCOUNT_BLOCKED')) && token) clearAuthStorageAndNotify();
      if (res.status >= 500 && retries > 0) { await sleepAbortable(RETRY_DELAY_MS, options.signal); return run(retries - 1); }
      const err = new Error(data.error || res.statusText || 'Request failed');
      err.status = res.status; err.data = data; throw err;
    }
    return data;
  };
  const promise = run().finally(() => { if (cacheKey) getRequestCache.delete(cacheKey); });
  if (cacheKey && !options.signal) getRequestCache.set(cacheKey, promise);
  return promise;
}

export const apiBase = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  upload: async (path, file, additionalFields = {}, opts = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(additionalFields).forEach(([k, v]) => {
      if (v != null) formData.append(k, v);
    });
    const token = getToken();
    const headers = { ...opts.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    const sc = getSessionCode();
    if (sc) headers['X-Session-Code'] = sc;
    const res = await fetchWithNetworkRetry(`${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
      ...opts,
      method: 'POST',
      body: formData,
      headers
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || res.statusText || 'Upload failed');
      err.status = res.status; err.data = data; throw err;
    }
    return data;
  }
};

