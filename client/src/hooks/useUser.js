import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export function useUserFavourites() {
  return useQuery({
    queryKey: ['user', 'favourites'],
    queryFn: () => api.user.favourites(),
  });
}

export function useUserProfile() {
  return useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => api.user.profile(),
  });
}

export function useBusinessMe() {
  return useQuery({
    queryKey: ['user', 'businessMe'],
    queryFn: () => api.business.me(),
  });
}

export function useToggleFavourite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFavourite }) => 
      isFavourite ? api.user.removeFavourite(id) : api.user.addFavourite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'favourites'] });
    },
  });
}

export function useRedeemedCoupons() {
  return useQuery({
    queryKey: ['user', 'coupons', 'redeemed'],
    queryFn: () => api.coupons.redeemed(),
  });
}
