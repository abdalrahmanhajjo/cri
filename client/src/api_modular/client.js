import { apiBase, getImageUrl, getPlaceImageUrl, getToken, setToken, getSessionCode, setSessionCode, getStoredUser, setStoredUser, generateSessionCode } from './base';
import { authApi } from './auth';
import { placesApi, publicContentApi } from './places';
import { userTripsApi, userProfileApi } from './trips';
import { adminApi, businessApi } from './admin';

const api = {
  ...apiBase,
  auth: authApi,
  places: placesApi,
  tours: publicContentApi.tours,
  events: publicContentApi.events,
  categories: publicContentApi.categories,
  interests: publicContentApi.interests,
  admin: adminApi,
  business: businessApi,
  user: {
    ...userProfileApi,
    ...userTripsApi,
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
