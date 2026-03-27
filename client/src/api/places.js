import { http } from './http';
import { adaptPlace } from './schemas';

export const placesApi = {
  list: async (params) => {
    const q = new URLSearchParams(params).toString();
    const res = await http.get(`/api/places${q ? `?${q}` : ''}`);
    if (res.popular) res.popular = res.popular.map(adaptPlace);
    if (res.locations) res.locations = res.locations.map(adaptPlace);
    return res;
  },
  get: async (id, opts) => {
    const qs = new URLSearchParams();
    if (opts?.lang) qs.set('lang', String(opts.lang));
    const q = qs.toString();
    const res = await http.get(`/api/places/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
    return adaptPlace(res);
  },
  promotions: (id) => http.get(`/api/places/${encodeURIComponent(id)}/promotions`),
  reviews: (id) => http.get(`/api/places/${encodeURIComponent(id)}/reviews`),
  submitReview: (id, body) => http.post(`/api/places/${encodeURIComponent(id)}/reviews`, body || {}),
  deleteReview: (placeId, reviewId) => http.delete(`/api/places/${encodeURIComponent(placeId)}/reviews/${reviewId}`),
  patchReview: (placeId, reviewId, body) => http.patch(`/api/places/${encodeURIComponent(placeId)}/reviews/${reviewId}`, body),
  checkin: (id, body) => http.post(`/api/places/${encodeURIComponent(id)}/checkin`, body || {}),
  inquiry: (id, body) => http.post(`/api/places/${encodeURIComponent(id)}/inquiries`, body),
  inquiryStatus: (placeId, iid, email) => {
    const qs = new URLSearchParams();
    if (email) qs.set('email', email);
    qs.set('_', String(Date.now()));
    return http.get(`/api/places/${encodeURIComponent(placeId)}/inquiries/${iid}?${qs.toString()}`);
  },
  inquiryFollowUp: (placeId, iid, body) => http.post(`/api/places/${encodeURIComponent(placeId)}/inquiries/${iid}/follow-up`, body),
};
