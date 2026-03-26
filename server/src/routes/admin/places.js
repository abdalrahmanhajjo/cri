const express = require('express');
const { query } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

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

/** GET /api/admin/places?q=&limit= — search places for admin pickers (id, name, location) */
router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 100);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const params = [];
  let whereSql = '';
  if (q) {
    const idx = params.length + 1;
    params.push(`%${q}%`);
    whereSql = `WHERE (id ILIKE $${idx} OR name ILIKE $${idx} OR COALESCE(location, '') ILIKE $${idx})`;
  }
  const limIdx = params.length + 1;
  params.push(limit);
  try {
    const { rows } = await query(
      `SELECT id, name, COALESCE(location, '') AS location
       FROM places
       ${whereSql}
       ORDER BY name ASC
       LIMIT $${limIdx}`,
      params
    );
    res.json({
      places: rows.map((r) => ({
        id: r.id,
        name: r.name || '',
        location: r.location || '',
      })),
    });
  } catch (err) {
    if (err.code === '42P01') return res.json({ places: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to search places' });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const id = (body.id || '').toString().trim() || (body.name || 'place').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const images = safeJson(body.images, []);
    const tags = safeJson(body.tags, []);
    const imagesJson = JSON.stringify(Array.isArray(images) ? images : []);
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

    await query(
      `INSERT INTO places (id, name, description, location, latitude, longitude, search_name, images, category, category_id, duration, price, best_time, rating, review_count, hours, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description, location = EXCLUDED.location,
         latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, search_name = EXCLUDED.search_name,
         images = EXCLUDED.images, category = EXCLUDED.category, category_id = EXCLUDED.category_id,
         duration = EXCLUDED.duration, price = EXCLUDED.price, best_time = EXCLUDED.best_time,
         rating = EXCLUDED.rating, review_count = EXCLUDED.review_count, hours = EXCLUDED.hours, tags = EXCLUDED.tags`,
      [
        id,
        (body.name || '').toString(),
        (body.description || '').toString(),
        (body.location || '').toString(),
        body.latitude != null ? parseFloat(body.latitude) : null,
        body.longitude != null ? parseFloat(body.longitude) : null,
        (body.searchName || body.search_name || '').toString() || null,
        imagesJson,
        (body.category || '').toString() || null,
        (body.categoryId || body.category_id || '').toString() || null,
        (body.duration || '').toString() || null,
        (body.price || '').toString() || null,
        (body.bestTime || body.best_time || '').toString() || null,
        body.rating != null ? parseFloat(body.rating) : null,
        body.reviewCount != null || body.review_count != null ? parseInt(body.reviewCount ?? body.review_count, 10) : null,
        body.hours ? JSON.stringify(body.hours) : null,
        tagsJson,
      ]
    );
    res.status(201).json({ id, message: 'Place saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save place', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
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
    const { rows: placeRows } = await query('SELECT id FROM places WHERE id = $1', [placeId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const pid = placeRows[0].id;
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
        [pid]
      ));
    } catch (err) {
      if (err.code === '42P01') return res.json({ placeId: pid, reviews: [] });
      if (err.code === '42703' && String(err.message || '').includes('hidden_at')) {
        ({ rows } = await query(
          `SELECT r.id, r.rating, r.title, r.review, r.created_at, NULL::timestamptz AS hidden_at,
                  u.name AS user_name, u.email AS user_email
           FROM place_reviews r
           INNER JOIN users u ON u.id = r.user_id
           WHERE r.place_id = $1
           ORDER BY r.created_at DESC
           LIMIT 200`,
          [pid]
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
    res.json({ placeId: pid, reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load reviews', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const images = safeJson(body.images, []);
    const tags = safeJson(body.tags, []);
    const imagesJson = JSON.stringify(Array.isArray(images) ? images : []);
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

    const result = await query(
      `UPDATE places SET
         name = COALESCE($2, name), description = COALESCE($3, description), location = COALESCE($4, location),
         latitude = COALESCE($5, latitude), longitude = COALESCE($6, longitude), search_name = COALESCE($7, search_name),
         images = COALESCE($8::jsonb, images), category = COALESCE($9, category), category_id = COALESCE($10, category_id),
         duration = COALESCE($11, duration), price = COALESCE($12, price), best_time = COALESCE($13, best_time),
         rating = COALESCE($14, rating), review_count = COALESCE($15, review_count), hours = COALESCE($16::jsonb, hours), tags = COALESCE($17::jsonb, tags)
       WHERE id = $1`,
      [
        id,
        body.name !== undefined ? String(body.name) : null,
        body.description !== undefined ? String(body.description) : null,
        body.location !== undefined ? String(body.location) : null,
        body.latitude !== undefined ? (body.latitude == null ? null : parseFloat(body.latitude)) : null,
        body.longitude !== undefined ? (body.longitude == null ? null : parseFloat(body.longitude)) : null,
        body.searchName !== undefined || body.search_name !== undefined ? String(body.searchName ?? body.search_name ?? '') : null,
        body.images !== undefined ? imagesJson : null,
        body.category !== undefined ? String(body.category) : null,
        body.categoryId !== undefined || body.category_id !== undefined ? String(body.categoryId ?? body.category_id ?? '') : null,
        body.duration !== undefined ? String(body.duration) : null,
        body.price !== undefined ? String(body.price) : null,
        body.bestTime !== undefined || body.best_time !== undefined ? String(body.bestTime ?? body.best_time ?? '') : null,
        body.rating !== undefined ? (body.rating == null ? null : parseFloat(body.rating)) : null,
        body.reviewCount !== undefined || body.review_count !== undefined ? (body.reviewCount ?? body.review_count) : null,
        body.hours !== undefined ? JSON.stringify(body.hours) : null,
        body.tags !== undefined ? tagsJson : null,
      ]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Place not found' });
    res.json({ id, message: 'Place updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update place', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await query('DELETE FROM places WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Place not found' });
    res.json({ message: 'Place deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete place', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

module.exports = router;
