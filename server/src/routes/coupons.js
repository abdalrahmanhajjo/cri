const express = require('express');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { sendDbAwareError } = require('../utils/dbHttpError');
const { COUPON_ACTIVE, PLACE_PROMOTION_ACTIVE } = require('../utils/activeOfferFilters');

const router = express.Router();
router.use(authMiddleware);

function normalizeCode(s) {
  return String(s ?? '').trim().toUpperCase();
}

/** @returns {{ ok: true, kind: 'coupon', uuid: string } | { ok: true, kind: 'promo', promoId: number } | { ok: false, error: string }} */
function parseRedeemPromotionId(promotionId) {
  const raw = String(promotionId ?? '').trim();
  if (raw.startsWith('coupon-')) {
    const uuid = raw.slice('coupon-'.length);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
      return { ok: false, error: 'Invalid coupon.' };
    }
    return { ok: true, kind: 'coupon', uuid };
  }
  if (raw.startsWith('promo-')) {
    const idStr = raw.slice('promo-'.length);
    if (!/^\d+$/.test(idStr)) {
      return { ok: false, error: 'Invalid offer.' };
    }
    const promoId = Number.parseInt(idStr, 10);
    if (!Number.isFinite(promoId) || promoId < 1) {
      return { ok: false, error: 'Invalid offer.' };
    }
    return { ok: true, kind: 'promo', promoId };
  }
  return { ok: false, error: 'Unsupported offer type.' };
}

/** GET /api/coupons/redeemed — coupon UUIDs + place promotion ids (for OfferCard badges). */
router.get('/redeemed', async (req, res) => {
  const userId = req.user.userId;
  try {
    let couponIds = [];
    try {
      const { rows } = await query(
        'SELECT coupon_id::text AS id FROM coupon_redemptions WHERE user_id = $1',
        [userId]
      );
      couponIds = rows.map((r) => r.id);
    } catch (err) {
      if (err.code !== '42P01') throw err;
    }

    let placePromotionIds = [];
    try {
      const { rows } = await query(
        'SELECT promotion_id::text AS id FROM place_promotion_redemptions WHERE user_id = $1',
        [userId]
      );
      placePromotionIds = rows.map((r) => r.id);
    } catch (err) {
      if (err.code !== '42P01') throw err;
    }

    res.json({ couponIds, placePromotionIds });
  } catch (err) {
    sendDbAwareError(res, err, 'Failed to load redemptions');
  }
});

async function redeemCoupon(userId, uuid, code) {
  const existing = await query(
    'SELECT redeemed_at FROM coupon_redemptions WHERE user_id = $1 AND coupon_id = $2::uuid',
    [userId, uuid]
  );
  if (existing.rows.length) {
    return {
      status: 200,
      body: {
        ok: true,
        alreadyRedeemed: true,
        redeemedAt: existing.rows[0].redeemed_at,
      },
    };
  }

  const active = await query(
    `SELECT c.id, c.code FROM coupons c
     WHERE c.id = $1::uuid AND (${COUPON_ACTIVE})`,
    [uuid]
  );

  if (!active.rows.length) {
    const exists = await query('SELECT 1 FROM coupons WHERE id = $1::uuid', [uuid]);
    if (!exists.rows.length) {
      return { status: 404, body: { error: 'Coupon not found.', code: 'NOT_FOUND' } };
    }
    return { status: 400, body: { error: 'This coupon is no longer active.', code: 'INACTIVE' } };
  }

  const row = active.rows[0];
  if (normalizeCode(row.code) !== code) {
    return { status: 400, body: { error: 'Code does not match.', code: 'INVALID_CODE' } };
  }

  const ins = await query(
    `INSERT INTO coupon_redemptions (user_id, coupon_id) VALUES ($1, $2::uuid)
     RETURNING id, redeemed_at`,
    [userId, uuid]
  );

  return {
    status: 201,
    body: {
      ok: true,
      alreadyRedeemed: false,
      redeemedAt: ins.rows[0].redeemed_at,
    },
  };
}

async function redeemPlacePromotion(userId, promoId, code) {
  const existing = await query(
    'SELECT redeemed_at FROM place_promotion_redemptions WHERE user_id = $1 AND promotion_id = $2',
    [userId, promoId]
  );
  if (existing.rows.length) {
    return {
      status: 200,
      body: {
        ok: true,
        alreadyRedeemed: true,
        redeemedAt: existing.rows[0].redeemed_at,
      },
    };
  }

  const active = await query(
    `SELECT pr.id, pr.code FROM place_promotions pr
     WHERE pr.id = $1
       AND pr.code IS NOT NULL
       AND LENGTH(TRIM(pr.code)) > 0
       AND (${PLACE_PROMOTION_ACTIVE})`,
    [promoId]
  );

  if (!active.rows.length) {
    const exists = await query('SELECT 1 FROM place_promotions WHERE id = $1', [promoId]);
    if (!exists.rows.length) {
      return { status: 404, body: { error: 'Offer not found.', code: 'NOT_FOUND' } };
    }
    return { status: 400, body: { error: 'This offer is no longer active.', code: 'INACTIVE' } };
  }

  const row = active.rows[0];
  if (normalizeCode(row.code) !== code) {
    return { status: 400, body: { error: 'Code does not match.', code: 'INVALID_CODE' } };
  }

  const ins = await query(
    `INSERT INTO place_promotion_redemptions (user_id, promotion_id) VALUES ($1, $2)
     RETURNING id, redeemed_at`,
    [userId, promoId]
  );

  return {
    status: 201,
    body: {
      ok: true,
      alreadyRedeemed: false,
      redeemedAt: ins.rows[0].redeemed_at,
    },
  };
}

/**
 * POST /api/coupons/redeem
 * Body: { promotionId: "coupon-<uuid>" | "promo-<id>", code: "<user-entered code>" }
 */
router.post('/redeem', async (req, res) => {
  const userId = req.user.userId;
  const parsed = parseRedeemPromotionId(req.body?.promotionId);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error, code: 'INVALID_PROMOTION' });
  }

  const code = normalizeCode(req.body?.code);
  if (!code) {
    return res.status(400).json({ error: 'Enter the coupon code.', code: 'CODE_REQUIRED' });
  }

  try {
    if (parsed.kind === 'coupon') {
      const { uuid } = parsed;
      try {
        const out = await redeemCoupon(userId, uuid, code);
        return res.status(out.status).json(out.body);
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
        throw err;
      }
    }

    const { promoId } = parsed;
    try {
      const out = await redeemPlacePromotion(userId, promoId, code);
      return res.status(out.status).json(out.body);
    } catch (err) {
      if (err.code === '23505') {
        const again = await query(
          'SELECT redeemed_at FROM place_promotion_redemptions WHERE user_id = $1 AND promotion_id = $2',
          [userId, promoId]
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
        return res.status(503).json({ error: 'Offer redemption is not available yet.', code: 'TABLE_MISSING' });
      }
      throw err;
    }
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(503).json({ error: 'Coupon redemption is not available.', code: 'TABLE_MISSING' });
    }
    sendDbAwareError(res, err, 'Redeem failed');
  }
});

module.exports = router;
