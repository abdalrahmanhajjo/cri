const express = require('express');
const { query } = require('../db');
const { sendDbAwareError } = require('../utils/dbHttpError');
const { getRequestLang } = require('../utils/requestLang');
const {
  PLACE_PROMO_SELECT,
  COUPON_AS_PROMO_SELECT,
  SQL_PROMOTIONS_ONLY,
} = require('../utils/activeOfferFilters');

const router = express.Router();

const SQL_MERGED = `
  SELECT id, "placeId", title, subtitle, code, "discountLabel", terms, "startsAt", "endsAt", "placeName",
         "discountType", "discountValue", "minPurchase", "usageLimit"
  FROM (
` + PLACE_PROMO_SELECT + `
    UNION ALL
` + COUPON_AS_PROMO_SELECT + `
  ) AS merged
  ORDER BY merged._sort DESC
  LIMIT $1`;

/**
 * GET /api/promotions — Discover “Offers” tab.
 * Merged place_promotions + coupons; on missing coupon tables (42P01), same as SQL_PROMOTIONS_ONLY.
 */
router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
  const lang = getRequestLang(req);
  try {
    const { rows } = await query(SQL_MERGED, [limit, null, lang]);
    res.json({ promotions: rows });
  } catch (err) {
    if (err.code === '42P01') {
      try {
        const { rows } = await query(SQL_PROMOTIONS_ONLY, [limit, null, lang]);
        return res.json({ promotions: rows });
      } catch (e2) {
        if (e2.code === '42P01') return res.json({ promotions: [] });
        console.error(e2);
        return sendDbAwareError(res, e2, 'Failed to load promotions');
      }
    }
    console.error(err);
    sendDbAwareError(res, err, 'Failed to load promotions');
  }
});

module.exports = router;
