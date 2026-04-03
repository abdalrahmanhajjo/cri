const express = require('express');
const { getCollection } = require('../mongo');
const { authMiddleware } = require('../middleware/auth');
const { sendDbAwareError } = require('../utils/dbHttpError');

const router = express.Router();
router.use(authMiddleware);

function normalizeCode(s) {
  return String(s ?? '').trim().toUpperCase();
}

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
    const id = raw.slice('promo-'.length);
    if (!id) return { ok: false, error: 'Invalid offer.' };
    return { ok: true, kind: 'promo', promoId: id };
  }
  return { ok: false, error: 'Unsupported offer type.' };
}

router.get('/redeemed', async (req, res) => {
  const userId = req.user.userId;
  try {
    const couponRedemptions = await getCollection('coupon_redemptions');
    const cRows = await couponRedemptions.find({ user_id: userId }).toArray();
    const couponIds = cRows.map((r) => r.coupon_id);

    const promoRedemptions = await getCollection('place_promotion_redemptions');
    const pRows = await promoRedemptions.find({ user_id: userId }).toArray();
    const placePromotionIds = pRows.map((r) => r.promotion_id);

    res.json({ couponIds, placePromotionIds });
  } catch (err) {
    sendDbAwareError(res, err, 'Failed to load redemptions');
  }
});

async function redeemCoupon(userId, uuid, code) {
  const couponRedemptions = await getCollection('coupon_redemptions');
  const existing = await couponRedemptions.findOne({ user_id: userId, coupon_id: uuid });
  if (existing) {
    return {
      status: 200,
      body: { ok: true, alreadyRedeemed: true, redeemedAt: existing.created_at },
    };
  }

  const coupons = await getCollection('coupons');
  const now = new Date();
  const active = await coupons.findOne({
    id: uuid,
    $or: [
        { expires_at: null },
        { expires_at: { $gt: now } }
    ],
    starts_at: { $lte: now }
  });

  if (!active) {
    const exists = await coupons.findOne({ id: uuid });
    if (!exists) return { status: 404, body: { error: 'Coupon not found.', code: 'NOT_FOUND' } };
    return { status: 400, body: { error: 'This coupon is no longer active.', code: 'INACTIVE' } };
  }

  if (normalizeCode(active.code) !== code) {
    return { status: 400, body: { error: 'Code does not match.', code: 'INVALID_CODE' } };
  }

  const result = await couponRedemptions.insertOne({
    user_id: userId,
    coupon_id: uuid,
    created_at: new Date()
  });

  return {
    status: 201,
    body: { ok: true, alreadyRedeemed: false, redeemedAt: new Date() },
  };
}

async function redeemPlacePromotion(userId, promoId, code) {
  const promoRedemptions = await getCollection('place_promotion_redemptions');
  const existing = await promoRedemptions.findOne({ user_id: userId, promotion_id: promoId });
  if (existing) {
    return {
      status: 200,
      body: { ok: true, alreadyRedeemed: true, redeemedAt: existing.created_at },
    };
  }

  const promos = await getCollection('place_promotions');
  const now = new Date();
  const active = await promos.findOne({
    id: promoId,
    code: { $ne: null, $not: /^\s*$/ },
    $or: [
        { ends_at: null },
        { ends_at: { $gt: now } }
    ],
    starts_at: { $lte: now }
  });

  if (!active) {
    const exists = await promos.findOne({ id: promoId });
    if (!exists) return { status: 404, body: { error: 'Offer not found.', code: 'NOT_FOUND' } };
    return { status: 400, body: { error: 'This offer is no longer active.', code: 'INACTIVE' } };
  }

  if (normalizeCode(active.code) !== code) {
    return { status: 400, body: { error: 'Code does not match.', code: 'INVALID_CODE' } };
  }

  await promoRedemptions.insertOne({
    user_id: userId,
    promotion_id: promoId,
    created_at: new Date()
  });

  return {
    status: 201,
    body: { ok: true, alreadyRedeemed: false, redeemedAt: new Date() },
  };
}

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
      const out = await redeemCoupon(userId, parsed.uuid, code);
      return res.status(out.status).json(out.body);
    } else {
      const out = await redeemPlacePromotion(userId, parsed.promoId, code);
      return res.status(out.status).json(out.body);
    }
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Redeem failed');
  }
});

module.exports = router;
