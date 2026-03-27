import { z } from 'zod';

// --- Auth ---
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// --- Place ---
export const placeSchema = z.object({
  id: z.string().or(z.number()),
  name: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  categoryId: z.number().optional(),
  image: z.string().optional(),
  rating: z.number().optional(),
});

export const placeReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

// --- User ---
export const userProfileSchema = z.object({
  id: z.string().or(z.number()),
  email: z.string().email(),
  name: z.string(),
  isAdmin: z.boolean().optional(),
  isBusinessOwner: z.boolean().optional(),
});
