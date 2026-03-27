import { useQuery } from '@tanstack/react-query';
import api from '../api';

export function usePlaces(params = {}) {
  const lang = params.lang || 'en';
  return useQuery({
    queryKey: ['places', lang, params],
    queryFn: () => api.places.list(params),
  });
}

export function usePlace(id, opts = {}) {
  return useQuery({
    queryKey: ['place', id, opts.lang],
    queryFn: () => api.places.get(id, opts),
    enabled: !!id,
  });
}

export function usePlacePromotions(id) {
  return useQuery({
    queryKey: ['place', id, 'promotions'],
    queryFn: () => api.places.promotions(id),
    enabled: !!id,
  });
}

export function usePlaceReviews(id) {
  return useQuery({
    queryKey: ['place', id, 'reviews'],
    queryFn: () => api.places.reviews(id),
    enabled: !!id,
  });
}
