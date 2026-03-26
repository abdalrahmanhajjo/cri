const express = require('express');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { sendDbAwareError } = require('../utils/dbHttpError');
const { COUPON_ACTIVE } = require('../utils/activeOfferFilters');

const router = express.Router();
router.use(authMiddleware);

function normalizeCode(s) {
  return String(s ?? '').trim().toUpperCase();
}

function parseCouponPromotionId(promotionId) {
  const raw = String(promotionId ?? '').trim();
  if (!raw.startsWith('coupon-')) {
    return { ok: false, error: 'Only coupons can be redeemed here. Use place offers at the venue.' };
  }
  const uuid = raw.slice('coupon-'.length);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    return { ok: false, error: 'Invalid coupon.' };
  }
  return { ok: true, uuid };
}

/** GET /api/coupons/redeemed — coupon UUIDs the current user has redeemed (for UI badges). */
router.get('/redeemed', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rows } = await query(
      'SELECT coupon_id::text AS id FROM coupon_redemptions WHERE user_id = $1',
      [userId]
    );
    res.json({ couponIds: rows.map((r) => r.id) });
  } catch (err) {
    if (err.code === '42P01') return res.json({ couponIds: [] });
    sendDbAwareError(res, err, 'Failed to load redemptions');
  }
});

/**
 * POST /api/coupons/redeem
 * Body: { promotionId: "coupon-<uuid>", code: "<user-entered code>" }
 * Same validation as public listings (active window + global usage_limit) and code must match (case-insensitive).
 */
router.post('/redeem', async (req, res) => {
  const userId = req.user.userId;
  const parsed = parseCouponPromotionId(req.body?.promotionId);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error, code: 'NOT_COUPON' });
  }

  const code = normalizeCode(req.body?.code);
  if (!code) {
    return res.status(400).json({ error: 'Enter the coupon code.', code: 'CODE_REQUIRED' });
  }

  const { uuid } = parsed;

  try {
    const existing = await query(
      'SELECT redeemed_at FROM coupon_redemptions WHERE user_id = $1 AND coupon_id = $2::uuid',
      [userId, uuid]
    );
    if (existing.rows.length) {
      return res.status(200).json({
        ok: true,
        alreadyRedeemed: true,
        redeemedAt: existing.rows[0].redeemed_at,
      });
    }

    const active = await query(
      `SELECT c.id, c.code FROM coupons c
       WHERE c.id = $1::uuid AND (${COUPON_ACTIVE})`,
      [uuid]
    );

    if (!active.rows.length) {
      const exists = await query('SELECT 1 FROM coupons WHERE id = $1::uuid', [uuid]);
      if (!exists.rows.length) {
        return res.status(404).json({ error: 'Coupon not found.', code: 'NOT_FOUND' });
      }
      return res.status(400).json({ error: 'This coupon is no longer active.', code: 'INACTIVE' });
    }

    const row = active.rows[0];
    if (normalizeCode(row.code) !== code) {
      return res.status(400).json({ error: 'Code does not match.', code: 'INVALID_CODE' });
    }

    const ins = await query(
      `INSERT INTO coupon_redemptions (user_id, coupon_id) VALUES ($1, $2::uuid)
       RETURNING id, redeemed_at`,
      [userId, uuid]
    );

    return res.status(201).json({
      ok: true,
      alreadyRedeemed: false,
      redeemedAt: ins.rows[0].redeemed_at,
    });
  } catch (err) {
    if (err.code === '23505') {
      const again = await query(
        'SELECT redeemed_at FROM coupon_redemptions WHERE user_id = $1 AND coupon_id = $2::uuid',
        [userId, uuid]
      );
      if (again.rows.length) {
        return res.status(200).json({
          ok: true,
          alreadyRedeemed: true,
          redeemedAt: again.rows[0].redeemed_at,
        });
      }
    }
    if (err.code === '42P01') {
      return res.status(503).json({ error: 'Coupon redemption is not available.', code: 'TABLE_MISSING' });
    }
    sendDbAwareError(res, err, 'Redeem failed');
  }
});

module.exports = router;
