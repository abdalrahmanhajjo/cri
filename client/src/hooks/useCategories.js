import { useQuery } from '@tanstack/react-query';
import api from '../api';

export function useCategories(params = {}) {
  const lang = params.lang || 'en';
  return useQuery({
    queryKey: ['categories', lang],
    queryFn: () => api.categories.list(params),
  });
}
