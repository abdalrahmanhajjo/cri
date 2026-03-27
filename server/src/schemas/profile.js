const { z } = require('zod');

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid username format').optional(),
    city: z.string().max(100).optional().nullable(),
    bio: z.string().max(500).optional().nullable(),
    mood: z.enum(['mixed', 'relaxed', 'active', 'cultural', 'foodie']).optional(),
    pace: z.enum(['slow', 'normal', 'fast']).optional(),
    analytics: z.boolean().optional(),
    showTips: z.boolean().optional(),
  }),
});

const updateAccountSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').optional(),
    email: z.string().email('Invalid email address').optional(),
  }),
});

module.exports = {
  updateProfileSchema,
  updateAccountSchema,
};
