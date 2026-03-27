import { http } from './http';

export const adminApi = {
  stats: () => http.get('/api/admin/stats'),
  upload: (file) => http.upload('/api/admin/upload', file),
  places: {
    list: (p) => http.get('/api/admin/places', { params: p }),
    create: (body) => http.post('/api/admin/places', body),
    update: (id, body) => http.put(`/api/admin/places/${id}`, body),
    delete: (id) => http.delete(`/api/admin/places/${id}`),
    reviews: (id) => http.get(`/api/admin/places/${id}/reviews`),
  },
  users: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return http.get(`/api/admin/users${q ? `?${q}` : ''}`);
    },
    update: (id, body) => http.patch(`/api/admin/users/${id}`, body),
    delete: (id) => http.delete(`/api/admin/users/${id}`),
  },
  categories: {
    update: (id, body) => http.put(`/api/admin/categories/${id}`, body),
    create: (body) => http.post('/api/admin/categories', body),
    delete: (id) => http.delete(`/api/admin/categories/${id}`),
  },
  events: {
    list: () => http.get('/api/admin/events'),
    update: (id, body) => http.put(`/api/admin/events/${id}`, body),
    create: (body) => http.post('/api/admin/events', body),
    delete: (id) => http.delete(`/api/admin/events/${id}`),
  },
  tours: {
    list: () => http.get('/api/admin/tours'),
    update: (id, body) => http.put(`/api/admin/tours/${id}`, body),
    create: (body) => http.post('/api/admin/tours', body),
    delete: (id) => http.delete(`/api/admin/tours/${id}`),
  },
  content: {
    get: () => http.get('/api/admin/content'),
    update: (body) => http.put('/api/admin/content', body),
  },
  siteSettings: {
    get: () => http.get('/api/admin/site-settings'),
    update: (body) => http.put('/api/admin/site-settings', body),
  },
  placeOwners: {
    list: (params) => http.get('/api/admin/place-owners', { params }),
    add: (body) => http.post('/api/admin/place-owners', body),
    remove: (userId, placeId) => http.delete(`/api/admin/place-owners/${userId}/${placeId}`),
  },
  allTrips: {
    list: (params) => http.get('/api/admin/all-trips', { params }),
  }
};
