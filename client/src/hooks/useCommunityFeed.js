import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import api from '../api';

export function useCommunityFeed(params = {}) {
  const { enabled = true, ...queryParams } = params;
  return useQuery({
    queryKey: ['communityFeed', queryParams],
    queryFn: () => api.feed.list(queryParams),
    enabled,
  });
}

export function useInfiniteCommunityFeed(params = {}) {
  return useInfiniteQuery({
    queryKey: ['communityFeed', 'infinite', params],
    queryFn: ({ pageParam = 0 }) => 
      api.feed.list({ ...params, offset: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      const currentOffset = allPages.length * (params.limit || 12);
      return lastPage.posts?.length > 0 && lastPage.hasMore !== false ? currentOffset : undefined;
    },
    initialPageParam: 0,
  });
}

export function useFeedPost(id) {
  return useQuery({
    queryKey: ['feedPost', id],
    queryFn: () => api.feed.post(id),
    enabled: !!id,
  });
}

export function useFeedComments(postId) {
  return useQuery({
    queryKey: ['feedPost', postId, 'comments'],
    queryFn: () => api.feedPublic.comments(postId),
    enabled: !!postId,
  });
}
