const express = require('express');
const { query } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

/** GET /api/admin/sponsorship-purchases — recent self-serve purchases (support). */
router.get('/', async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '40'), 10) || 40));
  try {
    const { rows } = await query(
      `SELECT sp.id, sp.user_id, sp.place_id, sp.status, sp.stripe_checkout_session_id, sp.stripe_payment_intent_id,
              sp.amount_cents, sp.currency, sp.duration_days, sp.surface, sp.starts_at, sp.ends_at,
              sp.created_at, sp.updated_at, sp.sponsored_place_id,
              p.name AS place_name, u.email AS user_email
       FROM sponsorship_purchases sp
       INNER JOIN places p ON p.id = sp.place_id
       LEFT JOIN users u ON u.id = sp.user_id
       ORDER BY sp.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({
      items: rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        userEmail: r.user_email || null,
        placeId: String(r.place_id),
        placeName: r.place_name || '',
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
    if (err.code === '42P01') return res.json({ items: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to load sponsorship purchases' });
  }
});

module.exports = router;
