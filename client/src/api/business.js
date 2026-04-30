import { baseApi, getBaseUrl, getToken, fetchWithNetworkRetry, parseStorageUploadResponse } from './base';

export const business = {
  me: () => baseApi.get('/api/business/me'),
  places: {
    list: () => baseApi.get('/api/business/places'),
    get: (placeId) => baseApi.get(`/api/business/places/${encodeURIComponent(placeId)}`),
    update: (placeId, body) => baseApi.put(`/api/business/places/${encodeURIComponent(placeId)}`, body),
    reviews: (placeId) => baseApi.get(`/api/business/places/${encodeURIComponent(placeId)}/reviews`),
  },
  translations: {
    list: (placeId) => baseApi.get(`/api/business/places/${encodeURIComponent(placeId)}/translations`),
    save: (placeId, lang, body) =>
      baseApi.put(`/api/business/places/${encodeURIComponent(placeId)}/translations/${encodeURIComponent(lang)}`, body),
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
      if (params?.q && String(params.q).trim().length >= 2) qs.set('q', String(params.q).trim());
      const q = qs.toString();
      return baseApi.get(`/api/business/feed${q ? `?${q}` : ''}`);
    },
    create: (body) => baseApi.post('/api/business/feed', body),
    update: (id, body) => baseApi.patch(`/api/business/feed/${encodeURIComponent(id)}`, body),
    delete: (id) => baseApi.delete(`/api/business/feed/${encodeURIComponent(id)}`),
  },
  insights: (placeId) => baseApi.get(`/api/business/insights?placeId=${encodeURIComponent(placeId)}`),
  proposals: {
    list: (placeId) => baseApi.get(`/api/business/proposals?placeId=${encodeURIComponent(placeId)}`),
    update: (id, body) => baseApi.patch(`/api/business/proposals/${encodeURIComponent(id)}`, body),
  },
  messagingBlocks: {
    block: (placeId, inquiryId) => baseApi.post('/api/business/messaging-blocks', { placeId, inquiryId }),
    unblock: (placeId, inquiryId) => {
      const qs = new URLSearchParams({ placeId: String(placeId), inquiryId: String(inquiryId) });
      return baseApi.delete(`/api/business/messaging-blocks?${qs}`);
    },
  },
  promotions: {
    list: (placeId) => baseApi.get(`/api/business/promotions?placeId=${encodeURIComponent(placeId)}`),
    create: (body) => baseApi.post('/api/business/promotions', body),
    update: (id, body) => baseApi.patch(`/api/business/promotions/${encodeURIComponent(id)}`, body),
    delete: (id) => baseApi.delete(`/api/business/promotions/${encodeURIComponent(id)}`),
  },
  sponsorship: {
    config: () => baseApi.get('/api/business/sponsorship/config'),
    createCheckoutSession: (body) => baseApi.post('/api/business/sponsorship/checkout-session', body),
    sessionStatus: (sessionId) =>
      baseApi.get(`/api/business/sponsorship/session-status?session_id=${encodeURIComponent(sessionId)}`),
  },
};
