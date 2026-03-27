const { z } = require('zod');

// --- Auth ---
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// --- Place ---
const placeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  categoryId: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const placeReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

module.exports = {
  loginSchema,
  registerSchema,
  placeSchema,
  placeReviewSchema
};
