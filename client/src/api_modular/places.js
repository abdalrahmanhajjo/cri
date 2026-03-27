import { apiBase } from './base';

export const placesApi = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return apiBase.get(`/api/places${q ? `?${q}` : ''}`);
  },
  get: (id, opts) => {
    const qs = new URLSearchParams();
    if (opts?.lang) qs.set('lang', String(opts.lang));
    const q = qs.toString();
    return apiBase.get(`/api/places/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
  },
  promotions: (id) => apiBase.get(`/api/places/${encodeURIComponent(id)}/promotions`),
  reviews: (id) => apiBase.get(`/api/places/${encodeURIComponent(id)}/reviews`),
  submitReview: (id, body) => apiBase.post(`/api/places/${encodeURIComponent(id)}/reviews`, body || {}),
  deleteReview: (placeId, reviewId) => apiBase.delete(`/api/places/${encodeURIComponent(placeId)}/reviews/${reviewId}`),
  patchReview: (placeId, reviewId, body) => apiBase.patch(`/api/places/${encodeURIComponent(placeId)}/reviews/${reviewId}`, body),
  checkin: (id, body) => apiBase.post(`/api/places/${encodeURIComponent(id)}/checkin`, body || {}),
  inquiry: (id, body) => apiBase.post(`/api/places/${encodeURIComponent(id)}/inquiries`, body),
  inquiryStatus: (placeId, inquiryId, email) => {
    const qs = new URLSearchParams();
    if (email) qs.set('email', email);
    qs.set('_', String(Date.now()));
    return apiBase.get(`/api/places/${encodeURIComponent(placeId)}/inquiries/${inquiryId}?${qs.toString()}`);
  },
  inquiryFollowUp: (placeId, inquiryId, body) => apiBase.post(`/api/places/${encodeURIComponent(placeId)}/inquiries/${inquiryId}/follow-up`, body),
};

export const publicContentApi = {
  tours: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return apiBase.get(`/api/tours${q ? `?${q}` : ''}`);
    },
    get: (id) => apiBase.get(`/api/tours/${id}`),
  },
  events: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return apiBase.get(`/api/events${q ? `?${q}` : ''}`);
    },
    get: (id) => apiBase.get(`/api/events/${id}`),
  },
  categories: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return apiBase.get(`/api/categories${q ? `?${q}` : ''}`);
    },
  },
  interests: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return apiBase.get(`/api/interests${q ? `?${q}` : ''}`);
    },
  },
};
