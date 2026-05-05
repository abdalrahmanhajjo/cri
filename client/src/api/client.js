/**
 * Tripoli Explorer API Client
 * Modularized version - assembles specialized modules into a single api object.
 */

import { baseApi } from './base';
import { auth } from './auth';
import { 
  places, 
  tours, 
  events, 
  categories, 
  interests, 
  publicPromotions 
} from './content';
import { user, coupons } from './user';
import { communityFeed, feedPublic } from './social';
import { admin } from './admin';
import { business } from './business';
import { ai } from './ai';

export * from './base';

export const api = {
  ...baseApi,
  siteSettings: () => baseApi.get('/api/site-settings'),
  auth,
  places,
  tours,
  events,
  categories,
  interests,
  admin,
  business,
  ai,
  communityFeed,
  feedPublic,
  publicPromotions,
  coupons,
  user,
};

export default api;
