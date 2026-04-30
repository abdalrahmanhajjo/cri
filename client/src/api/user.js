import { baseApi, getBaseUrl, getToken, fetchWithNetworkRetry, parseStorageUploadResponse } from './base';

export const user = {
  profile: () => baseApi.get('/api/user/profile'),
  updateProfile: (data) => baseApi.patch('/api/user/profile', data),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const url = `${getBaseUrl()}/api/user/profile/avatar`;
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchWithNetworkRetry(url, { method: 'POST', body: formData, headers, credentials: 'include' }).then(async (r) => {
      let json = null;
      try { json = await r.json(); } catch { json = null; }
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
  changePassword: (currentPassword, newPassword) =>
    baseApi.post('/api/user/change-password', { currentPassword, newPassword }),
  feed: {
    create: (body) => baseApi.post('/api/user/feed', body),
    update: (id, body) => baseApi.patch(`/api/user/feed/${encodeURIComponent(id)}`, body),
    delete: (id) => baseApi.delete(`/api/user/feed/${encodeURIComponent(id)}`),
    upload: (file, placeId, options = {}) => {
      const formData = new FormData();
      formData.append('placeId', String(placeId));
      if (options.purpose === 'reel') formData.append('purpose', 'reel');
      formData.append('file', file);
      const url = `${getBaseUrl()}/api/user/feed/upload`;
      const headers = {};
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetchWithNetworkRetry(url, { method: 'POST', body: formData, headers, credentials: 'include' }).then((r) =>
        parseStorageUploadResponse(r, token)
      );
    },
    placeSearch: (q, opts = {}) => {
      const qs = new URLSearchParams();
      qs.set('q', String(q || '').trim());
      if (opts.limit) qs.set('limit', String(opts.limit));
      return baseApi.get(`/api/user/feed/places?${qs}`);
    },
  },
  inquiries: () => baseApi.get('/api/user/inquiries'),
  trips: () => baseApi.get('/api/user/trips'),
  getTrip: (id) => baseApi.get(`/api/user/trips/${encodeURIComponent(id)}`),
  createTrip: (data) => baseApi.post('/api/user/trips', data),
  updateTrip: (id, data) => baseApi.patch(`/api/user/trips/${id}`, data),
  deleteTrip: (id) => baseApi.delete(`/api/user/trips/${id}`),
  tripShareRequests: (params) => {
    const qs = new URLSearchParams();
    if (params?.box) qs.set('box', String(params.box));
    if (params?.status) qs.set('status', String(params.status));
    const q = qs.toString();
    return baseApi.get(`/api/user/trip-share-requests${q ? `?${q}` : ''}`);
  },
  sendTripShareRequest: (body) => baseApi.post('/api/user/trip-share-requests', body || {}),
  respondTripShareRequest: (requestId, decision) =>
    baseApi.post(`/api/user/trip-share-requests/${encodeURIComponent(requestId)}/respond`, { decision }),
  searchTripShareUsers: (q) =>
    baseApi.get(`/api/user/trip-share-users?q=${encodeURIComponent(String(q || ''))}`),
  favourites: (opts = {}) => baseApi.get('/api/user/favourites', opts),
  addFavourite: (placeId) => baseApi.post('/api/user/favourites', { placeId }),
  removeFavourite: (placeId) =>
    baseApi.delete(`/api/user/favourites/${encodeURIComponent(String(placeId))}`),
};

export const coupons = {
  redeemed: () => baseApi.get('/api/coupons/redeemed'),
  redeem: (promotionId, code) => baseApi.post('/api/coupons/redeem', { promotionId, code }),
};
