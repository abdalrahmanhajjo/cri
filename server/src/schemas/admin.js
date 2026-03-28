const { z } = require('zod');

const adminPlaceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(200),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  categoryId: z.string().min(1),
  category: z.string().optional().nullable(),
  searchName: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  price: z.string().optional().nullable(),
  bestTime: z.string().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  reviewCount: z.number().int().optional().nullable(),
  images: z.array(z.string()).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  hours: z.any().optional().nullable(),
});

const adminCategorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(100),
  icon: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  count: z.number().int().optional().nullable(),
  color: z.string().optional().nullable(),
  orderIdx: z.number().int().optional().nullable(),
});

const adminTourSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(200),
  description: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  duration: z.string().optional().nullable(),
  durationHours: z.number().int().optional().nullable(),
  locations: z.number().int().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  reviews: z.number().int().optional().nullable(),
  currency: z.string().optional().nullable(),
  priceDisplay: z.string().optional().nullable(),
  badge: z.string().optional().nullable(),
  badgeColor: z.string().optional().nullable(),
  difficulty: z.string().optional().nullable(),
  placeIds: z.array(z.string()).optional().nullable(),
  languages: z.array(z.string()).optional().nullable(),
  includes: z.array(z.string()).optional().nullable(),
  excludes: z.array(z.string()).optional().nullable(),
  highlights: z.array(z.string()).optional().nullable(),
  itinerary: z.array(z.any()).optional().nullable(),
});

const adminEventSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(200),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  organizer: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  priceDisplay: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  placeId: z.string().optional().nullable(),
});

const adminContentSchema = z.object({
  body: z.object({
    overrides: z.record(z.any()),
  }),
});

const adminUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email(),
    is_admin: z.boolean().optional(),
    is_business: z.boolean().optional(),
  }),
});

module.exports = {
  adminPlaceSchema,
  adminCategorySchema,
  adminTourSchema,
  adminEventSchema,
  adminContentSchema,
  adminUserSchema,
};
