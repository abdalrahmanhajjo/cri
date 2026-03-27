import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export function useToggleLikeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId) => api.feedPublic.toggleLike(postId),
    onSuccess: (data, postId) => {
      queryClient.invalidateQueries({ queryKey: ['communityFeed'] });
      queryClient.invalidateQueries({ queryKey: ['feedPost', postId] });
    },
  });
}

export function useToggleSaveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId) => api.feedPublic.toggleSave(postId),
    onSuccess: (data, postId) => {
      queryClient.invalidateQueries({ queryKey: ['communityFeed'] });
      queryClient.invalidateQueries({ queryKey: ['feedPost', postId] });
    },
  });
}

export function useAddCommentMutation(postId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.feedPublic.addComment(postId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedPost', postId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['communityFeed'] });
    },
  });
}

export function useDeleteCommentMutation(postId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId) => api.feedPublic.deleteComment(postId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedPost', postId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['communityFeed'] });
    },
  });
}

export function useUpdateCommentMutation(postId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }) => api.feedPublic.updateComment(postId, commentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedPost', postId, 'comments'] });
    },
  });
}

export function useToggleCommentLikeMutation(postId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId) => api.feedPublic.toggleCommentLike(postId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedPost', postId, 'comments'] });
    },
  });
}

export function useUpdatePostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, body }) => api.business.feed.update(postId, body),
    onSuccess: (data, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ['communityFeed'] });
      queryClient.invalidateQueries({ queryKey: ['feedPost', postId] });
    },
  });
}

export function useDeletePostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId) => api.business.feed.delete(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communityFeed'] });
    },
  });
}
