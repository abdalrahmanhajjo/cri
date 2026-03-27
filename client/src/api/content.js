import { http } from './http';

export const toursApi = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return http.get(`/api/tours${q ? `?${q}` : ''}`);
  },
  get: (id) => http.get(`/api/tours/${id}`),
};

export const eventsApi = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return http.get(`/api/events${q ? `?${q}` : ''}`);
  },
  get: (id) => http.get(`/api/events/${id}`),
};

export const categoriesApi = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return http.get(`/api/categories${q ? `?${q}` : ''}`);
  },
};

export const interestsApi = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return http.get(`/api/interests${q ? `?${q}` : ''}`);
  },
};
