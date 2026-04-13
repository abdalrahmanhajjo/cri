const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware, requirePlaceOwnerParam } = require('../../middleware/placeOwner');
const { parsePlaceId } = require('../../utils/validate');
const { validateBusinessPlacePut, validateTranslationPut } = require('../../utils/businessPlaceValidation');
const { normalizeDbText } = require('../../utils/normalizeDbText');

const router = express.Router();
router.use(authMiddleware, businessPortalMiddleware);

function safeJson(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'object' && val !== null) return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function rowToEditorPlace(row) {
  const images = safeJson(row.images, []);
  const tags = safeJson(row.tags, []);
  const diningProfile =
    row.dining_profile && typeof row.dining_profile === 'object' && !Array.isArray(row.dining_profile)
      ? row.dining_profile
      : {};
  const tagList = Array.isArray(tags) ? tags.map((x) => (typeof x === 'string' ? normalizeDbText(x) : x)) : [];
  return {
    id: row.id,
    name: normalizeDbText(row.name || ''),
    description: normalizeDbText(row.description || ''),
    location: normalizeDbText(row.location || ''),
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    searchName: normalizeDbText(row.search_name || ''),
    images: Array.isArray(images) ? images : [],
    category: normalizeDbText(row.category || ''),
    categoryId: row.category_id || '',
    duration: normalizeDbText(row.duration || ''),
    price: normalizeDbText(row.price || ''),
    bestTime: normalizeDbText(row.best_time || ''),
    rating: row.rating ?? null,
    reviewCount: row.review_count ?? null,
    hours: typeof row.hours === 'string' ? normalizeDbText(row.hours) : row.hours ?? null,
    diningProfile,
    tags: tagList,
    feedLinkingRestrictedToOwner: row.feed_linking_restricted_to_owner === true,
    feedLinkingDisabled: row.feed_linking_disabled === true,
  };
}

/** List places this user manages. */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const poColl = await getCollection('place_owners');
    const ownedPlaces = await poColl.aggregate([
      { $match: { user_id: userId } },
      { $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place'
      }},
      { $unwind: '$place' },
      { $sort: { 'place.name': 1 } }
    ]).toArray();

    res.json({
      places: ownedPlaces.map((doc) => {
        const r = doc.place;
        return {
          id: r.id,
          name: normalizeDbText(r.name || ''),
          location: normalizeDbText(r.location || ''),
          category: normalizeDbText(r.category || ''),
          images: r.images || [],
          rating: r.rating,
          latitude: r.latitude,
          longitude: r.longitude,
        };
      }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list places' });
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

/** Member reviews for an owned place. */
router.get('/:placeId/reviews', requirePlaceOwnerParam('placeId'), async (req, res) => {
  const placeId = req.ownsPlaceId || req.params.placeId;
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
          user_name: { $arrayElemAt: ['$user.name', 0] },
          user_email: { $arrayElemAt: ['$user.email', 0] }
      }},
      { $sort: { created_at: -1 } },
      { $limit: 200 }
    ]).toArray();

    const reviews = rows.map((r) => ({
      id: String(r.id),
      rating: r.rating,
      title: r.title || null,
      review: r.review || null,
      createdAt: r.created_at,
      authorName: displayReviewAuthorName(r.user_name, r.user_email),
      authorEmail: (r.user_email && String(r.user_email).trim()) || null,
      hidden: r.hidden_at != null,
      hiddenAt: r.hidden_at || null,
    }));
    res.json({ placeId, reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

/** Per-language copy. */
router.get('/:placeId/translations', requirePlaceOwnerParam('placeId'), async (req, res) => {
  const placeId = req.params.placeId;
  try {
    const transColl = await getCollection('place_translations');
    const rows = await transColl.find({ place_id: placeId }).sort({ lang: 1 }).toArray();
    res.json({
      translations: rows.map((r) => ({
        lang: r.lang,
        name: r.name,
        description: r.description,
        location: r.location,
        category: r.category,
        duration: r.duration,
        price: r.price,
        bestTime: r.best_time,
        tags: r.tags || [],
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load translations' });
  }
});

router.put('/:placeId/translations/:lang', requirePlaceOwnerParam('placeId'), async (req, res) => {
  const lang = (req.params.lang || '').trim().toLowerCase();
  const placeId = req.ownsPlaceId || req.params.placeId;

  const v = validateTranslationPut(req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });
  const b = v.body;

  try {
    const transColl = await getCollection('place_translations');
    const transDoc = {
      place_id: placeId,
      lang,
      name: b.name != null ? b.name : null,
      description: b.description != null ? b.description : null,
      location: b.location != null ? b.location : null,
      category: b.category != null ? b.category : null,
      duration: b.duration != null ? b.duration : null,
      price: b.price != null ? b.price : null,
      best_time: b.bestTime != null ? b.bestTime : null,
      tags: Array.isArray(b.tags) ? b.tags : [],
      updated_at: new Date()
    };

    await transColl.updateOne(
      { place_id: placeId, lang: lang },
      { $set: transDoc },
      { upsert: true }
    );

    // Also update embedded translations in the place document
    const placesColl = await getCollection('places');
    const place = await placesColl.findOne({ id: placeId });
    if (place) {
      const translations = place.translations || [];
      const idx = translations.findIndex(t => t.lang === lang);
      if (idx > -1) {
        translations[idx] = transDoc;
      } else {
        translations.push(transDoc);
      }
      await placesColl.updateOne({ id: placeId }, { $set: { translations } });
    }

    res.json({ placeId, lang, message: 'Translation saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save translation' });
  }
});

/** Full place row for editing. */
router.get('/:placeId', requirePlaceOwnerParam('placeId'), async (req, res) => {
  try {
    const placesColl = await getCollection('places');
    const place = await placesColl.findOne({ id: req.params.placeId });
    if (!place) return res.status(404).json({ error: 'Place not found' });
    res.json(rowToEditorPlace(place));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load place' });
  }
});

/** Update owned place. */
router.put('/:placeId', requirePlaceOwnerParam('placeId'), async (req, res) => {
  try {
    const id = req.ownsPlaceId || req.params.placeId;
    const v = validateBusinessPlacePut(req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const s = v.body;

    const setObj = {};
    if (s.name !== undefined) setObj.name = s.name;
    if (s.description !== undefined) setObj.description = s.description;
    if (s.location !== undefined) setObj.location = s.location;
    if (s.latitude !== undefined) setObj.latitude = s.latitude;
    if (s.longitude !== undefined) setObj.longitude = s.longitude;
    if (s.searchName !== undefined) setObj.search_name = s.searchName;
    if (s.images !== undefined) setObj.images = s.images;
    if (s.category !== undefined) setObj.category = s.category;
    if (s.categoryId !== undefined) setObj.category_id = s.categoryId;
    if (s.duration !== undefined) setObj.duration = s.duration;
    if (s.price !== undefined) setObj.price = s.price;
    if (s.bestTime !== undefined) setObj.best_time = s.bestTime;
    if (s.rating !== undefined) setObj.rating = s.rating;
    if (s.reviewCount !== undefined) setObj.review_count = s.reviewCount;
    if (s.hours !== undefined) setObj.hours = s.hours;
    if (s.tags !== undefined) setObj.tags = s.tags;
    if (s.diningProfile !== undefined) setObj.dining_profile = s.diningProfile || {};
    if (s.feedLinkingRestrictedToOwner !== undefined) setObj.feed_linking_restricted_to_owner = Boolean(s.feedLinkingRestrictedToOwner);
    if (s.feedLinkingDisabled !== undefined) setObj.feed_linking_disabled = Boolean(s.feedLinkingDisabled);
    
    setObj.updated_at = new Date();

    const placesColl = await getCollection('places');
    const result = await placesColl.updateOne({ id: id }, { $set: setObj });
    
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Place not found' });
    res.json({ id, message: 'Place updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update place' });
  }
});

module.exports = router;
