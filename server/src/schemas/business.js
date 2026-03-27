const { z } = require('zod');

const businessPlaceSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(60000).optional(),
    location: z.string().max(500).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    searchName: z.string().max(255).optional(),
    search_name: z.string().max(255).optional(),
    images: z.array(z.string().url().or(z.string().regex(/^\//))).max(50).optional(),
    category: z.string().max(200).optional(),
    categoryId: z.string().max(100).optional(),
    category_id: z.string().max(100).optional(),
    duration: z.string().max(120).optional(),
    price: z.string().max(120).optional(),
    bestTime: z.string().max(200).optional(),
    best_time: z.string().max(200).optional(),
    rating: z.number().min(0).max(5).nullable().optional(),
    reviewCount: z.number().int().nonnegative().nullable().optional(),
    review_count: z.number().int().nonnegative().nullable().optional(),
    hours: z.record(z.any()).nullable().optional(),
    tags: z.array(z.string().max(100)).max(80).optional(),
  }),
});

const businessTranslationSchema = z.object({
  body: z.object({
    name: z.string().max(255).optional().nullable(),
    description: z.string().max(60000).optional().nullable(),
    location: z.string().max(500).optional().nullable(),
    category: z.string().max(200).optional().nullable(),
    duration: z.string().max(120).optional().nullable(),
    price: z.string().max(120).optional().nullable(),
    bestTime: z.string().max(200).optional().nullable(),
    best_time: z.string().max(200).optional().nullable(),
    tags: z.array(z.string().max(100)).max(80).optional(),
  }),
});

module.exports = {
  businessPlaceSchema,
  businessTranslationSchema,
};
