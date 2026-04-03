const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { getCollection } = require('../../mongo');
const { parsePlaceId } = require('../../utils/validate');
const crypto = require('crypto');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rowToCoupon(doc) {
  return {
    id: doc.id,
    code: doc.code,
    discountType: doc.discount_type,
    discountValue: doc.discount_value != null ? Number(doc.discount_value) : null,
    minPurchase: doc.min_purchase != null ? Number(doc.min_purchase) : 0,
    validFrom: doc.valid_from,
    validUntil: doc.valid_until,
    usageLimit: doc.usage_limit,
    placeId: doc.place_id,
    placeName: doc.place_name != null ? String(doc.place_name) : '',
    tourId: doc.tour_id,
    eventId: doc.event_id,
    createdAt: doc.created_at,
  };
}

function parseOptionalPlaceId(value) {
  if (value == null || value === '') return { valid: true, value: null };
  return parsePlaceId(value);
}

function parseOptionalVarchar(value, maxLen) {
  if (value == null || value === '') return { valid: true, value: null };
  const s = String(value).trim();
  if (s.length > maxLen) return { valid: false };
  return { valid: true, value: s };
}

/** GET /api/admin/coupons ?placeId= optional */
router.get('/', async (req, res) => {
  const filterPlace = parsePlaceId(req.query.placeId);
  try {
    const couponsColl = await getCollection('coupons');
    const queryObj = {};
    if (filterPlace.valid) {
      queryObj.place_id = filterPlace.value;
    }

    const rows = await couponsColl.aggregate([
      { $match: queryObj },
      { $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place'
      }},
      { $addFields: {
          place_name: { $arrayElemAt: ['$place.name', 0] }
      }},
      { $sort: { created_at: -1 } },
      { $limit: 500 }
    ]).toArray();

    res.json({ coupons: rows.map(rowToCoupon) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load coupons' });
  }
});

/** POST /api/admin/coupons */
router.post('/', async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().slice(0, 32) : '';
  if (!code) return res.status(400).json({ error: 'code required' });

  const discountType = String(req.body?.discountType || req.body?.discount_type || '').toLowerCase();
  if (discountType !== 'percent' && discountType !== 'fixed') {
    return res.status(400).json({ error: 'discountType must be percent or fixed' });
  }

  const dv = Number(req.body?.discountValue ?? req.body?.discount_value);
  if (!Number.isFinite(dv) || dv < 0) return res.status(400).json({ error: 'discountValue must be a non-negative number' });

  const minPurchase = req.body?.minPurchase != null || req.body?.min_purchase != null
    ? Number(req.body?.minPurchase ?? req.body?.min_purchase)
    : 0;
  if (!Number.isFinite(minPurchase) || minPurchase < 0) {
    return res.status(400).json({ error: 'minPurchase must be >= 0' });
  }

  const vfRaw = req.body?.validFrom ?? req.body?.valid_from;
  const validFrom = vfRaw != null && String(vfRaw).trim() !== '' ? new Date(vfRaw) : new Date();
  
  const validUntilRaw = req.body?.validUntil ?? req.body?.valid_until;
  if (validUntilRaw == null || String(validUntilRaw).trim() === '') {
    return res.status(400).json({ error: 'validUntil required' });
  }
  const validUntil = new Date(validUntilRaw);

  let usageLimit = null;
  if (req.body?.usageLimit != null && req.body.usageLimit !== '') {
    const u = parseInt(String(req.body.usageLimit), 10);
    if (!Number.isInteger(u) || u < 1) return res.status(400).json({ error: 'usageLimit must be a positive integer' });
    usageLimit = u;
  }

  const placeParsed = parseOptionalPlaceId(req.body?.placeId ?? req.body?.place_id);
  if (!placeParsed.valid) return res.status(400).json({ error: 'Invalid placeId' });
  let placeName = '';
  if (placeParsed.value != null) {
    const placesColl = await getCollection('places');
    const place = await placesColl.findOne({ id: placeParsed.value });
    if (!place) return res.status(400).json({ error: 'Place not found' });
    placeName = place.name;
  }

  const tourParsed = parseOptionalVarchar(req.body?.tourId ?? req.body?.tour_id, 50);
  const eventParsed = parseOptionalVarchar(req.body?.eventId ?? req.body?.event_id, 50);
  if (!tourParsed.valid || !eventParsed.valid) return res.status(400).json({ error: 'Invalid tour or event id' });

  try {
    const couponsColl = await getCollection('coupons');
    // Check for duplicate code
    const existing = await couponsColl.findOne({ code });
    if (existing) return res.status(400).json({ error: 'A coupon with this code already exists.' });

    const newId = crypto.randomUUID();
    const newCoupon = {
      id: newId,
      code,
      discount_type: discountType,
      discount_value: dv,
      min_purchase: minPurchase,
      valid_from: validFrom,
      valid_until: validUntil,
      usage_limit: usageLimit,
      place_id: placeParsed.value,
      tour_id: tourParsed.value,
      event_id: eventParsed.value,
      created_at: new Date()
    };

    await couponsColl.insertOne(newCoupon);
    res.status(201).json({ coupon: rowToCoupon({ ...newCoupon, place_name: placeName }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

/** PATCH /api/admin/coupons/:id */
router.patch('/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid coupon id' });

  try {
    const couponsColl = await getCollection('coupons');
    const existing = await couponsColl.findOne({ id });
    if (!existing) return res.status(404).json({ error: 'Coupon not found' });

    const setObj = {};
    const b = req.body || {};

    if (typeof b.code === 'string') {
      const code = b.code.trim().slice(0, 32);
      const dup = await couponsColl.findOne({ code, id: { $ne: id } });
      if (dup) return res.status(400).json({ error: 'A coupon with this code already exists.' });
      setObj.code = code;
    }
    if (b.discountType !== undefined || b.discount_type !== undefined) {
      const dt = String(b.discountType ?? b.discount_type).toLowerCase();
      if (dt !== 'percent' && dt !== 'fixed') return res.status(400).json({ error: 'discountType must be percent or fixed' });
      setObj.discount_type = dt;
    }
    if (b.discountValue !== undefined || b.discount_value !== undefined) {
      const dv = Number(b.discountValue ?? b.discount_value);
      if (!Number.isFinite(dv) || dv < 0) return res.status(400).json({ error: 'Invalid discountValue' });
      setObj.discount_value = dv;
    }
    if (b.minPurchase !== undefined || b.min_purchase !== undefined) {
      const mp = Number(b.minPurchase ?? b.min_purchase);
      if (!Number.isFinite(mp) || mp < 0) return res.status(400).json({ error: 'Invalid minPurchase' });
      setObj.min_purchase = mp;
    }
    if (b.validFrom !== undefined || b.valid_from !== undefined) {
      const v = b.validFrom ?? b.valid_from;
      setObj.valid_from = v ? new Date(v) : null;
    }
    if (b.validUntil !== undefined || b.valid_until !== undefined) {
      const v = b.validUntil ?? b.valid_until;
      if (v == null || String(v).trim() === '') return res.status(400).json({ error: 'validUntil cannot be empty' });
      setObj.valid_until = new Date(v);
    }
    if (b.usageLimit !== undefined) {
      if (b.usageLimit === null || b.usageLimit === '') {
        setObj.usage_limit = null;
      } else {
        const u = parseInt(String(b.usageLimit), 10);
        if (!Number.isInteger(u) || u < 1) return res.status(400).json({ error: 'Invalid usageLimit' });
        setObj.usage_limit = u;
      }
    }
    if (b.placeId !== undefined || b.place_id !== undefined) {
      const raw = b.placeId ?? b.place_id;
      const p = parseOptionalPlaceId(raw);
      if (!p.valid) return res.status(400).json({ error: 'Invalid placeId' });
      if (p.value != null) {
        const placesColl = await getCollection('places');
        const place = await placesColl.findOne({ id: p.value });
        if (!place) return res.status(400).json({ error: 'Place not found' });
      }
      setObj.place_id = p.value;
    }
    if (b.tourId !== undefined || b.tour_id !== undefined) {
      const t = parseOptionalVarchar(b.tourId ?? b.tour_id, 50);
      if (!t.valid) return res.status(400).json({ error: 'Invalid tourId' });
      setObj.tour_id = t.value;
    }
    if (b.eventId !== undefined || b.event_id !== undefined) {
      const e = parseOptionalVarchar(b.eventId ?? b.event_id, 50);
      if (!e.valid) return res.status(400).json({ error: 'Invalid eventId' });
      setObj.event_id = e.value;
    }

    if (!Object.keys(setObj).length) return res.status(400).json({ error: 'No fields to update' });

    const result = await couponsColl.findOneAndUpdate(
      { id: id },
      { $set: setObj },
      { returnDocument: 'after' }
    );

    let placeName = '';
    if (result.place_id) {
      const placesCollLookup = await getCollection('places');
      const updatedPlace = await placesCollLookup.findOne({ id: result.place_id });
      placeName = updatedPlace?.name || '';
    }
    res.json({ coupon: rowToCoupon({ ...result, place_name: placeName }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

/** DELETE /api/admin/coupons/:id */
router.delete('/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid coupon id' });
  try {
    const couponsColl = await getCollection('coupons');
    const result = await couponsColl.deleteOne({ id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Coupon not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

module.exports = router;
