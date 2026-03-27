import { z } from 'zod';
import { fixImageUrlExtension } from './utils';

// --- Base Models ---

export const PlaceSchema = z.object({
  id: z.coerce.string(),
  name: z.string().default('Untitled'),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  categoryId: z.number().optional().nullable(),
  categoryName: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  images: z.array(z.string()).optional().default([]),
  rating: z.coerce.number().optional().nullable().default(0),
  reviewCount: z.coerce.number().optional().default(0),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  isPromoted: z.boolean().optional().default(false),
});

export const UserSchema = z.object({
  id: z.coerce.string(),
  name: z.string(),
  email: z.string().email(),
  username: z.string().optional(),
  avatar: z.string().optional().nullable(),
  isAdmin: z.boolean().default(false),
  isBusinessOwner: z.boolean().default(false),
  emailVerified: z.boolean().default(false),
  onboardingCompleted: z.boolean().default(false),
});

export const FeedPostSchema = z.object({
  id: z.coerce.string(),
  content: z.string().optional().nullable(),
  media: z.array(z.string()).optional().default([]),
  createdAt: z.string(),
  user: z.preprocess((val) => val || {}, UserSchema.partial()),
  likesCount: z.coerce.number().default(0),
  commentsCount: z.coerce.number().default(0),
  isLiked: z.boolean().default(false),
});

// --- Adapters ---

/** Normalize place data from raw API response */
export function adaptPlace(raw) {
  if (!raw) return null;
  const p = {
    ...raw,
    // Handle snake_case from DB if needed
    categoryId: raw.categoryId ?? raw.category_id,
    categoryName: raw.categoryName ?? raw.category_name,
    reviewCount: raw.reviewCount ?? raw.review_count,
    isPromoted: raw.isPromoted ?? raw.is_promoted,
    image: fixImageUrlExtension(raw.image),
    images: (raw.images || []).map(fixImageUrlExtension),
  };
  return PlaceSchema.parse(p);
}

/** Normalize user data */
export function adaptUser(raw) {
  if (!raw) return null;
  const u = {
    ...raw,
    avatar: fixImageUrlExtension(raw.avatar),
  };
  return UserSchema.parse(u);
}

/** Normalize feed post */
export function adaptFeedPost(raw) {
  if (!raw) return null;
  const p = {
    ...raw,
    media: (raw.media || []).map(fixImageUrlExtension),
    user: adaptUser(raw.user),
  };
  return FeedPostSchema.parse(p);
}
