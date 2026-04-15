const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware, userManagesPlace } = require('../../middleware/placeOwner');
const { parsePlaceId } = require('../../utils/validate');
const crypto = require('crypto');

const router = express.Router();
router.use(authMiddleware, businessPortalMiddleware);

function rowToPromotion(doc) {
  return {
    id: doc.id,
    placeId: doc.place_id,
    title: doc.title,
    subtitle: doc.subtitle || '',
    code: doc.code || '',
    discountLabel: doc.discount_label || '',
    terms: doc.terms || '',
    startsAt: doc.starts_at,
    endsAt: doc.ends_at,
    active: doc.active,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

/** GET /api/business/promotions?placeId= */
router.get('/', async (req, res) => {
  const parsed = parsePlaceId(req.query.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'Valid placeId query required' });
  const placeId = parsed.value;
  if (!(await userManagesPlace(req.user.userId, placeId))) {
    return res.status(403).json({ error: 'You do not manage this place' });
  }
  try {
    const promoColl = await getCollection('place_promotions');
    const rows = await promoColl.find({ place_id: placeId }).sort({ created_at: -1 }).toArray();
    res.json({ placeId, promotions: rows.map(rowToPromotion) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load promotions' });
  }
});

/** POST /api/business/promotions */
router.post('/', async (req, res) => {
  const parsed = parsePlaceId(req.body?.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'placeId required' });
  const placeId = parsed.value;
  if (!(await userManagesPlace(req.user.userId, placeId))) {
    return res.status(403).json({ error: 'You do not manage this place' });
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 200) : '';
  if (!title) return res.status(400).json({ error: 'title required' });
  const subtitle = typeof req.body?.subtitle === 'string' ? req.body.subtitle.trim().slice(0, 500) : null;
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().slice(0, 64) : null;
  const discountLabel = typeof req.body?.discountLabel === 'string' ? req.body.discountLabel.trim().slice(0, 120) : null;
  const terms = typeof req.body?.terms === 'string' ? req.body.terms.trim().slice(0, 2000) : null;
  const startsAt = req.body?.startsAt ? new Date(req.body.startsAt) : null;
  const endsAt = req.body?.endsAt ? new Date(req.body.endsAt) : null;
  const active = req.body?.active !== false;

  try {
    const promoColl = await getCollection('place_promotions');
    const newId = crypto.randomUUID();
    const newPromo = {
      id: newId,
      place_id: placeId,
      title,
      subtitle,
      code,
      discount_label: discountLabel,
      terms,
      starts_at: startsAt,
      ends_at: endsAt,
      active,
      created_at: new Date(),
      updated_at: new Date()
    };
    await promoColl.insertOne(newPromo);
    res.status(201).json({ promotion: rowToPromotion(newPromo) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

/** PATCH /api/business/promotions/:id */
router.patch('/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const promoColl = await getCollection('place_promotions');
    const existing = await promoColl.findOne({ id });
    if (!existing) return res.status(404).json({ error: 'Promotion not found' });

    if (!(await userManagesPlace(req.user.userId, existing.place_id))) {
      return res.status(403).json({ error: 'You do not manage the place for this promotion' });
    }

    const setObj = {};
    const b = req.body || {};
    if (typeof b.title === 'string') setObj.title = b.title.trim().slice(0, 200);
    if (typeof b.subtitle === 'string') setObj.subtitle = b.subtitle.trim().slice(0, 500);
    if (typeof b.code === 'string') setObj.code = b.code.trim().slice(0, 64);
    if (typeof b.discountLabel === 'string') setObj.discount_label = b.discountLabel.trim().slice(0, 120);
    if (typeof b.terms === 'string') setObj.terms = b.terms.trim().slice(0, 2000);
    if (b.startsAt !== undefined) setObj.starts_at = b.startsAt ? new Date(b.startsAt) : null;
    if (b.endsAt !== undefined) setObj.ends_at = b.endsAt ? new Date(b.endsAt) : null;
    if (typeof b.active === 'boolean') setObj.active = b.active;

    if (Object.keys(setObj).length === 0) return res.status(400).json({ error: 'No fields to update' });
    setObj.updated_at = new Date();

    const result = await promoColl.findOneAndUpdate(
      { id },
      { $set: setObj },
      { returnDocument: 'after' }
    );
    res.json({ promotion: rowToPromotion(result) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update promotion' });
  }
});

/** DELETE /api/business/promotions/:id */
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const promoColl = await getCollection('place_promotions');
    const promo = await promoColl.findOne({ id });
    if (!promo) return res.status(404).json({ error: 'Promotion not found' });

    if (!(await userManagesPlace(req.user.userId, promo.place_id))) {
      return res.status(403).json({ error: 'You do not manage the place for this promotion' });
    }

    await promoColl.deleteOne({ id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

module.exports = router;
