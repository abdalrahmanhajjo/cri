import { getApiOrigin } from '../utils/apiOrigin.js';

export function getBaseUrl() {
  return getApiOrigin();
}

/** Fix malformed extension (e.g. xxxjpg -> xxx.jpg) from old upload bug */
export function fixImageUrlExtension(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/([a-f0-9]{32})(jpe?g|png|gif|webp|heic|heif)$/i, '$1.$2');
}

/** Return original-style URL (xxx.jpg -> xxxjpg) for fallback when fixed URL fails */
export function getImageUrlAlternate(url) {
  if (!url || typeof url !== 'string') return null;
  return url.replace(/\.(jpe?g|png|gif|webp|heic|heif)$/i, '$1');
}

/** Resolve image URL - use relative path (proxied in dev) or full URL */
export function getImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  url = fixImageUrlExtension(url);
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const path = url.startsWith('/') ? url : '/' + url;
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    return path;
  }
  const base = getBaseUrl();
  return base + path;
}

/** Safe + resolved image URL for place/event images. Use instead of safeImageUrl when URL may be relative. */
export function getPlaceImageUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  let u = fixImageUrlExtension(url.trim());
  if (/^\s*(javascript|data|vbscript|file):/i.test(u)) return null;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/') && !u.startsWith('//')) return getImageUrl(u);
  if (u && !u.startsWith('//')) return getImageUrl('/' + u);
  return null;
}

const SESSION_CODE_KEY = 'session_code';
const MAX_RETRIES_5XX = 1;
const RETRY_DELAY_MS = 800;

const MAX_NETWORK_RETRIES = 2;
const NETWORK_RETRY_DELAYS_MS = [400, 1000];

export const API_ERROR_NETWORK = 'NETWORK_ERROR';
export const DEFAULT_NETWORK_ERROR_MESSAGE = 'Unable to reach the server. Check your connection and try again.';

const getRequestCache = new Map();

function skipGetDedupeForPath(path) {
  const p = typeof path === 'string' ? path.split('?')[0] : '';
  return p === '/api/user/favourites';
}

function isAbortError(e) {
  return e && (e.name === 'AbortError' || e.code === 20);
}

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
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function fetchWithNetworkRetry(url, init) {
  let lastErr;
  for (let i = 0; i <= MAX_NETWORK_RETRIES; i += 1) {
    const signal = init?.signal;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await fetch(url, init);
    } catch (e) {
      lastErr = e;
      if (isAbortError(e)) throw e;
      if (!isNetworkFailure(e) || i >= MAX_NETWORK_RETRIES) break;
      await sleepAbortable(NETWORK_RETRY_DELAYS_MS[i] ?? 1200, signal);
    }
  }
  throw wrapNetworkError(lastErr);
}

export function getTokenExpiryMs(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const json = atob(b64 + pad);
    const payload = JSON.parse(json);
    if (payload.exp && typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    /* ignore */
  }
  return null;
}

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export function getSessionCode() {
  return localStorage.getItem(SESSION_CODE_KEY);
}

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
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) localStorage.setItem('user', JSON.stringify(user));
  else localStorage.removeItem('user');
}

export function clearAuthStorageAndNotify() {
  setToken(null);
  setStoredUser(null);
  setSessionCode(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('tripoli:auth-expired'));
  }
}

export async function parseStorageUploadResponse(response, token) {
  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      const looksLikeHtml = /^<!DOCTYPE/i.test(raw) || /<html[\s>]/i.test(raw);
      let errMsg = raw.replace(/\s+/g, ' ').trim().slice(0, 240);
      if (looksLikeHtml) {
        errMsg =
          response.status === 502 || response.status === 504
            ? 'The server stopped responding (timeout). Try a smaller file.'
            : `Request failed (${response.status}).`;
      } else if (!errMsg) {
        errMsg = `HTTP ${response.status}`;
      }
      data = { error: errMsg };
    }
  }
  if (!response.ok) {
    if (response.status === 401 && token) clearAuthStorageAndNotify();
    const msg = data.error || 'Upload failed';
    throw new Error(msg);
  }
  if (data.error) throw new Error(String(data.error));
  if (!data.url) throw new Error('Server did not return a file URL.');
  return data.url;
}

export async function requestWithDedupe(path, options = {}) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const method = (options.method || 'GET').toUpperCase();
  const token = getToken();
  const authKey = token ? `:${token.slice(-20)}` : ':anon';
  const useGetDedupe = method === 'GET' && !skipGetDedupeForPath(path) && !options.signal;
  const cacheKey = useGetDedupe ? `${method}:${url}${authKey}` : null;

  if (cacheKey && !options.signal) {
    const cached = getRequestCache.get(cacheKey);
    if (cached) return cached;
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const sessionCode = getSessionCode();
  if (sessionCode) headers['X-Session-Code'] = sessionCode;

  const fetchInit = { ...options, headers, signal: options.signal };
  if (method === 'GET' && skipGetDedupeForPath(path)) fetchInit.cache = 'no-store';

  const run = async (serverRetriesLeft = MAX_RETRIES_5XX) => {
    const res = await fetchWithNetworkRetry(url, fetchInit);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && token) clearAuthStorageAndNotify();
      if (res.status === 403 && token && data.code === 'ACCOUNT_BLOCKED') clearAuthStorageAndNotify();
      if (res.status >= 500 && serverRetriesLeft > 0) {
        await sleepAbortable(RETRY_DELAY_MS, options.signal);
        return run(serverRetriesLeft - 1);
      }
      const err = new Error(data.error || res.statusText || 'Request failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  const promise = run()
    .then((data) => {
      if (cacheKey) getRequestCache.delete(cacheKey);
      return data;
    })
    .catch((err) => {
      if (cacheKey) getRequestCache.delete(cacheKey);
      throw err;
    });

  if (cacheKey && !options.signal) getRequestCache.set(cacheKey, promise);
  return promise;
}

function isMutationPathWithNoRetry(path) {
  const p = typeof path === "string" ? path.split("?")[0] : "";
  return /\/api\/places\/[^/]+\/inquiries(\/|$)/.test(p);
}

export async function requestNoDedupe(path, options = {}, serverRetriesLeft = MAX_RETRIES_5XX) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const sessionCode = getSessionCode();
  if (sessionCode) headers['X-Session-Code'] = sessionCode;

  const fetchInit = { ...options, headers, signal: options.signal };
  const method = (options.method || 'GET').toUpperCase();
  const skipMutationRetry = method === 'POST' && isMutationPathWithNoRetry(path);

  const res = skipMutationRetry ? await fetch(url, fetchInit) : await fetchWithNetworkRetry(url, fetchInit);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) clearAuthStorageAndNotify();
    if (res.status === 403 && token && (data.code === 'ACCOUNT_BLOCKED' || data.code === 'EMAIL_NOT_VERIFIED')) {
      clearAuthStorageAndNotify();
    }
    if (!skipMutationRetry && res.status >= 500 && serverRetriesLeft > 0) {
      await sleepAbortable(RETRY_DELAY_MS, options.signal);
      return requestNoDedupe(path, options, serverRetriesLeft - 1);
    }
    const err = new Error(data.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  if (method === 'GET') return requestWithDedupe(path, options);
  return requestNoDedupe(path, options);
}

export const baseApi = {
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
