import { apiBase, getBaseUrl, getToken, clearAuthStorageAndNotify, fetchWithNetworkRetry } from './base';

export const adminApi = {
  places: {
    list: (params) => {
      const qs = new URLSearchParams();
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
        });
      }
      return apiBase.get(`/api/admin/places${qs.toString() ? `?${qs.toString()}` : ''}`);
    },
    create: (body) => apiBase.post('/api/admin/places', body),
    update: (id, body) => apiBase.put(`/api/admin/places/${id}`, body),
    delete: (id) => apiBase.delete(`/api/admin/places/${id}`),
    reviews: (placeId) => apiBase.get(`/api/admin/places/${encodeURIComponent(placeId)}/reviews`),
  },
  categories: {
    create: (body) => apiBase.post('/api/admin/categories', body),
    update: (id, body) => apiBase.put(`/api/admin/categories/${id}`, body),
    delete: (id) => apiBase.delete(`/api/admin/categories/${id}`),
  },
  tours: {
    create: (body) => apiBase.post('/api/admin/tours', body),
    update: (id, body) => apiBase.put(`/api/admin/tours/${id}`, body),
    delete: (id) => apiBase.delete(`/api/admin/tours/${id}`),
  },
  events: {
    create: (body) => apiBase.post('/api/admin/events', body),
    update: (id, body) => apiBase.put(`/api/admin/events/${id}`, body),
    delete: (id) => apiBase.delete(`/api/admin/events/${id}`),
  },
  stats: () => apiBase.get('/api/admin/stats'),
  users: {
    list: (params) => {
      const qs = new URLSearchParams();
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
        });
      }
      return apiBase.get(`/api/admin/users${qs.toString() ? `?${qs.toString()}` : ''}`);
    },
    update: (id, body) => apiBase.patch(`/api/admin/users/${id}`, body),
    delete: (id) => apiBase.delete(`/api/admin/users/${id}`),
  },
  allTrips: {
    list: (params) => {
      const qs = new URLSearchParams();
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
        });
      }
      return apiBase.get(`/api/admin/all-trips${qs.toString() ? `?${qs.toString()}` : ''}`);
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
      return apiBase.get(`/api/admin/feed${qs.toString() ? `?${qs.toString()}` : ''}`);
    },
    create: (body) => apiBase.post('/api/admin/feed', body),
    get: (id) => apiBase.get(`/api/admin/feed/${id}`),
    update: (id, body) => apiBase.patch(`/api/admin/feed/${id}`, body),
    delete: (id) => apiBase.delete(`/api/admin/feed/${id}`),
    comments: (postId) => apiBase.get(`/api/admin/feed/${postId}/comments`),
    deleteComment: (commentId) => apiBase.delete(`/api/admin/feed/comments/${commentId}`),
  },
  interests: {
    create: (body) => apiBase.post('/api/admin/interests', body),
    update: (id, body) => apiBase.put(`/api/admin/interests/${id}`, body),
    delete: (id) => apiBase.delete(`/api/admin/interests/${id}`),
  },
  placeOwners: {
    list: (params) => {
      const qs = new URLSearchParams();
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
        });
      }
      return apiBase.get(`/api/admin/place-owners${qs.toString() ? `?${qs.toString()}` : ''}`);
    },
    add: (body) => apiBase.post('/api/admin/place-owners', body),
    remove: (userId, placeId) =>
      apiBase.delete(`/api/admin/place-owners?userId=${encodeURIComponent(userId)}&placeId=${encodeURIComponent(placeId)}`),
  },
  siteSettings: {
    get: () => apiBase.get('/api/admin/site-settings'),
    save: (settings) => apiBase.put('/api/admin/site-settings', { settings }),
  },
  content: {
    get: () => apiBase.get('/api/admin/content'),
    save: (overrides) => apiBase.put('/api/admin/content', { overrides }),
  },
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const url = `${getBaseUrl()}/api/admin/upload`;
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return fetchWithNetworkRetry(url, { method: 'POST', body: formData, headers, credentials: 'include' }).then(
      async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (r.status === 401 && token) clearAuthStorageAndNotify();
          throw new Error(data.error || r.statusText || 'Upload failed');
        }
        return data.url || '';
      }
    );
  },
};

export const businessApi = {
  me: () => apiBase.get('/api/business/me'),
  places: {
    list: () => apiBase.get('/api/business/places'),
    get: (id) => apiBase.get(`/api/business/places/${encodeURIComponent(id)}`),
    update: (id, body) => apiBase.put(`/api/business/places/${encodeURIComponent(id)}`, body),
    reviews: (id) => apiBase.get(`/api/business/places/${encodeURIComponent(id)}/reviews`),
  },
  translations: {
    list: (pid) => apiBase.get(`/api/business/places/${encodeURIComponent(pid)}/translations`),
    save: (pid, lang, body) => apiBase.put(`/api/business/places/${encodeURIComponent(pid)}/translations/${encodeURIComponent(lang)}`, body),
  },
  upload: (file, placeId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('placeId', placeId);
    const url = `${getBaseUrl()}/api/business/upload`;
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return fetchWithNetworkRetry(url, { method: 'POST', body: formData, headers, credentials: 'include' }).then(
      async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (r.status === 401 && token) clearAuthStorageAndNotify();
          throw new Error(data.error || 'Upload failed');
        }
        return data.url || '';
      }
    );
  },
  feed: {
    list: (params) => {
      const qs = new URLSearchParams();
      if (params?.placeId) qs.set('placeId', params.placeId);
      return apiBase.get(`/api/business/feed${qs.toString() ? `?${qs.toString()}` : ''}`);
    },
    create: (body) => apiBase.post('/api/business/feed', body),
    update: (id, body) => apiBase.patch(`/api/business/feed/${id}`, body),
    delete: (id) => apiBase.delete(`/api/business/feed/${id}`),
  },
  insights: (placeId) => apiBase.get(`/api/business/insights?placeId=${encodeURIComponent(placeId)}`),
  proposals: {
    list: (placeId) => apiBase.get(`/api/business/proposals?placeId=${encodeURIComponent(placeId)}`),
    update: (id, body) => apiBase.patch(`/api/business/proposals/${encodeURIComponent(id)}`, body),
  },
  messagingBlocks: {
    block: (placeId, inquiryId) => apiBase.post('/api/business/messaging-blocks', { placeId, inquiryId }),
    unblock: (placeId, inquiryId) => apiBase.delete(`/api/business/messaging-blocks?placeId=${placeId}&inquiryId=${inquiryId}`),
  },
  promotions: {
    list: (placeId) => apiBase.get(`/api/business/promotions?placeId=${encodeURIComponent(placeId)}`),
    create: (body) => apiBase.post('/api/business/promotions', body),
    update: (id, body) => apiBase.patch(`/api/business/promotions/${id}`, body),
    delete: (id) => apiBase.delete(`/api/business/promotions/${id}`),
  },
};
