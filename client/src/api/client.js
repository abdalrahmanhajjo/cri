/**
 * API client for Tripoli Explorer – same backend (Node) and DB as the mobile app.
 * Set VITE_API_URL in .env to your backend (e.g. http://localhost:3000).
 * Features: GET deduplication (in-flight), AbortSignal support, optional retry for 5xx.
 */

const getBaseUrl = () => import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3000';

/** Fix malformed extension (e.g. xxxjpg -> xxx.jpg) from old upload bug */
export function fixImageUrlExtension(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/([a-f0-9]{32})(jpe?g|png|gif|webp)$/i, '$1.$2');
}

/** Return original-style URL (xxx.jpg -> xxxjpg) for fallback when fixed URL fails */
export function getImageUrlAlternate(url) {
  if (!url || typeof url !== 'string') return null;
  return url.replace(/\.(jpe?g|png|gif|webp)$/i, '$1');
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

/** In-flight GET requests: key = url, value = Promise. Cleared when settled. */
const getRequestCache = new Map();

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

async function requestWithDedupe(path, options = {}) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const method = (options.method || 'GET').toUpperCase();
  const cacheKey = method === 'GET' ? `${method}:${url}` : null;

  if (cacheKey && !options.signal) {
    const cached = getRequestCache.get(cacheKey);
    if (cached) return cached;
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const sessionCode = getSessionCode();
  if (sessionCode) headers['X-Session-Code'] = sessionCode;

  const doFetch = (retriesLeft = 0) =>
    fetch(url, {
      ...options,
      headers,
      signal: options.signal,
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || res.statusText || 'Request failed');
        err.status = res.status;
        err.data = data;
        if (res.status >= 500 && retriesLeft > 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          return doFetch(retriesLeft - 1);
        }
        throw err;
      }
      return data;
    });

  const promise = doFetch(MAX_RETRIES_5XX)
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

async function requestNoDedupe(path, options = {}) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const sessionCode = getSessionCode();
  if (sessionCode) headers['X-Session-Code'] = sessionCode;

  const res = await fetch(url, { ...options, headers, signal: options.signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    if (res.status >= 500 && MAX_RETRIES_5XX > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return requestNoDedupe(path, { ...options, signal: undefined });
    }
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),

  auth: {
    login: (email, password) => api.post('/api/auth/login', { email, password }),
    register: (name, email, password) => api.post('/api/auth/register', { name, email, password }),
    forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
    resetPassword: (email, code, newPassword) => api.post('/api/auth/reset-password', { email, code, newPassword }),
  },
  places: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return api.get(`/api/places${q ? `?${q}` : ''}`);
    },
    get: (id) => api.get(`/api/places/${id}`),
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
  admin: {
    places: {
      create: (body) => api.post('/api/admin/places', body),
      update: (id, body) => api.put(`/api/admin/places/${id}`, body),
      delete: (id) => api.delete(`/api/admin/places/${id}`),
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
    content: {
      get: () => api.get('/api/admin/content'),
      save: (overrides) => api.put('/api/admin/content', { overrides }),
    },
    upload: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const url = `${getBaseUrl()}/api/admin/upload`;
      const headers = {};
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetch(url, { method: 'POST', body: formData, headers, credentials: 'include' })
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || r.statusText || 'Upload failed');
          if (data.error) throw new Error(data.error);
          return data.url || '';
        });
    },
  },
  user: {
    profile: () => api.get('/api/user/profile'),
    updateProfile: (data) => api.patch('/api/user/profile', data),
    changePassword: (currentPassword, newPassword) => api.post('/api/user/change-password', { currentPassword, newPassword }),
    trips: () => api.get('/api/user/trips'),
    createTrip: (data) => api.post('/api/user/trips', data),
    updateTrip: (id, data) => api.patch(`/api/user/trips/${id}`, data),
    deleteTrip: (id) => api.delete(`/api/user/trips/${id}`),
    favourites: () => api.get('/api/user/favourites'),
    addFavourite: (placeId) => api.post('/api/user/favourites', { placeId }),
    removeFavourite: (placeId) => api.delete(`/api/user/favourites/${placeId}`),
  },
};

export default api;
