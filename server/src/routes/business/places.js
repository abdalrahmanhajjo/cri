const express = require('express');
const { query } = require('../../db');
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
  };
}

/** List places this user manages (via place_owners). */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rows } = await query(
      `SELECT p.id, p.name, p.location, p.category, p.images, p.rating, p.latitude, p.longitude
       FROM places p
       INNER JOIN place_owners po ON po.place_id = p.id AND po.user_id = $1
       ORDER BY p.name`,
      [userId]
    );
    res.json({
      places: rows.map((r) => ({
        id: r.id,
        name: normalizeDbText(r.name || ''),
        location: normalizeDbText(r.location || ''),
        category: normalizeDbText(r.category || ''),
        images: safeJson(r.images, []),
        rating: r.rating,
        latitude: r.latitude,
        longitude: r.longitude,
      })),
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

/** Member reviews for an owned place (including hidden). Must be before /:placeId/translations. */
router.get('/:placeId/reviews', requirePlaceOwnerParam('placeId'), async (req, res) => {
  const placeId = req.ownsPlaceId || req.params.placeId;
  try {
    let rows;
    try {
      ({ rows } = await query(
        `SELECT r.id, r.rating, r.title, r.review, r.created_at, r.hidden_at,
                u.name AS user_name, u.email AS user_email
         FROM place_reviews r
         INNER JOIN users u ON u.id = r.user_id
         WHERE r.place_id = $1
         ORDER BY r.created_at DESC
         LIMIT 200`,
        [placeId]
      ));
    } catch (err) {
      if (err.code === '42P01') return res.json({ placeId, reviews: [] });
      if (err.code === '42703' && String(err.message || '').includes('hidden_at')) {
        ({ rows } = await query(
          `SELECT r.id, r.rating, r.title, r.review, r.created_at, NULL::timestamptz AS hidden_at,
                  u.name AS user_name, u.email AS user_email
           FROM place_reviews r
           INNER JOIN users u ON u.id = r.user_id
           WHERE r.place_id = $1
           ORDER BY r.created_at DESC
           LIMIT 200`,
          [placeId]
        ));
      } else {
        throw err;
      }
    }
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
    res.status(500).json({ error: 'Failed to load reviews', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

/** Per-language copy (must be registered before /:placeId). */
router.get('/:placeId/translations', requirePlaceOwnerParam('placeId'), async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT place_id, lang, name, description, location, category, duration, price, best_time, tags FROM place_translations WHERE place_id = $1 ORDER BY lang',
      [req.params.placeId]
    );
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
        tags: safeJson(r.tags, []),
      })),
    });
  } catch (err) {
    if (err.code === '42P01') return res.json({ translations: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to load translations' });
  }
});

const LANG_RE = /^[a-z]{2}(-[a-z]{2})?$/i;

router.put('/:placeId/translations/:lang', requirePlaceOwnerParam('placeId'), async (req, res) => {
  const lang = (req.params.lang || '').trim().toLowerCase();
  if (!LANG_RE.test(lang)) return res.status(400).json({ error: 'Invalid language code' });
  const placeId = req.ownsPlaceId || req.params.placeId;

  const v = validateTranslationPut(req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });
  const b = v.body;
  const tagsJson = JSON.stringify(Array.isArray(b.tags) ? b.tags : []);

  try {
    await query(
      `INSERT INTO place_translations (place_id, lang, name, description, location, category, duration, price, best_time, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       ON CONFLICT (lang, place_id) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description, location = EXCLUDED.location,
         category = EXCLUDED.category, duration = EXCLUDED.duration, price = EXCLUDED.price,
         best_time = EXCLUDED.best_time, tags = EXCLUDED.tags`,
      [
        placeId,
        lang,
        b.name != null ? b.name : null,
        b.description != null ? b.description : null,
        b.location != null ? b.location : null,
        b.category != null ? b.category : null,
        b.duration != null ? b.duration : null,
        b.price != null ? b.price : null,
        b.bestTime != null ? b.bestTime : null,
        tagsJson,
      ]
    );
    res.json({ placeId, lang, message: 'Translation saved' });
  } catch (err) {
    if (err.code === '42P01') return res.status(503).json({ error: 'Translations table not available' });
    console.error(err);
    res.status(500).json({ error: 'Failed to save translation' });
  }
});

/** Full place row for editing (base language / catalogue fields). */
router.get('/:placeId', requirePlaceOwnerParam('placeId'), async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM places WHERE id = $1', [req.params.placeId]);
    if (!rows.length) return res.status(404).json({ error: 'Place not found' });
    res.json(rowToEditorPlace(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load place' });
  }
});

/** Same field set as admin PUT /api/admin/places/:id — only for owned places. */
router.put('/:placeId', requirePlaceOwnerParam('placeId'), async (req, res) => {
  try {
    const id = req.ownsPlaceId || req.params.placeId;
    const v = validateBusinessPlacePut(req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const s = v.body;

    const imagesJson = s.images !== undefined ? JSON.stringify(s.images) : null;
    const tagsJson = s.tags !== undefined ? JSON.stringify(s.tags) : null;
    const diningProfileJson = s.diningProfile !== undefined ? JSON.stringify(s.diningProfile || {}) : null;

    const result = await query(
      `UPDATE places SET
         name = COALESCE($2, name), description = COALESCE($3, description), location = COALESCE($4, location),
         latitude = COALESCE($5, latitude), longitude = COALESCE($6, longitude), search_name = COALESCE($7, search_name),
         images = COALESCE($8::jsonb, images), category = COALESCE($9, category), category_id = COALESCE($10, category_id),
         duration = COALESCE($11, duration), price = COALESCE($12, price), best_time = COALESCE($13, best_time),
         rating = COALESCE($14, rating), review_count = COALESCE($15, review_count), hours = COALESCE($16::jsonb, hours), tags = COALESCE($17::jsonb, tags),
         dining_profile = COALESCE($18::jsonb, dining_profile)
       WHERE id = $1`,
      [
        id,
        s.name !== undefined ? s.name : null,
        s.description !== undefined ? s.description : null,
        s.location !== undefined ? s.location : null,
        s.latitude !== undefined ? s.latitude : null,
        s.longitude !== undefined ? s.longitude : null,
        s.searchName !== undefined ? s.searchName : null,
        imagesJson,
        s.category !== undefined ? s.category : null,
        s.categoryId !== undefined ? s.categoryId : null,
        s.duration !== undefined ? s.duration : null,
        s.price !== undefined ? s.price : null,
        s.bestTime !== undefined ? s.bestTime : null,
        s.rating !== undefined ? s.rating : null,
        s.reviewCount !== undefined ? s.reviewCount : null,
        s.hours !== undefined ? JSON.stringify(s.hours) : null,
        tagsJson,
        diningProfileJson,
      ]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Place not found' });
    res.json({ id, message: 'Place updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update place', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

module.exports = router;
