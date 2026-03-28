import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.admin.stats(),
  });
}

export function useAdminPlaces(params) {
  return useQuery({
    queryKey: ['admin', 'places', params],
    queryFn: () => api.admin.places.list(params),
  });
}

export function useAdminUsers(params) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.admin.users.list(params),
  });
}

export function useAdminFeed(params) {
  return useQuery({
    queryKey: ['admin', 'feed', params],
    queryFn: () => api.admin.feed.list(params),
  });
}

export function useAdminFeedComments(postId) {
  return useQuery({
    queryKey: ['admin', 'feed', postId, 'comments'],
    queryFn: () => api.admin.feed.comments(postId),
    enabled: !!postId,
  });
}

export function useCreateAdminPostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.admin.feed.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feed'] });
    },
  });
}

export function useUpdateAdminPostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.admin.feed.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feed'] });
    },
  });
}

export function useDeleteAdminPostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.admin.feed.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feed'] });
    },
  });
}

export function useDeleteAdminCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.admin.feed.deleteComment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feed'] });
    },
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.admin.siteSettings.get(),
  });
}

export function useUpdateAdminSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.admin.siteSettings.save(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });
}

export function useAdminContent() {
  return useQuery({
    queryKey: ['admin', 'content'],
    queryFn: () => api.admin.content.get(),
  });
}

export function useUpdateAdminContentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.admin.content.save(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'content'] });
    },
  });
}

export function useAdminPlaceReviews(placeId) {
  return useQuery({
    queryKey: ['admin', 'places', placeId, 'reviews'],
    queryFn: () => api.admin.places.reviews(placeId),
    enabled: !!placeId,
  });
}

export function useUpdateAdminPlaceReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ placeId, reviewId, body }) => api.places.patchReview(placeId, reviewId, body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'places', variables.placeId, 'reviews'] });
    },
  });
}

export function useDeleteAdminPlaceReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ placeId, reviewId }) => api.places.deleteReview(placeId, reviewId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'places', variables.placeId, 'reviews'] });
    },
  });
}

export function useCreateAdminPlaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.admin.places.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'places'] });
      queryClient.invalidateQueries({ queryKey: ['places'] });
    },
  });
}

export function useUpdateAdminPlaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.admin.places.update(id, body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'places'] });
      queryClient.invalidateQueries({ queryKey: ['places'] });
      queryClient.invalidateQueries({ queryKey: ['places', variables.id] });
    },
  });
}

export function useDeleteAdminPlaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.admin.places.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'places'] });
      queryClient.invalidateQueries({ queryKey: ['places'] });
    },
  });
}

export function useAdminPlaceDetail(id) {
  return useQuery({
    queryKey: ['admin', 'places', id, 'detail'],
    queryFn: () => api.places.get(id),
    enabled: !!id,
  });
}

export function useAdminUploadMutation() {
  return useMutation({
    mutationFn: (file) => api.admin.upload(file),
  });
}

export function useAdminEvents() {
  return useQuery({
    queryKey: ['admin', 'events'],
    queryFn: () => api.admin.events.list(),
  });
}

export function useCreateAdminEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.admin.events.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateAdminEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.admin.events.update(id, body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', variables.id] });
    },
  });
}

export function useDeleteAdminEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.admin.events.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateAdminUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.admin.users.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useDeleteAdminUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.admin.users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useUpdateAdminCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.admin.categories.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useCreateAdminCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.admin.categories.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteAdminCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.admin.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateAdminInterestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.admin.interests.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interests'] });
    },
  });
}

export function useCreateAdminInterestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.admin.interests.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interests'] });
    },
  });
}

export function useDeleteAdminInterestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.admin.interests.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interests'] });
    },
  });
}

export function useAdminPlaceOwners() {
  return useQuery({
    queryKey: ['admin', 'place-owners'],
    queryFn: () => api.admin.place_owners.list(),
  });
}

export function useApprovePlaceOwnerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.admin.place_owners.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'place-owners'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useRejectPlaceOwnerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.admin.place_owners.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'place-owners'] });
    },
  });
}

export function useDeletePlaceOwnerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.admin.place_owners.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'place-owners'] });
    },
  });
}

export function useAddPlaceOwnerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.admin.placeOwners.add(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'place-owners'] });
    },
  });
}

export function useRemovePlaceOwnerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, placeId }) => api.admin.placeOwners.remove(userId, placeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'place-owners'] });
    },
  });
}

export function useAdminExperiences() {
  return useQuery({
    queryKey: ['admin', 'experiences'],
    queryFn: () => api.tours.list(),
  });
}

export function useCreateAdminExperienceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.admin.tours.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'experiences'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
    },
  });
}

export function useUpdateAdminExperienceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.admin.tours.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'experiences'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
    },
  });
}

export function useDeleteAdminExperienceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.admin.tours.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'experiences'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
    },
  });
}

export function useAdminUserTrips(params = {}) {
  return useQuery({
    queryKey: ['admin', 'user-trips', params],
    queryFn: () => api.admin.allTrips.list(params),
  });
}

export function useAdminInterests(params = {}) {
  return useQuery({
    queryKey: ['admin', 'interests', params],
    queryFn: () => api.admin.interests.list(params),
  });
}

export function useCreateAdminInterestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.admin.interests.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'interests'] });
    },
  });
}

export function useUpdateAdminInterestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.admin.interests.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'interests'] });
    },
  });
}

export function useDeleteAdminInterestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.admin.interests.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'interests'] });
    },
  });
}

export function useAdminCategories(params = {}) {
  return useQuery({
    queryKey: ['admin', 'categories', params],
    queryFn: () => api.admin.categories.list(params),
  });
}
