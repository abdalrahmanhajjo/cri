const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

/** GET /api/admin/sponsorship-purchases — recent self-serve purchases (support). */
router.get('/', async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '40'), 10) || 40));
  try {
    const spColl = await getCollection('sponsorship_purchases');
    const rows = await spColl.aggregate([
      { $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place'
      }},
      { $unwind: '$place' },
      { $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
      }},
      { $addFields: {
          user_email: { $arrayElemAt: ['$user.email', 0] }
      }},
      { $sort: { created_at: -1 } },
      { $limit: limit }
    ]).toArray();

    res.json({
      items: rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        userEmail: r.user_email || null,
        placeId: String(r.place_id),
        placeName: r.place.name || '',
        status: r.status,
        stripeCheckoutSessionId: r.stripe_checkout_session_id || null,
        stripePaymentIntentId: r.stripe_payment_intent_id || null,
        amountCents: r.amount_cents != null ? Number(r.amount_cents) : 0,
        currency: r.currency || 'usd',
        durationDays: r.duration_days != null ? Number(r.duration_days) : 30,
        surface: r.surface || 'all',
        startsAt: r.starts_at || null,
        endsAt: r.ends_at || null,
        sponsoredPlaceId: r.sponsored_place_id ? String(r.sponsored_place_id) : null,
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load sponsorship purchases' });
  }
});

module.exports = router;
