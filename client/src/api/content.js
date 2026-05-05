import { baseApi } from './base';

export const places = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return baseApi.get(`/api/places${q ? `?${q}` : ''}`);
  },
  get: (id, opts) => {
    const qs = new URLSearchParams();
    if (opts && opts.lang) qs.set('lang', String(opts.lang));
    const q = qs.toString();
    return baseApi.get(`/api/places/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
  },
  promotions: (id, opts) => {
    const qs = new URLSearchParams();
    if (opts?.lang) qs.set('lang', String(opts.lang));
    const q = qs.toString();
    return baseApi.get(`/api/places/${encodeURIComponent(id)}/promotions${q ? `?${q}` : ''}`);
  },
  reviews: (id) => baseApi.get(`/api/places/${encodeURIComponent(id)}/reviews`),
  submitReview: (id, body) => baseApi.post(`/api/places/${encodeURIComponent(id)}/reviews`, body || {}),
  deleteReview: (placeId, reviewId) =>
    baseApi.delete(`/api/places/${encodeURIComponent(placeId)}/reviews/${encodeURIComponent(String(reviewId))}`),
  patchReview: (placeId, reviewId, body) =>
    baseApi.patch(`/api/places/${encodeURIComponent(placeId)}/reviews/${encodeURIComponent(String(reviewId))}`, body),
  checkin: (id, body) => baseApi.post(`/api/places/${encodeURIComponent(id)}/checkin`, body || {}),
  inquiry: (id, body) => baseApi.post(`/api/places/${encodeURIComponent(id)}/inquiries`, body),
  inquiryStatus: (placeId, inquiryId, email) => {
    const qs = new URLSearchParams();
    if (email && String(email).trim()) qs.set('email', String(email).trim());
    qs.set('_', String(Date.now()));
    return baseApi.get(`/api/places/${encodeURIComponent(placeId)}/inquiries/${encodeURIComponent(String(inquiryId))}?${qs}`);
  },
  inquiryFollowUp: (placeId, inquiryId, body) =>
    baseApi.post(`/api/places/${encodeURIComponent(placeId)}/inquiries/${encodeURIComponent(String(inquiryId))}/follow-up`, body),
};

export const tours = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return baseApi.get(`/api/tours${q ? `?${q}` : ''}`);
  },
  get: (id) => baseApi.get(`/api/tours/${id}`),
};

export const events = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return baseApi.get(`/api/events${q ? `?${q}` : ''}`);
  },
  get: (id) => baseApi.get(`/api/events/${id}`),
};

export const categories = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return baseApi.get(`/api/categories${q ? `?${q}` : ''}`);
  },
};

export const interests = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return baseApi.get(`/api/interests${q ? `?${q}` : ''}`);
  },
};

export const publicPromotions = (params) => {
  const qs = new URLSearchParams();
  if (params?.limit != null && params.limit !== '') qs.set('limit', String(params.limit));
  if (params?.lang) qs.set('lang', String(params.lang));
  const q = qs.toString();
  return baseApi.get(`/api/promotions${q ? `?${q}` : ''}`);
};
