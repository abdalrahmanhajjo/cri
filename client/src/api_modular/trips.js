import { apiBase } from './base';

export const userProfileApi = {
  profile: () => apiBase.get('/api/user/profile'),
  updateProfile: (data) => apiBase.patch('/api/user/profile', data),
  changePassword: (currentPassword, newPassword) => apiBase.post('/api/user/change-password', { currentPassword, newPassword }),
  inquiries: () => apiBase.get('/api/user/inquiries'),
  favourites: () => apiBase.get('/api/user/favourites'),
  addFavourite: (placeId) => apiBase.post('/api/user/favourites', { placeId }),
  removeFavourite: (placeId) => apiBase.delete(`/api/user/favourites/${placeId}`),
};

export const userTripsApi = {
  trips: () => apiBase.get('/api/user/trips'),
  getTrip: (id) => apiBase.get(`/api/user/trips/${encodeURIComponent(id)}`),
  createTrip: (data) => apiBase.post('/api/user/trips', data),
  updateTrip: (id, data) => apiBase.patch(`/api/user/trips/${id}`, data),
  deleteTrip: (id) => apiBase.delete(`/api/user/trips/${id}`),
};
