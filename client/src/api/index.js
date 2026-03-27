import { authApi } from './auth';
import { placesApi } from './places';
import { adminApi } from './admin';
import { userApi } from './user';
import { businessApi } from './business';
import { feedApi } from './feed';
import { toursApi, eventsApi, categoriesApi, interestsApi } from './content';
import { miscellaneousApi } from './misc';
import { 
  getToken, setToken, getSessionCode, setSessionCode, 
  getStoredUser, setStoredUser, clearAuthStorageAndNotify, getBaseUrl,
  apiFetch as request
} from './http';
import { getImageUrl, getPlaceImageUrl, getImageUrlAlternate, fixImageUrlExtension, generateSessionCode } from './utils';

const api = {
  auth: authApi,
  places: placesApi,
  tours: toursApi,
  events: eventsApi,
  categories: categoriesApi,
  interests: interestsApi,
  admin: adminApi,
  business: businessApi,
  user: userApi,
  feed: feedApi,
  siteSettings: miscellaneousApi.siteSettings,
  publicPromotions: miscellaneousApi.promotions,
  coupons: miscellaneousApi.coupons,
  feedPublic: feedApi, // Aliased for compatibility
};

export {
  api as default,
  api,
  authApi,
  placesApi,
  adminApi,
  userApi,
  businessApi,
  feedApi,
  toursApi,
  eventsApi,
  categoriesApi,
  interestsApi,
  getToken,
  setToken,
  getSessionCode,
  setSessionCode,
  getStoredUser,
  setStoredUser,
  clearAuthStorageAndNotify,
  getBaseUrl,
  getImageUrl,
  getPlaceImageUrl,
  getImageUrlAlternate,
  fixImageUrlExtension,
  generateSessionCode,
  request
};

export const API_ERROR_NETWORK = 'NETWORK_ERROR';
export const DEFAULT_NETWORK_ERROR_MESSAGE = 'Unable to reach the server. Check your connection and try again.';
