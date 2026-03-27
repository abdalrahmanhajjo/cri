import { http } from './http';

export const businessApi = {
  me: () => http.get('/api/business/me'),
  upload: (file, placeId) => http.upload('/api/business/upload', file, { placeId }),
  places: {
    get: (id) => http.get(`/api/business/places/${id}`),
    update: (id, body) => http.put(`/api/business/places/${id}`, body),
    reviews: (id) => http.get(`/api/business/places/${id}/reviews`),
  },
  translations: {
    list: (id) => http.get(`/api/business/places/${id}/translations`),
    save: (id, lang, body) => http.put(`/api/business/places/${id}/translations/${lang}`, body),
  }
};
