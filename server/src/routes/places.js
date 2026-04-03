const express = require('express');
const { haversineMeters } = require('../utils/geo');
const { getCollection, getMongoDb } = require('../mongo');
const { getRequestLang } = require('../utils/requestLang');
const { parsePositiveInt, parsePlacesListPagination } = require('../utils/validate');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { sendDbAwareError } = require('../utils/dbHttpError');

const router = express.Router();
const { visitorFollowupsFromDb } = require('../utils/inquiryFollowups');
const { isMessagingBlocked } = require('../utils/messagingBlocks');
const { normalizeDbText } = require('../utils/normalizeDbText');
const { cachePublicList } = require('../middleware/publicCache');
const { listPlaces } = require('../repositories/publicContent');

const MAX_VISITOR_FOLLOWUPS_PER_INQUIRY = 50;

async function userIsAdmin(userId) {
  if (!userId) return false;
  const allowEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  try {
    const users = await getCollection('users');
    const user = await users.findOne({ id: userId });
    if (!user) return false;
    if (user.is_admin === true) return true;
    const email = (user.email || '').toLowerCase();
    return allowEmails.length > 0 && allowEmails.includes(email);
  } catch {
    return false;
  }
}

async function userManagesPlace(userId, placeId) {
  try {
    const placeOwners = await getCollection('place_owners');
    const row = await placeOwners.findOne({ user_id: userId, place_id: placeId });
    return !!row;
  } catch {
    return false;
  }
}

function isValidContactEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

function isPlausiblePhone(s) {
  const t = String(s || '').trim();
  if (t.length < 8 || t.length > 40) return false;
  const digits = (t.match(/\d/g) || []).length;
  return digits >= 8;
}

function fixImageUrlExtension(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/([a-f0-9]{32})(jpe?g|png|gif|webp|heic|heif)$/i, '$1.$2');
}

function resolveImageUrls(images, baseUrl) {
  if (!Array.isArray(images)) return [];
  const base = (baseUrl || process.env.UPLOADS_BASE_URL || '').replace(/\/$/, '');
  return images.filter(Boolean).map((url) => {
    if (!url || typeof url !== 'string') return null;
    url = fixImageUrlExtension(url);
    if (url.startsWith('http')) return url;
    if (url.startsWith('/') && base) return base + url;
    return url;
  }).filter(Boolean);
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((x) => (typeof x === 'string' ? normalizeDbText(x) : x));
  }
  if (typeof tags === 'string') return normalizeDbText(tags);
  return tags;
}

function docToPlace(doc, baseUrl) {
  let images = Array.isArray(doc.images) ? doc.images : [];
  images = resolveImageUrls(images, baseUrl);
  const diningProfile = doc.diningProfile || {};
  const appN = doc.app_review_count != null ? Number(doc.app_review_count) : 0;
  const appAvg = doc.app_avg_rating != null ? Number(doc.app_avg_rating) : null;
  const useAppReviews = appN > 0 && appAvg != null && Number.isFinite(appAvg);
  const rating = useAppReviews ? appAvg : doc.rating != null ? Number(doc.rating) : null;
  const reviewCount = useAppReviews
    ? appN
    : doc.reviewCount != null
      ? Number(doc.reviewCount)
      : null;
      
  const result = {
    id: doc.id,
    name: normalizeDbText(doc.name),
    description: normalizeDbText(doc.description || ''),
    location: normalizeDbText(doc.location || ''),
    latitude: doc.latitude ?? null,
    longitude: doc.longitude ?? null,
    images,
    category: normalizeDbText(doc.category || ''),
    categoryId: doc.categoryId,
    duration: doc.duration != null ? normalizeDbText(String(doc.duration)) : doc.duration,
    price: doc.price != null ? normalizeDbText(String(doc.price)) : doc.price,
    bestTime: doc.bestTime != null ? normalizeDbText(String(doc.bestTime)) : doc.bestTime,
    rating: rating != null && Number.isFinite(rating) ? rating : null,
    reviewCount:
      reviewCount != null && Number.isFinite(reviewCount) ? Math.round(reviewCount) : null,
    hours: typeof doc.hours === 'string' ? normalizeDbText(doc.hours) : doc.hours,
    diningProfile,
    tags: normalizeTags(doc.tags),
    searchName: doc.searchName != null ? normalizeDbText(String(doc.searchName)) : doc.searchName
  };
  if (doc.latitude != null && doc.longitude != null) result.coordinates = { lat: doc.latitude, lng: doc.longitude };
  if (images.length === 1) result.image = images[0];
  return result;
}

function getUploadsBaseUrl(req) {
  if (process.env.UPLOADS_BASE_URL) return process.env.UPLOADS_BASE_URL;
  const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:' + (process.env.PORT || 3095);
  return proto + '://' + host;
}

router.get('/', cachePublicList(60, 300), async (req, res) => {
  try {
    const baseUrl = getUploadsBaseUrl(req);
    const lang = getRequestLang(req);
    const pag = parsePlacesListPagination(req.query);
    if (pag.invalid) {
      return res.status(400).json({ error: pag.invalid });
    }
    
    const result = await listPlaces(lang, {
      usePagination: pag.usePagination,
      limit: pag.limit,
      offset: pag.offset,
    });
    
    const total = result.total ?? 0;
    const places = result.places.map((r) => docToPlace(r, baseUrl));
    
    const response = {
      popular: places,
      locations: places
    };
    
    if (pag.usePagination) {
      const end = pag.offset + places.length;
      response.page = {
        limit: pag.limit,
        offset: pag.offset,
        total,
        hasMore: end < total,
      };
    }
    
    res.json(response);
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to fetch places');
  }
});

/** Public: active promotions + coupons for a place. */
router.get('/:id/promotions', async (req, res) => {
  const rawId = req.params.id;
  const lang = getRequestLang(req);
  const now = new Date();
  try {
    const places = await getCollection('places');
    const place = await places.findOne({ id: rawId });
    if (!place) return res.status(404).json({ error: 'Place not found' });
    
    const promoColl = await getCollection('place_promotions');
    const rows = await promoColl.aggregate([
      { $match: {
          place_id: place.id,
          active: true,
          $or: [{ starts_at: null }, { starts_at: { $lte: now } }],
          $or: [{ ends_at: null }, { ends_at: { $gte: now } }]
      }},
      { $sort: { created_at: -1 } }
    ]).toArray();
    
    const promotions = rows.map((r) => {
      const tr = r.translations ? r.translations[lang] : null;
      return {
        id: r.id,
        placeId: r.place_id,
        title: tr?.title || r.title,
        subtitle: tr?.subtitle || r.subtitle,
        code: r.code,
        discountLabel: tr?.discount_label || r.discount_label,
        terms: tr?.terms || r.terms,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
      };
    });
    
    res.json({ placeId: place.id, promotions });
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to load promotions');
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

/** Public: visitor reviews. */
router.get('/:id/reviews', optionalAuthMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const viewerId = req.user?.userId || null;
  try {
    const places = await getCollection('places');
    const place = await places.findOne({ id: rawId });
    if (!place) return res.status(404).json({ error: 'Place not found' });
    
    const reviewsColl = await getCollection('place_reviews');
    const rows = await reviewsColl.aggregate([
      { $match: { place_id: place.id, hidden_at: null } },
      { $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'author'
      }},
      { $unwind: '$author' },
      { $sort: { created_at: -1 } },
      { $limit: 80 }
    ]).toArray();
    
    const reviews = rows.map((r) => ({
      id: String(r._id),
      rating: r.rating,
      title: r.title || null,
      review: r.review || null,
      createdAt: r.created_at,
      authorName: displayReviewAuthorName(r.author.name, r.author.email),
      isYours: !!(viewerId && String(r.user_id) === String(viewerId)),
    }));
    res.json({ placeId: place.id, reviews });
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to load reviews');
  }
});

/** Save or update review. */
router.post('/:id/reviews', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const userId = req.user.userId;
  const ratingRaw = req.body?.rating;
  const rating = parseInt(String(ratingRaw), 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 200) : '';
  let text = typeof req.body?.review === 'string' ? req.body.review.trim() : '';
  if (text.length > 8000) text = text.slice(0, 8000);
  if (text.length > 0 && text.length < 4) {
    return res.status(400).json({
      error: 'Review text must be at least 4 characters, or leave it empty to submit stars only.',
    });
  }

  try {
    const places = await getCollection('places');
    const place = await places.findOne({ id: rawId });
    if (!place) return res.status(404).json({ error: 'Place not found' });
    
    const reviewsColl = await getCollection('place_reviews');
    const existing = await reviewsColl.findOne({ place_id: place.id, user_id: userId });
    
    if (existing && existing.hidden_at != null) {
      const isAdm = await userIsAdmin(userId);
      if (!isAdm) {
        return res.status(403).json({
          error: 'This review is hidden by the venue or an administrator.',
          code: 'REVIEW_HIDDEN',
        });
      }
    }
    
    const update = {
      place_id: place.id,
      user_id: userId,
      rating,
      title: title || null,
      review: text || null,
      updated_at: new Date(),
    };
    
    if (existing) {
       await reviewsColl.updateOne({ _id: existing._id }, { $set: { ...update, created_at: existing.created_at || new Date() } });
    } else {
       await reviewsColl.insertOne({ ...update, created_at: new Date() });
    }
    
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Could not save review');
  }
});

/** Delete review. */
router.delete('/:id/reviews/:reviewId', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const reviewId = req.params.reviewId;
  const userId = req.user.userId;
  
  try {
    const places = await getCollection('places');
    const place = await places.findOne({ id: rawId });
    if (!place) return res.status(404).json({ error: 'Place not found' });

    const reviewsColl = await getCollection('place_reviews');
    const { ObjectId } = require('mongodb');
    let queryObj;
    try { queryObj = { _id: new ObjectId(reviewId) }; } catch { queryObj = { id: reviewId }; }
    
    const rev = await reviewsColl.findOne(queryObj);
    if (!rev) return res.status(404).json({ error: 'Review not found' });
    if (rev.place_id !== place.id) return res.status(404).json({ error: 'Review not found' });

    const isAuthor = String(rev.user_id) === String(userId);
    const isAdm = await userIsAdmin(userId);
    const owns = await userManagesPlace(userId, place.id);
    if (!isAuthor && !isAdm && !owns) {
      return res.status(403).json({ error: 'You cannot delete this review' });
    }

    await reviewsColl.deleteOne(queryObj);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return sendDbAwareError(res, err, 'Could not delete review');
  }
});

/** Check-in. */
router.post('/:id/checkin', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const userId = req.user.userId;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : null;
  
  try {
    const places = await getCollection('places');
    const place = await places.findOne({ id: rawId });
    if (!place) return res.status(404).json({ error: 'Place not found' });
    
    const plat = place.latitude != null ? Number(place.latitude) : null;
    const plng = place.longitude != null ? Number(place.longitude) : null;
    const maxM = parseInt(process.env.CHECKIN_MAX_DISTANCE_METERS || '400', 10);
    
    if (plat && plng && maxM > 0) {
      const uLat = parseFloat(req.body?.latitude);
      const uLng = parseFloat(req.body?.longitude);
      if (!Number.isFinite(uLat) || !Number.isFinite(uLng)) {
        return res.status(400).json({ error: 'Location required', code: 'LOCATION_REQUIRED' });
      }
      const dist = haversineMeters(uLat, uLng, plat, plng);
      if (dist > maxM) {
        return res.status(400).json({ error: 'Too far', code: 'TOO_FAR', distanceMeters: Math.round(dist) });
      }
    }

    const checkins = await getCollection('place_checkins');
    // Check if already checked in today (UTC)
    const today = new Date();
    today.setUTCHours(0,0,0,0);
    const existing = await checkins.findOne({
      place_id: place.id,
      user_id: userId,
      created_at: { $gte: today }
    });
    
    if (existing) {
      return res.status(200).json({ ok: true, alreadyCheckedInToday: true, placeId: place.id });
    }
    
    await checkins.insertOne({
      place_id: place.id,
      user_id: userId,
      note,
      created_at: new Date()
    });
    
    res.status(201).json({ ok: true, placeId: place.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Check-in failed' });
  }
});

/** Search/Details. */
router.get('/:id', async (req, res) => {
  const rawId = req.params.id;
  try {
    const baseUrl = getUploadsBaseUrl(req);
    const lang = getRequestLang(req);
    const places = await getCollection('places');
    
    // Normalizing slug matching
    const slugNorm = rawId.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    
    // MongoDB query to find by ID or searchName or name matching slug
    const place = await places.findOne({
      $or: [
        { id: rawId },
        { searchName: rawId },
        { name: new RegExp('^' + rawId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      ]
    });
    
    if (!place) return res.status(404).json({ error: 'Place not found' });
    res.json(docToPlace(place, baseUrl));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch place' });
  }
});

module.exports = router;
