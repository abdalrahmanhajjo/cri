const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { normalizeDbText } = require('../../utils/normalizeDbText');
const { validateAdminPlaceUpsert } = require('../../utils/validateAdminPlace');
const { invalidateSitemapCache } = require('../../seo/seoRoutes');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

function safeJson(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'object' && val !== null) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return fallback;
}

/** GET /api/admin/places?q=&limit= — search places for admin pickers */
router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 500);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  
  try {
    const placesColl = await getCollection('places');
    const queryObj = {};
    if (q) {
      queryObj.$or = [
        { id: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } }
      ];
    }
    
    const docs = await placesColl.find(queryObj)
      .sort({ name: 1 })
      .limit(limit)
      .toArray();

    res.json({
      places: docs.map((r) => ({
        id: r.id,
        name: normalizeDbText(r.name || ''),
        location: normalizeDbText(r.location || ''),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search places' });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const parsed = validateAdminPlaceUpsert(body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.errors });
    }
    const v = parsed.value;

    const images = safeJson(body.images, []);
    const tags = safeJson(body.tags, []);

    const placesColl = await getCollection('places');
    const doc = {
      id: v.id,
      name: v.name,
      description: v.description,
      location: v.location,
      latitude: v.latitude,
      longitude: v.longitude,
      search_name: v.searchName,
      images: Array.isArray(images) ? images : [],
      category: v.category,
      category_id: v.categoryId,
      duration: v.duration,
      price: v.price,
      best_time: v.bestTime,
      rating: v.rating,
      review_count: v.reviewCount,
      hours: body.hours || null,
      tags: Array.isArray(tags) ? tags : [],
      updated_at: new Date()
    };

    await placesColl.replaceOne({ id: v.id }, doc, { upsert: true });
    invalidateSitemapCache();
    res.status(201).json({ id: v.id, message: 'Place saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save place' });
  }
});

function displayReviewAuthorName(name, email) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (n) return n;
  const e = typeof email === 'string' ? email.trim() : '';
  if (e && e.includes('@')) {
    const local = e.split('@')[0] || '';
    if (local) return local;
  }
  return 'Member';
}

/** All member reviews for a place (including hidden). Admin-only. */
router.get('/:id/reviews', async (req, res) => {
  const placeId = req.params.id;
  try {
    const reviewsColl = await getCollection('place_reviews');
    const rows = await reviewsColl.aggregate([
      { $match: { place_id: placeId } },
      { $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
      }},
      { $addFields: {
          userObj: { $arrayElemAt: ['$user', 0] }
      }},
      { $sort: { created_at: -1 } },
      { $limit: 200 }
    ]).toArray();

    const reviews = rows.map((r) => ({
      id: String(r.id || r._id),
      rating: r.rating,
      title: r.title || null,
      review: r.review || null,
      createdAt: r.created_at,
      authorName: displayReviewAuthorName(r.userObj?.name, r.userObj?.email),
      authorEmail: (r.userObj?.email && String(r.userObj.email).trim()) || null,
      hidden: r.hidden_at != null,
      hiddenAt: r.hidden_at || null,
    }));
    res.json({ placeId, reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    
    const setObj = {};
    if (body.name !== undefined) setObj.name = String(body.name);
    if (body.description !== undefined) setObj.description = String(body.description);
    if (body.location !== undefined) setObj.location = String(body.location);
    if (body.latitude !== undefined) setObj.latitude = body.latitude == null ? null : parseFloat(body.latitude);
    if (body.longitude !== undefined) setObj.longitude = body.longitude == null ? null : parseFloat(body.longitude);
    if (body.searchName !== undefined) setObj.search_name = String(body.searchName);
    if (body.images !== undefined) setObj.images = safeJson(body.images, []);
    if (body.category !== undefined) setObj.category = String(body.category);
    if (body.categoryId !== undefined) setObj.category_id = String(body.categoryId);
    if (body.duration !== undefined) setObj.duration = String(body.duration);
    if (body.price !== undefined) setObj.price = String(body.price);
    if (body.bestTime !== undefined) setObj.best_time = String(body.bestTime);
    if (body.rating !== undefined) setObj.rating = body.rating == null ? null : parseFloat(body.rating);
    if (body.reviewCount !== undefined) setObj.review_count = parseInt(body.reviewCount, 10);
    if (body.hours !== undefined) setObj.hours = body.hours;
    if (body.tags !== undefined) setObj.tags = safeJson(body.tags, []);
    
    setObj.updated_at = new Date();

    const placesColl = await getCollection('places');
    const result = await placesColl.updateOne({ id }, { $set: setObj });
    
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Place not found' });
    invalidateSitemapCache();
    res.json({ id, message: 'Place updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update place' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const placesColl = await getCollection('places');
    const result = await placesColl.deleteOne({ id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Place not found' });
    invalidateSitemapCache();
    res.json({ message: 'Place deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete place' });
  }
});

module.exports = router;
