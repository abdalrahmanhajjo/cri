import { http } from './http';

export const userApi = {
  profile: () => http.get('/api/user/profile'),
  updateProfile: (data) => http.patch('/api/user/profile', data),
  changePassword: (currentPassword, newPassword) => http.post('/api/user/change-password', { currentPassword, newPassword }),
  inquiries: () => http.get('/api/user/inquiries'),
  trips: () => http.get('/api/user/trips'),
  getTrip: (id) => http.get(`/api/user/trips/${encodeURIComponent(id)}`),
  createTrip: (data) => http.post('/api/user/trips', data),
  updateTrip: (id, data) => http.patch(`/api/user/trips/${id}`, data),
  deleteTrip: (id) => http.delete(`/api/user/trips/${id}`),
  favourites: () => http.get('/api/user/trips/favourites'),
  addFavourite: (placeId) => http.post('/api/user/trips/favourites', { placeId }),
  removeFavourite: (placeId) => http.delete(`/api/user/trips/favourites/${placeId}`),
};
