import { baseApi, getBaseUrl, getToken, fetchWithNetworkRetry, parseStorageUploadResponse } from './base';

export const admin = {
  places: {
    list: (params) => {
      const qs = new URLSearchParams();
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
        });
      }
      const q = qs.toString();
      return baseApi.get(`/api/admin/places${q ? `?${q}` : ''}`);
    },
    create: (body) => baseApi.post('/api/admin/places', body),
    update: (id, body) => baseApi.put(`/api/admin/places/${id}`, body),
    delete: (id) => baseApi.delete(`/api/admin/places/${id}`),
    reviews: (placeId) => baseApi.get(`/api/admin/places/${encodeURIComponent(placeId)}/reviews`),
  },
  categories: {
    create: (body) => baseApi.post('/api/admin/categories', body),
    update: (id, body) => baseApi.put(`/api/admin/categories/${id}`, body),
    delete: (id) => baseApi.delete(`/api/admin/categories/${id}`),
  },
  tours: {
    create: (body) => baseApi.post('/api/admin/tours', body),
    update: (id, body) => baseApi.put(`/api/admin/tours/${id}`, body),
    delete: (id) => baseApi.delete(`/api/admin/tours/${id}`),
  },
  events: {
    create: (body) => baseApi.post('/api/admin/events', body),
    update: (id, body) => baseApi.put(`/api/admin/events/${id}`, body),
    delete: (id) => baseApi.delete(`/api/admin/events/${id}`),
  },
  stats: () => baseApi.get('/api/admin/stats'),
  users: {
    list: (params) => {
      const qs = new URLSearchParams();
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
        });
      }
      const q = qs.toString();
      return baseApi.get(`/api/admin/users${q ? `?${q}` : ''}`);
    },
    update: (id, body) => baseApi.patch(`/api/admin/users/${id}`, body),
    delete: (id) => baseApi.delete(`/api/admin/users/${id}`),
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
      return baseApi.get(`/api/admin/all-trips${q ? `?${q}` : ''}`);
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
      return baseApi.get(`/api/admin/feed${q ? `?${q}` : ''}`);
    },
    create: (body) => baseApi.post('/api/admin/feed', body),
    get: (id) => baseApi.get(`/api/admin/feed/${id}`),
    update: (id, body) => baseApi.patch(`/api/admin/feed/${id}`, body),
    delete: (id) => baseApi.delete(`/api/admin/feed/${id}`),
    comments: (postId) => baseApi.get(`/api/admin/feed/${postId}/comments`),
    deleteComment: (commentId) => baseApi.delete(`/api/admin/feed/comments/${commentId}`),
  },
  interests: {
    create: (body) => baseApi.post('/api/admin/interests', body),
    update: (id, body) => baseApi.put(`/api/admin/interests/${id}`, body),
    delete: (id) => baseApi.delete(`/api/admin/interests/${id}`),
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
      return baseApi.get(`/api/admin/place-owners${q ? `?${q}` : ''}`);
    },
    add: (body) => baseApi.post('/api/admin/place-owners', body),
    remove: (userId, placeId) =>
      baseApi.delete(`/api/admin/place-owners?userId=${encodeURIComponent(userId)}&placeId=${encodeURIComponent(placeId)}`),
  },
  placePromotions: {
    list: (params) => {
      const qs = new URLSearchParams();
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
        });
      }
      const q = qs.toString();
      return baseApi.get(`/api/admin/place-promotions${q ? `?${q}` : ''}`);
    },
    create: (body) => baseApi.post('/api/admin/place-promotions', body),
    update: (id, body) => baseApi.patch(`/api/admin/place-promotions/${encodeURIComponent(id)}`, body),
    delete: (id) => baseApi.delete(`/api/admin/place-promotions/${encodeURIComponent(id)}`),
  },
  managedCoupons: {
    list: (params) => {
      const qs = new URLSearchParams();
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
        });
      }
      const q = qs.toString();
      return baseApi.get(`/api/admin/coupons${q ? `?${q}` : ''}`);
    },
    create: (body) => baseApi.post('/api/admin/coupons', body),
    update: (id, body) => baseApi.patch(`/api/admin/coupons/${encodeURIComponent(id)}`, body),
    delete: (id) => baseApi.delete(`/api/admin/coupons/${encodeURIComponent(id)}`),
  },
  siteSettings: {
    get: () => baseApi.get('/api/admin/site-settings'),
    save: (settings) => baseApi.put('/api/admin/site-settings', { settings }),
  },
  emailBroadcast: (body) => baseApi.post('/api/admin/email-broadcast', body),
  content: {
    get: () => baseApi.get('/api/admin/content'),
    save: (overrides) => baseApi.put('/api/admin/content', { overrides }),
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
};
