import { baseApi } from './base';

export const communityFeed = (params) => {
  const qs = new URLSearchParams();
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
  }
  const q = qs.toString();
  return baseApi.get(`/api/feed${q ? `?${q}` : ''}`);
};

export const feedPublic = {
  post: (postId) => baseApi.get(`/api/feed/post/${encodeURIComponent(postId)}`),
  comments: (postId) => baseApi.get(`/api/feed/post/${encodeURIComponent(postId)}/comments`),
  addComment: (postId, bodyOrPayload) => {
    const payload = typeof bodyOrPayload === 'string' ? { body: bodyOrPayload } : bodyOrPayload;
    return baseApi.post(`/api/feed/post/${encodeURIComponent(postId)}/comments`, payload);
  },
  toggleLike: (postId) => baseApi.post(`/api/feed/post/${encodeURIComponent(postId)}/like`),
  toggleSave: (postId) => baseApi.post(`/api/feed/post/${encodeURIComponent(postId)}/save`),
  toggleCommentLike: (postId, commentId) =>
    baseApi.post(`/api/feed/post/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/like`),
  updateComment: (postId, commentId, body) =>
    baseApi.patch(`/api/feed/post/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, { body }),
  deleteComment: (postId, commentId) =>
    baseApi.delete(`/api/feed/post/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`),
};
