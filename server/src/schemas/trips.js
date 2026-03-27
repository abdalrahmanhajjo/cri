const { z } = require('zod');

const tripDaySchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  slots: z.array(z.object({
    id: z.string().optional(),
    placeId: z.string().min(1, 'Place ID is required'),
    suggestedTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
    dayIndex: z.number().int().min(0),
    reason: z.string().optional().nullable(),
  })).optional(),
});

const createTripSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Trip name is required').max(200),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    description: z.string().max(1000).optional().nullable(),
    days: z.array(tripDaySchema).optional(),
  }),
});

const updateTripSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    description: z.string().max(1000).optional().nullable(),
    days: z.array(tripDaySchema).optional(),
  }),
});

module.exports = {
  createTripSchema,
  updateTripSchema,
};
