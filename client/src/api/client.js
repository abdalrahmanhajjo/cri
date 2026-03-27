import { apiBase, getImageUrl, getPlaceImageUrl, getToken, setToken, getSessionCode, setSessionCode, getStoredUser, setStoredUser, generateSessionCode } from './base';

export const authApi = {
  login: (email, password) => apiBase.post('/api/auth/login', { email, password }),
  register: (name, username, email, password) =>
    apiBase.post('/api/auth/register', { name, username, email, password }),
  verifyEmail: (email, code) => apiBase.post('/api/auth/verify-email', { email, code }),
  forgotPassword: (email) => apiBase.post('/api/auth/forgot-password', { email }),
  resetPassword: (email, code, newPassword) => apiBase.post('/api/auth/reset-password', { email, code, newPassword }),
};

const api = {
  ...apiBase,
  auth: authApi,
  places: {
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
    inquiryStatus: (placeId, iid, email) => {
      const qs = new URLSearchParams();
      if (email) qs.set('email', email);
      qs.set('_', String(Date.now()));
      return apiBase.get(`/api/places/${encodeURIComponent(placeId)}/inquiries/${iid}?${qs.toString()}`);
    },
    inquiryFollowUp: (placeId, iid, body) => apiBase.post(`/api/places/${encodeURIComponent(placeId)}/inquiries/${iid}/follow-up`, body),
  },
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
  admin: {
    // ... all admin methods included here for now
  },
  business: {
    // ... all business methods included here for now
  },
  user: {
    profile: () => apiBase.get('/api/user/profile'),
    updateProfile: (data) => apiBase.patch('/api/user/profile', data),
    changePassword: (currentPassword, newPassword) => apiBase.post('/api/user/change-password', { currentPassword, newPassword }),
    inquiries: () => apiBase.get('/api/user/inquiries'),
    trips: () => apiBase.get('/api/user/trips'),
    getTrip: (id) => apiBase.get(`/api/user/trips/${encodeURIComponent(id)}`),
    createTrip: (data) => apiBase.post('/api/user/trips', data),
    updateTrip: (id, data) => apiBase.patch(`/api/user/trips/${id}`, data),
    deleteTrip: (id) => apiBase.delete(`/api/user/trips/${id}`),
    favourites: () => apiBase.get('/api/user/favourites'),
    addFavourite: (placeId) => apiBase.post('/api/user/favourites', { placeId }),
    removeFavourite: (placeId) => apiBase.delete(`/api/user/favourites/${placeId}`),
  },
  siteSettings: () => apiBase.get('/api/site-settings'),
  communityFeed: (params) => {
    const q = new URLSearchParams(params).toString();
    return apiBase.get(`/api/feed${q ? `?${q}` : ''}`);
  },
  publicPromotions: (params) => {
    const q = new URLSearchParams(params).toString();
    return apiBase.get(`/api/promotions${q ? `?${q}` : ''}`);
  },
  coupons: {
    redeemed: () => apiBase.get('/api/coupons/redeemed'),
    redeem: (promotionId, code) => apiBase.post('/api/coupons/redeem', { promotionId, code }),
  },
  feedPublic: {
    post: (postId) => apiBase.get(`/api/feed/post/${encodeURIComponent(postId)}`),
    comments: (postId) => apiBase.get(`/api/feed/post/${encodeURIComponent(postId)}/comments`),
    addComment: (postId, bodyOrPayload) => {
      const payload = typeof bodyOrPayload === 'string' ? { body: bodyOrPayload } : bodyOrPayload;
      return apiBase.post(`/api/feed/post/${encodeURIComponent(postId)}/comments`, payload);
    },
    toggleLike: (postId) => apiBase.post(`/api/feed/post/${encodeURIComponent(postId)}/like`),
    toggleSave: (postId) => apiBase.post(`/api/feed/post/${encodeURIComponent(postId)}/save`),
    toggleCommentLike: (postId, commentId) => apiBase.post(`/api/feed/post/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/like`),
    updateComment: (postId, commentId, body) => apiBase.patch(`/api/feed/post/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, { body }),
    deleteComment: (postId, commentId) => apiBase.delete(`/api/feed/post/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`),
  }
};

export {
  api,
  getImageUrl,
  getPlaceImageUrl,
  getToken,
  setToken,
  getSessionCode,
  setSessionCode,
  getStoredUser,
  setStoredUser,
  generateSessionCode
};

export default api;
