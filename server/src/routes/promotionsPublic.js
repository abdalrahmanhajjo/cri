const express = require('express');
const { getCollection } = require('../mongo');
const { getRequestLang } = require('../utils/requestLang');
const { sendDbAwareError } = require('../utils/dbHttpError');

const router = express.Router();

function getTranslation(doc, lang) {
  if (!doc || !doc.translations || typeof doc.translations !== 'object') return null;
  const hit = doc.translations[lang];
  return hit && typeof hit === 'object' ? hit : null;
}

/**
 * GET /api/promotions — Discover “Offers” tab.
 * Merged place_promotions + coupons.
 */
router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
  const lang = getRequestLang(req);
  const now = new Date();

  try {
    const promoColl = await getCollection('place_promotions');
    const promos = await promoColl.aggregate([
      { $match: {
          active: true,
          $and: [
            { $or: [{ starts_at: null }, { starts_at: { $lte: now } }] },
            { $or: [{ ends_at: null }, { ends_at: { $gte: now } }] }
          ]
      }},
      { $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place'
      }},
      { $addFields: {
          placeObj: { $arrayElemAt: ['$place', 0] }
      }},
      { $project: {
          id: { $concat: ['promo-', '$id'] },
          placeId: '$place_id',
          title: 1,
          subtitle: 1,
          code: 1,
          discountLabel: '$discount_label',
          terms: 1,
          startsAt: '$starts_at',
          endsAt: '$ends_at',
          placeName: '$placeObj.name',
          translations: 1,
          placeTranslations: '$placeObj.translations',
          created_at: 1,
          _sort: '$created_at'
      }},
      { $sort: { _sort: -1 } },
      { $limit: limit }
    ]).toArray();

    const couponColl = await getCollection('coupons');
    const couponRedemptions = await getCollection('coupon_redemptions');
    
    // We fetch all "potentially" active coupons. In a high-scale app, we'd use a more efficient way to check usage limits.
    const couponsRaw = await couponColl.aggregate([
      { $match: {
          $and: [
            { $or: [{ valid_from: null }, { valid_from: { $lte: now } }] },
            { $or: [{ valid_until: null }, { valid_until: { $gte: now } }] }
          ]
      }},
      { $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place'
      }},
      { $addFields: {
          placeObj: { $arrayElemAt: ['$place', 0] }
      }},
      { $project: {
          id: { $concat: ['coupon-', '$id'] },
          rawId: '$id',
          placeId: '$place_id',
          title: 1,
          subtitle: 1,
          code: 1,
          discountLabel: '$discount_label',
          terms: 1,
          startsAt: '$valid_from',
          endsAt: '$valid_until',
          placeName: '$placeObj.name',
          discountType: '$discount_type',
          discountValue: '$discount_value',
          minPurchase: '$min_purchase',
          usageLimit: '$usage_limit',
          translations: 1,
          placeTranslations: '$placeObj.translations',
          created_at: 1,
          _sort: '$created_at'
      }},
      { $sort: { _sort: -1 } },
      { $limit: limit }
    ]).toArray();

    // Filter coupons by usage limit
    const activeCoupons = [];
    for (const c of couponsRaw) {
      if (c.usageLimit != null) {
        const count = await couponRedemptions.countDocuments({ coupon_id: c.rawId });
        if (count >= c.usageLimit) continue;
      }
      activeCoupons.push(c);
    }

    // Combine and re-sort
    const merged = [...promos, ...activeCoupons]
      .sort((a, b) => b._sort - a._sort)
      .slice(0, limit);

    // Apply translations
    const final = merged.map(m => {
      const tr = getTranslation(m, lang);
      const ptr = m.placeTranslations ? m.placeTranslations[lang] : null;
      
      const out = {
        ...m,
        title: tr?.title || m.title || ptr?.name || m.placeName || '',
        subtitle: tr?.subtitle || m.subtitle || '',
        discountLabel: tr?.discount_label || m.discountLabel || '',
        terms: tr?.terms || m.terms || '',
        placeName: ptr?.name || m.placeName || ''
      };
      delete out.translations;
      delete out.placeTranslations;
      delete out.rawId;
      delete out._sort;
      delete out.created_at;
      return out;
    });

    res.json({ promotions: final });
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to load promotions');
  }
});

module.exports = router;
