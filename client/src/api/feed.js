import { http } from './http';
import { adaptFeedPost } from './schemas';

export const feedApi = {
  list: async (params) => {
    const q = new URLSearchParams(params).toString();
    const res = await http.get(`/api/feed${q ? `?${q}` : ''}`);
    if (res.posts) res.posts = res.posts.map(adaptFeedPost);
    return res;
  },
  post: async (postId) => {
    const res = await http.get(`/api/feed/post/${encodeURIComponent(postId)}`);
    return adaptFeedPost(res);
  },
  comments: (postId) => http.get(`/api/feed/post/${encodeURIComponent(postId)}/comments`),
  addComment: (postId, bodyOrPayload) => {
    const payload = typeof bodyOrPayload === 'string' ? { body: bodyOrPayload } : bodyOrPayload;
    return http.post(`/api/feed/post/${encodeURIComponent(postId)}/comments`, payload);
  },
  toggleLike: (postId) => http.post(`/api/feed/post/${encodeURIComponent(postId)}/like`),
  toggleSave: (postId) => http.post(`/api/feed/post/${encodeURIComponent(postId)}/save`),
  toggleCommentLike: (postId, commentId) => http.post(`/api/feed/post/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/like`),
  updateComment: (postId, commentId, body) => http.patch(`/api/feed/post/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, { body }),
  deleteComment: (postId, commentId) => http.delete(`/api/feed/post/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`),
};
