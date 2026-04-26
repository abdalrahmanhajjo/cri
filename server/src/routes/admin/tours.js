const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { invalidateSitemapCache } = require('../../seo/seoRoutes');
const { autoTranslateTourBackground } = require('../../ai/translation/autoTranslate');

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

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const id = (body.id || '').toString().trim() || ('tour_' + Date.now());
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const toursColl = await getCollection('tours');
    const doc = {
      id,
      name: (body.name || 'Untitled Tour').toString(),
      duration: (body.duration || '0').toString(),
      duration_hours: body.durationHours != null ? parseInt(body.durationHours, 10) : (body.duration_hours != null ? parseInt(body.duration_hours, 10) : 0),
      locations: body.locations != null ? parseInt(body.locations, 10) : 0,
      rating: body.rating != null ? parseFloat(body.rating) : 0,
      reviews: body.reviews != null ? parseInt(body.reviews, 10) : 0,
      price: body.price != null ? parseFloat(body.price) : 0,
      currency: (body.currency || 'USD').toString(),
      price_display: (body.priceDisplay || body.price_display || '0').toString(),
      badge: (body.badge || '').toString() || null,
      badge_color: (body.badgeColor || body.badge_color || '').toString() || null,
      description: (body.description || '').toString(),
      image: (body.image || '').toString() || 'https://via.placeholder.com/400',
      difficulty: (body.difficulty || 'Easy').toString(),
      languages: safeJson(body.languages),
      includes: safeJson(body.includes),
      excludes: safeJson(body.excludes),
      highlights: safeJson(body.highlights),
      itinerary: safeJson(body.itinerary),
      place_ids: safeJson(body.placeIds || body.place_ids),
      updated_at: new Date()
    };

    await toursColl.replaceOne({ id }, doc, { upsert: true });
    invalidateSitemapCache();
    autoTranslateTourBackground(id, doc);
    res.status(201).json({ id, message: 'Tour saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save tour' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    
    const setObj = {};
    if (body.name !== undefined) setObj.name = String(body.name);
    if (body.duration !== undefined) setObj.duration = String(body.duration);
    if (body.durationHours !== undefined || body.duration_hours !== undefined) {
      setObj.duration_hours = parseInt(body.durationHours ?? body.duration_hours, 10);
    }
    if (body.locations !== undefined) setObj.locations = parseInt(body.locations, 10);
    if (body.rating !== undefined) setObj.rating = parseFloat(body.rating);
    if (body.reviews !== undefined) setObj.reviews = parseInt(body.reviews, 10);
    if (body.price !== undefined) setObj.price = parseFloat(body.price);
    if (body.currency !== undefined) setObj.currency = String(body.currency);
    if (body.priceDisplay !== undefined || body.price_display !== undefined) {
      setObj.price_display = String(body.priceDisplay ?? body.price_display);
    }
    if (body.badge !== undefined) setObj.badge = String(body.badge);
    if (body.badgeColor !== undefined || body.badge_color !== undefined) {
      setObj.badge_color = String(body.badgeColor ?? body.badge_color);
    }
    if (body.description !== undefined) setObj.description = String(body.description);
    if (body.image !== undefined) setObj.image = String(body.image);
    if (body.difficulty !== undefined) setObj.difficulty = String(body.difficulty);
    if (body.languages !== undefined) setObj.languages = safeJson(body.languages);
    if (body.includes !== undefined) setObj.includes = safeJson(body.includes);
    if (body.excludes !== undefined) setObj.excludes = safeJson(body.excludes);
    if (body.highlights !== undefined) setObj.highlights = safeJson(body.highlights);
    if (body.itinerary !== undefined) setObj.itinerary = safeJson(body.itinerary);
    if (body.placeIds !== undefined || body.place_ids !== undefined) {
      setObj.place_ids = safeJson(body.placeIds ?? body.place_ids);
    }
    
    setObj.updated_at = new Date();

    const toursColl = await getCollection('tours');
    const result = await toursColl.updateOne({ id }, { $set: setObj });
    
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Tour not found' });
    invalidateSitemapCache();
    
    // Auto-translate updated tour
    const updated = await toursColl.findOne({ id });
    if (updated) autoTranslateTourBackground(id, updated);

    res.json({ id, message: 'Tour updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update tour' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const toursColl = await getCollection('tours');
    const result = await toursColl.deleteOne({ id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Tour not found' });
    invalidateSitemapCache();
    res.json({ message: 'Tour deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete tour' });
  }
});

module.exports = router;
