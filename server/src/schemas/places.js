const { z } = require('zod');

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional().nullable(),
  review: z.string().max(8000).optional().nullable(),
});

const checkinSchema = z.object({
  note: z.string().max(500).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

const inquirySchema = z.object({
  message: z.string().min(3).max(8000),
  intent: z.enum(['booking', 'event', 'general']).optional().default('general'),
  guestName: z.string().max(200).optional().nullable(),
  guestEmail: z.string().email().max(320).optional().nullable(),
  guestPhone: z.string().min(8).max(40),
});

const inquiryFollowupSchema = z.object({
  message: z.string().min(3).max(8000),
  guestEmail: z.string().email().optional().nullable(),
});

module.exports = {
  reviewSchema,
  checkinSchema,
  inquirySchema,
  inquiryFollowupSchema,
};
