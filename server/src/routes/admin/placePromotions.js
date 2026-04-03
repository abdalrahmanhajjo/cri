const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { getCollection } = require('../../mongo');
const { parsePlaceId } = require('../../utils/validate');
const crypto = require('crypto');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

function rowToPromotion(doc) {
  return {
    id: doc.id,
    placeId: doc.place_id,
    placeName: doc.place_name != null ? String(doc.place_name) : '',
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

/** GET /api/admin/place-promotions ?placeId= optional */
router.get('/', async (req, res) => {
  const filterPlace = parsePlaceId(req.query.placeId);
  try {
    const promoColl = await getCollection('place_promotions');
    const queryObj = {};
    if (filterPlace.valid) {
      queryObj.place_id = filterPlace.value;
    }

    const rows = await promoColl.aggregate([
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

    res.json({ promotions: rows.map(rowToPromotion) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load place promotions' });
  }
});

/** POST /api/admin/place-promotions */
router.post('/', async (req, res) => {
  const parsed = parsePlaceId(req.body?.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'Valid placeId required' });
  const placeId = parsed.value;

  try {
    const placesColl = await getCollection('places');
    const place = await placesColl.findOne({ id: placeId });
    if (!place) return res.status(400).json({ error: 'Place not found' });

    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 200) : '';
    if (!title) return res.status(400).json({ error: 'title required' });
    
    const subtitle = typeof req.body?.subtitle === 'string' ? req.body.subtitle.trim().slice(0, 500) : null;
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().slice(0, 64) : null;
    const discountLabel = typeof req.body?.discountLabel === 'string' ? req.body.discountLabel.trim().slice(0, 120) : null;
    const terms = typeof req.body?.terms === 'string' ? req.body.terms.trim().slice(0, 2000) : null;
    const startsAt = req.body?.startsAt ? new Date(req.body.startsAt) : null;
    const endsAt = req.body?.endsAt ? new Date(req.body.endsAt) : null;
    const active = req.body?.active !== false;

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
    res.status(201).json({
      promotion: rowToPromotion({ ...newPromo, place_name: place.name }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

/** PATCH /api/admin/place-promotions/:id */
router.patch('/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const promoColl = await getCollection('place_promotions');
    const existing = await promoColl.findOne({ id: id });
    if (!existing) return res.status(404).json({ error: 'Promotion not found' });

    const setObj = {};
    const b = req.body || {};

    if (b.placeId !== undefined) {
      const p = parsePlaceId(b.placeId);
      if (!p.valid) return res.status(400).json({ error: 'Invalid placeId' });
      const placesColl = await getCollection('places');
      const place = await placesColl.findOne({ id: p.value });
      if (!place) return res.status(400).json({ error: 'Place not found' });
      setObj.place_id = p.value;
    }
    if (typeof b.title === 'string') setObj.title = b.title.trim().slice(0, 200);
    if (typeof b.subtitle === 'string') setObj.subtitle = b.subtitle.trim().slice(0, 500);
    if (typeof b.code === 'string') setObj.code = b.code.trim().slice(0, 64);
    if (typeof b.discountLabel === 'string') setObj.discount_label = b.discountLabel.trim().slice(0, 120);
    if (typeof b.terms === 'string') setObj.terms = b.terms.trim().slice(0, 2000);
    if (b.startsAt !== undefined) setObj.starts_at = b.startsAt ? new Date(b.startsAt) : null;
    if (b.endsAt !== undefined) setObj.ends_at = b.endsAt ? new Date(b.endsAt) : null;
    if (typeof b.active === 'boolean') setObj.active = b.active;

    if (!Object.keys(setObj).length) return res.status(400).json({ error: 'No fields to update' });

    setObj.updated_at = new Date();

    const result = await promoColl.findOneAndUpdate(
      { id: id },
      { $set: setObj },
      { returnDocument: 'after' }
    );

    const placesCollLookup = await getCollection('places');
    const updatedPlace = await placesCollLookup.findOne({ id: result.place_id });
    
    res.json({ promotion: rowToPromotion({ ...result, place_name: updatedPlace?.name || '' }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update promotion' });
  }
});

/** DELETE /api/admin/place-promotions/:id */
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const promoColl = await getCollection('place_promotions');
    const result = await promoColl.deleteOne({ id: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Promotion not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

module.exports = router;
