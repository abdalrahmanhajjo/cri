const { z } = require('zod');

const adminPlaceSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  categoryId: z.number().int().positive(),
  images: z.array(z.string()).optional(),
  searchName: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
});

const adminCategorySchema = z.object({
  name: z.string().min(2).max(100),
  icon: z.string().optional(),
  orderIdx: z.number().int().optional(),
});

const adminTourSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  image: z.string().optional(),
  price: z.number().optional(),
  duration: z.string().optional(),
});

const adminEventSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().optional(), // Or use z.coerce.date()
  endDate: z.string().optional(),
  image: z.string().optional(),
  status: z.string().optional(),
});

module.exports = {
  adminPlaceSchema,
  adminCategorySchema,
  adminTourSchema,
  adminEventSchema,
};
