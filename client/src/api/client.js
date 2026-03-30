/**
 * API client for Tripoli Explorer – same backend (Node) and DB as the mobile app.
 * Set VITE_API_URL in .env to your backend (e.g. http://localhost:3000).
 * Features: GET deduplication (in-flight), AbortSignal support,
 * exponential backoff retries for transient network failures, retry for 5xx responses.
 */

import { getApiOrigin } from '../utils/apiOrigin.js';

/**
 * Empty string = same-origin (Vite dev proxy to API). Avoids wrong default port and CORS issues.
 * Set VITE_API_URL (e.g. http://localhost:3000) when calling the API from a different origin.
 */
function getBaseUrl() {
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

/** Extra attempts after the first failed connection (unreliable Wi‑Fi / sleeping tabs). */
const MAX_NETWORK_RETRIES = 2;
/** Backoff between network retries (ms); total attempts = 1 + MAX_NETWORK_RETRIES. */
const NETWORK_RETRY_DELAYS_MS = [400, 1000];

/** Thrown `Error` uses this `code` when the browser reports a network failure (e.g. "Failed to fetch"). */
export const API_ERROR_NETWORK = 'NETWORK_ERROR';

export const DEFAULT_NETWORK_ERROR_MESSAGE =
  'Unable to reach the server. Check your connection and try again.';

/** In-flight GET requests: key = url, value = Promise. Cleared when settled. */
const getRequestCache = new Map();

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

/**
 * Low-level fetch with retries on connection failures (not HTTP error statuses).
 * Respects `signal` (AbortSignal); does not retry after abort.
 */
async function fetchWithNetworkRetry(url, init) {
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

function clearAuthStorageAndNotify() {
  setToken(null);
  setStoredUser(null);
  setSessionCode(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('tripoli:auth-expired'));
  }
}

/** Parse multipart upload response: JSON error or a short snippet from HTML/plain bodies. */
async function parseStorageUploadResponse(response, token) {
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
            ? 'The server stopped responding (often a timeout on large videos). Try a shorter or smaller file, or ask the host to allow reel transcoding only on a larger plan.'
            : `Request failed (${response.status}). The server returned an error page instead of JSON.`;
      } else if (!errMsg) {
        errMsg = `HTTP ${response.status}`;
      }
      data = { error: errMsg };
    }
  }
  if (!response.ok) {
    if (response.status === 401 && token) clearAuthStorageAndNotify();
    const msg =
      (typeof data.error === 'string' && data.error) ||
      (response.status === 413 ? 'File too large for this server.' : '') ||
      (response.status === 502 ? 'Storage unavailable. Try a smaller file or again later.' : '') ||
      response.statusText ||
      'Upload failed';
    throw new Error(msg);
  }
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : 'Upload failed');
  const url = data.url || '';
  if (!url) throw new Error('Server did not return a file URL.');
  return url;
}

async function requestWithDedupe(path, options = {}) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const method = (options.method || 'GET').toUpperCase();
  const token = getToken();
  const authKey = token ? `:${token.slice(-20)}` : ':anon';
  const cacheKey = method === 'GET' ? `${method}:${url}${authKey}` : null;

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

  const fetchInit = {
    ...options,
    headers,
    signal: options.signal,
  };

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

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  if (method === 'GET') return requestWithDedupe(path, options);
  return requestNoDedupe(path, options);
}

async function requestNoDedupe(path, options = {}, serverRetriesLeft = MAX_RETRIES_5XX) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const sessionCode = getSessionCode();
  if (sessionCode) headers['X-Session-Code'] = sessionCode;

  const fetchInit = {
    ...options,
    headers,
    signal: options.signal,
  };

  const res = await fetchWithNetworkRetry(url, fetchInit);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) clearAuthStorageAndNotify();
    if (
      res.status === 403 &&
      token &&
      (data.code === 'ACCOUNT_BLOCKED' || data.code === 'EMAIL_NOT_VERIFIED')
    ) {
      clearAuthStorageAndNotify();
    }
    if (res.status >= 500 && serverRetriesLeft > 0) {
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

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  /** `?? {}` so POST body is always valid JSON (never `undefined` → invalid fetch body). */
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: (path) => request(path, { method: 'DELETE' }),

  /** Public JSON for web + mobile (GET /api/site-settings — no auth). Same data as admin GET. */
  siteSettings: () => api.get('/api/site-settings'),

  auth: {
    checkUsername: (username) =>
      api.get(`/api/auth/check-username?username=${encodeURIComponent(username || '')}`),
    login: (email, password) => api.post('/api/auth/login', { email, password }),
    register: (name, username, email, password) =>
      api.post('/api/auth/register', { name, username, email, password }),
    /** Same 6-digit code + tokens table as the Tripoli Explorer mobile app. */
    verifyEmail: (email, code) => api.post('/api/auth/verify-email', { email, code }),
    forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
    resetPassword: (email, code, newPassword) => api.post('/api/auth/reset-password', { email, code, newPassword }),
  },
  places: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return api.get(`/api/places${q ? `?${q}` : ''}`);
    },
    get: (id, opts) => {
      const qs = new URLSearchParams();
      if (opts && opts.lang) qs.set('lang', String(opts.lang));
      const q = qs.toString();
      return api.get(`/api/places/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
    },
    promotions: (id, opts) => {
      const qs = new URLSearchParams();
      if (opts?.lang) qs.set('lang', String(opts.lang));
      const q = qs.toString();
      return api.get(`/api/places/${encodeURIComponent(id)}/promotions${q ? `?${q}` : ''}`);
    },
    /** Public: reviews left on Visit Tripoli (not Google). */
    reviews: (id) => api.get(`/api/places/${encodeURIComponent(id)}/reviews`),
    /** Auth: create or replace current user’s review for this place. */
    submitReview: (id, body) =>
      api.post(`/api/places/${encodeURIComponent(id)}/reviews`, body || {}),
    /** Auth: author, admin, or place owner — removes the review row. */
    deleteReview: (placeId, reviewId) =>
      api.delete(`/api/places/${encodeURIComponent(placeId)}/reviews/${encodeURIComponent(String(reviewId))}`),
    /** Auth: admin or place owner — soft-hide or restore on the public list. */
    patchReview: (placeId, reviewId, body) =>
      api.patch(`/api/places/${encodeURIComponent(placeId)}/reviews/${encodeURIComponent(String(reviewId))}`, body),
    checkin: (id, body) => api.post(`/api/places/${encodeURIComponent(id)}/checkin`, body || {}),
    inquiry: (id, body) => api.post(`/api/places/${encodeURIComponent(id)}/inquiries`, body),
    /** Guest: pass email (must match inquiry). Logged-in: omit email when JWT matches inquiry user_id. */
    inquiryStatus: (placeId, inquiryId, email) => {
      const qs = new URLSearchParams();
      if (email && String(email).trim()) qs.set('email', String(email).trim());
      qs.set('_', String(Date.now()));
      return api.get(
        `/api/places/${encodeURIComponent(placeId)}/inquiries/${encodeURIComponent(String(inquiryId))}?${qs}`
      );
    },
    /** Same auth as inquiry status; blocked if venue archived the thread. */
    inquiryFollowUp: (placeId, inquiryId, body) =>
      api.post(
        `/api/places/${encodeURIComponent(placeId)}/inquiries/${encodeURIComponent(String(inquiryId))}/follow-up`,
        body
      ),
  },
  tours: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return api.get(`/api/tours${q ? `?${q}` : ''}`);
    },
    get: (id) => api.get(`/api/tours/${id}`),
  },
  events: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return api.get(`/api/events${q ? `?${q}` : ''}`);
    },
    get: (id) => api.get(`/api/events/${id}`),
  },
  categories: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return api.get(`/api/categories${q ? `?${q}` : ''}`);
    },
  },
  interests: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return api.get(`/api/interests${q ? `?${q}` : ''}`);
    },
  },
  admin: {
    places: {
      list: (params) => {
        const qs = new URLSearchParams();
        if (params && typeof params === 'object') {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
          });
        }
        const q = qs.toString();
        return api.get(`/api/admin/places${q ? `?${q}` : ''}`);
      },
      create: (body) => api.post('/api/admin/places', body),
      update: (id, body) => api.put(`/api/admin/places/${id}`, body),
      delete: (id) => api.delete(`/api/admin/places/${id}`),
      /** Moderation: all reviews including hidden (admin JWT). Hide/restore/delete via `places.patchReview` / `places.deleteReview`. */
      reviews: (placeId) => api.get(`/api/admin/places/${encodeURIComponent(placeId)}/reviews`),
    },
    categories: {
      create: (body) => api.post('/api/admin/categories', body),
      update: (id, body) => api.put(`/api/admin/categories/${id}`, body),
      delete: (id) => api.delete(`/api/admin/categories/${id}`),
    },
    tours: {
      create: (body) => api.post('/api/admin/tours', body),
      update: (id, body) => api.put(`/api/admin/tours/${id}`, body),
      delete: (id) => api.delete(`/api/admin/tours/${id}`),
    },
    events: {
      create: (body) => api.post('/api/admin/events', body),
      update: (id, body) => api.put(`/api/admin/events/${id}`, body),
      delete: (id) => api.delete(`/api/admin/events/${id}`),
    },
    stats: () => api.get('/api/admin/stats'),
    users: {
      list: (params) => {
        const qs = new URLSearchParams();
        if (params && typeof params === 'object') {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
          });
        }
        const q = qs.toString();
        return api.get(`/api/admin/users${q ? `?${q}` : ''}`);
      },
      update: (id, body) => api.patch(`/api/admin/users/${id}`, body),
      delete: (id) => api.delete(`/api/admin/users/${id}`),
    },
    allTrips: {
      list: (params) => {
        const qs = new URLSearchParams();
        if (params && typeof params === 'object') {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
          });
        }
        const q = qs.toString();
        return api.get(`/api/admin/all-trips${q ? `?${q}` : ''}`);
      },
    },
    feed: {
      list: (params) => {
        const qs = new URLSearchParams();
        if (params && typeof params === 'object') {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
          });
        }
        const q = qs.toString();
        return api.get(`/api/admin/feed${q ? `?${q}` : ''}`);
      },
      create: (body) => api.post('/api/admin/feed', body),
      get: (id) => api.get(`/api/admin/feed/${id}`),
      update: (id, body) => api.patch(`/api/admin/feed/${id}`, body),
      delete: (id) => api.delete(`/api/admin/feed/${id}`),
      comments: (postId) => api.get(`/api/admin/feed/${postId}/comments`),
      deleteComment: (commentId) => api.delete(`/api/admin/feed/comments/${commentId}`),
    },
    interests: {
      create: (body) => api.post('/api/admin/interests', body),
      update: (id, body) => api.put(`/api/admin/interests/${id}`, body),
      delete: (id) => api.delete(`/api/admin/interests/${id}`),
    },
    placeOwners: {
      list: (params) => {
        const qs = new URLSearchParams();
        if (params && typeof params === 'object') {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
          });
        }
        const q = qs.toString();
        return api.get(`/api/admin/place-owners${q ? `?${q}` : ''}`);
      },
      add: (body) => api.post('/api/admin/place-owners', body),
      remove: (userId, placeId) =>
        api.delete(`/api/admin/place-owners?userId=${encodeURIComponent(userId)}&placeId=${encodeURIComponent(placeId)}`),
    },
    /** Venue offers (place_promotions) — full CRUD; public Discover merges with coupons. */
    placePromotions: {
      list: (params) => {
        const qs = new URLSearchParams();
        if (params && typeof params === 'object') {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
          });
        }
        const q = qs.toString();
        return api.get(`/api/admin/place-promotions${q ? `?${q}` : ''}`);
      },
      create: (body) => api.post('/api/admin/place-promotions', body),
      update: (id, body) => api.patch(`/api/admin/place-promotions/${encodeURIComponent(id)}`, body),
      delete: (id) => api.delete(`/api/admin/place-promotions/${encodeURIComponent(id)}`),
    },
    /** App coupons (coupons table) — distinct from POST /api/coupons/redeem for signed-in users. */
    managedCoupons: {
      list: (params) => {
        const qs = new URLSearchParams();
        if (params && typeof params === 'object') {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
          });
        }
        const q = qs.toString();
        return api.get(`/api/admin/coupons${q ? `?${q}` : ''}`);
      },
      create: (body) => api.post('/api/admin/coupons', body),
      update: (id, body) => api.patch(`/api/admin/coupons/${encodeURIComponent(id)}`, body),
      delete: (id) => api.delete(`/api/admin/coupons/${encodeURIComponent(id)}`),
    },
    siteSettings: {
      get: () => api.get('/api/admin/site-settings'),
      save: (settings) => api.put('/api/admin/site-settings', { settings }),
    },
    sponsoredPlaces: {
      list: () => api.get('/api/admin/sponsored-places'),
      create: (body) => api.post('/api/admin/sponsored-places', body),
      update: (id, body) => api.patch(`/api/admin/sponsored-places/${encodeURIComponent(id)}`, body),
      delete: (id) => api.delete(`/api/admin/sponsored-places/${encodeURIComponent(id)}`),
    },
    emailBroadcast: (body) => api.post('/api/admin/email-broadcast', body),
    content: {
      get: () => api.get('/api/admin/content'),
      save: (overrides) => api.put('/api/admin/content', { overrides }),
    },
    upload: (file, options = {}) => {
      const formData = new FormData();
      if (options.purpose === 'reel') formData.append('purpose', 'reel');
      formData.append('file', file);
      const url = `${getBaseUrl()}/api/admin/upload`;
      const headers = {};
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetchWithNetworkRetry(url, { method: 'POST', body: formData, headers, credentials: 'include' }).then((r) =>
        parseStorageUploadResponse(r, token)
      );
    },
  },
  /** Business owners: manage only places linked in place_owners (not admin). */
  business: {
    me: () => api.get('/api/business/me'),
    places: {
      list: () => api.get('/api/business/places'),
      get: (placeId) => api.get(`/api/business/places/${encodeURIComponent(placeId)}`),
      update: (placeId, body) => api.put(`/api/business/places/${encodeURIComponent(placeId)}`, body),
      reviews: (placeId) => api.get(`/api/business/places/${encodeURIComponent(placeId)}/reviews`),
    },
    translations: {
      list: (placeId) => api.get(`/api/business/places/${encodeURIComponent(placeId)}/translations`),
      save: (placeId, lang, body) =>
        api.put(`/api/business/places/${encodeURIComponent(placeId)}/translations/${encodeURIComponent(lang)}`, body),
    },
    upload: (file, placeId, options = {}) => {
      const formData = new FormData();
      formData.append('placeId', String(placeId));
      if (options.purpose === 'reel') formData.append('purpose', 'reel');
      formData.append('file', file);
      const url = `${getBaseUrl()}/api/business/upload`;
      const headers = {};
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetchWithNetworkRetry(url, { method: 'POST', body: formData, headers, credentials: 'include' }).then((r) =>
        parseStorageUploadResponse(r, token)
      );
    },
    feed: {
      list: (params) => {
        const qs = new URLSearchParams();
        if (params?.placeId) qs.set('placeId', String(params.placeId));
        if (params?.format && params.format !== 'all') qs.set('format', String(params.format));
        const q = qs.toString();
        return api.get(`/api/business/feed${q ? `?${q}` : ''}`);
      },
      create: (body) => api.post('/api/business/feed', body),
      update: (id, body) => api.patch(`/api/business/feed/${encodeURIComponent(id)}`, body),
      delete: (id) => api.delete(`/api/business/feed/${encodeURIComponent(id)}`),
    },
    insights: (placeId) =>
      api.get(`/api/business/insights?placeId=${encodeURIComponent(placeId)}`),
    proposals: {
      list: (placeId) =>
        api.get(`/api/business/proposals?placeId=${encodeURIComponent(placeId)}`),
      update: (id, body) => api.patch(`/api/business/proposals/${encodeURIComponent(id)}`, body),
    },
    messagingBlocks: {
      block: (placeId, inquiryId) =>
        api.post('/api/business/messaging-blocks', { placeId, inquiryId }),
      unblock: (placeId, inquiryId) => {
        const qs = new URLSearchParams({
          placeId: String(placeId),
          inquiryId: String(inquiryId),
        });
        return api.delete(`/api/business/messaging-blocks?${qs}`);
      },
    },
    promotions: {
      list: (placeId) =>
        api.get(`/api/business/promotions?placeId=${encodeURIComponent(placeId)}`),
      create: (body) => api.post('/api/business/promotions', body),
      update: (id, body) => api.patch(`/api/business/promotions/${encodeURIComponent(id)}`, body),
      delete: (id) => api.delete(`/api/business/promotions/${encodeURIComponent(id)}`),
    },
  },
  sponsoredPlaces: (params) => {
    const qs = new URLSearchParams();
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      });
    }
    const q = qs.toString();
    return api.get(`/api/sponsored-places${q ? `?${q}` : ''}`);
  },
  /** Public community feed (approved + discoverable only). GET sends Bearer token when logged in for liked_by_me / saved_by_me. */
  communityFeed: (params) => {
    const qs = new URLSearchParams();
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      });
    }
    const q = qs.toString();
    return api.get(`/api/feed${q ? `?${q}` : ''}`);
  },
  /** Like, save, comment on feed posts (same DB as mobile app). */
  feedPublic: {
    post: (postId) => api.get(`/api/feed/post/${encodeURIComponent(postId)}`),
    comments: (postId) => api.get(`/api/feed/post/${encodeURIComponent(postId)}/comments`),
    /** @param {string} postId @param {string | { body: string, parentId?: string }} bodyOrPayload */
    addComment: (postId, bodyOrPayload) => {
      const payload =
        typeof bodyOrPayload === 'string' ? { body: bodyOrPayload } : bodyOrPayload;
      return api.post(`/api/feed/post/${encodeURIComponent(postId)}/comments`, payload);
    },
    /** Like or unlike — server writes to `feed_likes` (INSERT / DELETE), returns DB counts. */
    toggleLike: (postId) => api.post(`/api/feed/post/${encodeURIComponent(postId)}/like`),
    toggleSave: (postId) => api.post(`/api/feed/post/${encodeURIComponent(postId)}/save`),
    /** Like or unlike a comment — server writes to `feed_comment_likes`. */
    toggleCommentLike: (postId, commentId) =>
      api.post(
        `/api/feed/post/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/like`
      ),
    updateComment: (postId, commentId, body) =>
      api.patch(`/api/feed/post/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, {
        body,
      }),
    deleteComment: (postId, commentId) =>
      api.delete(`/api/feed/post/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`),
  },
  /** Active offers/coupons across places (public Community hub). */
  publicPromotions: (params) => {
    const qs = new URLSearchParams();
    if (params?.limit != null && params.limit !== '') qs.set('limit', String(params.limit));
    if (params?.lang) qs.set('lang', String(params.lang));
    const q = qs.toString();
    return api.get(`/api/promotions${q ? `?${q}` : ''}`);
  },

  /** Coupon redemption (auth) — same DB rules as mobile (`coupon_redemptions`, code check). */
  coupons: {
    redeemed: () => api.get('/api/coupons/redeemed'),
    redeem: (promotionId, code) => api.post('/api/coupons/redeem', { promotionId, code }),
  },

  user: {
    profile: () => api.get('/api/user/profile'),
    updateProfile: (data) => api.patch('/api/user/profile', data),
    uploadAvatar: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const url = `${getBaseUrl()}/api/user/profile/avatar`;
      const headers = {};
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetchWithNetworkRetry(url, { method: 'POST', body: formData, headers, credentials: 'include' }).then(async (r) => {
        let json = null;
        try {
          json = await r.json();
        } catch {
          json = null;
        }
        if (!r.ok) {
          const msg = json?.error || json?.detail || `Upload failed (${r.status})`;
          const e = new Error(msg);
          e.status = r.status;
          e.data = json;
          throw e;
        }
        return json;
      });
    },
    changePassword: (currentPassword, newPassword) => api.post('/api/user/change-password', { currentPassword, newPassword }),
    /** Venue inquiries sent while signed in (place messages / proposals). */
    inquiries: () => api.get('/api/user/inquiries'),
    trips: () => api.get('/api/user/trips'),
    getTrip: (id) => api.get(`/api/user/trips/${encodeURIComponent(id)}`),
    createTrip: (data) => api.post('/api/user/trips', data),
    updateTrip: (id, data) => api.patch(`/api/user/trips/${id}`, data),
    deleteTrip: (id) => api.delete(`/api/user/trips/${id}`),
    favourites: () => api.get('/api/user/favourites'),
    addFavourite: (placeId) => api.post('/api/user/favourites', { placeId }),
    removeFavourite: (placeId) => api.delete(`/api/user/favourites/${placeId}`),
  },
};

export default api;
