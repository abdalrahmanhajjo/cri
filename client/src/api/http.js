/**
 * Core HTTP utility for the modular API.
 * Handles base URL, auth headers, error normalization, and retries.
 */

export function getBaseUrl() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === '' || raw === undefined || raw === null) {
    if (typeof window !== 'undefined') return '';
    return 'http://localhost:3095';
  }
  return String(raw).replace(/\/$/, '');
}

const SESSION_CODE_KEY = 'session_code';

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

async function fetchWithRetry(url, init, retries = 1) {
  try {
    const res = await fetch(url, init);
    if (!res.ok && res.status >= 500 && retries > 0) {
      await new Promise(r => setTimeout(r, 800));
      return fetchWithRetry(url, init, retries - 1);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 400));
      return fetchWithRetry(url, init, retries - 1);
    }
    throw err;
  }
}

export async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  
  const token = getToken();
  const sc = getSessionCode();
  
  const headers = { 
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(sc ? { 'X-Session-Code': sc } : {}),
    ...options.headers 
  };

  try {
    const res = await fetchWithRetry(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      // Auto-logout on 401
      if ((res.status === 401 || (res.status === 403 && data.code === 'ACCOUNT_BLOCKED')) && token) {
        clearAuthStorageAndNotify();
      }
      
      if (import.meta.env.DEV) {
        console.error(`[API Error] ${method} ${path} (${res.status}):`, data.error || res.statusText);
      }
      
      const err = new Error(data.error || res.statusText || 'Request failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    
    return data;
  } catch (err) {
    if (import.meta.env.DEV && !err.status) {
      console.error(`[Network Error] ${method} ${path}:`, err.message);
    }
    throw err;
  }
}

/** Legacy-compatible wrapper for standard methods */
export const http = {
  get: (path, opts) => apiFetch(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiFetch(path, { ...opts, method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: (path, body, opts) => apiFetch(path, { ...opts, method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: (path, body, opts) => apiFetch(path, { ...opts, method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: (path, opts) => apiFetch(path, { ...opts, method: 'DELETE' }),
  
  upload: async (path, file, additionalFields = {}, opts = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(additionalFields).forEach(([k, v]) => {
      if (v != null) formData.append(k, v);
    });
    
    const token = getToken();
    const sc = getSessionCode();
    const headers = { 
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(sc ? { 'X-Session-Code': sc } : {}),
      ...opts.headers 
    };

    const res = await fetchWithRetry(`${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
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
