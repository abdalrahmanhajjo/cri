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

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const id = (body.id || '').toString().trim() || ('tour_' + Date.now());
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const languages = safeJson(body.languages, []);
    const includes = safeJson(body.includes, []);
    const excludes = safeJson(body.excludes, []);
    const highlights = safeJson(body.highlights, []);
    const itinerary = safeJson(body.itinerary, []);
    const placeIds = safeJson(body.placeIds || body.place_ids, []);

    await query(
      `INSERT INTO tours (id, name, duration, duration_hours, locations, rating, reviews, price, currency, price_display, badge, badge_color, description, image, difficulty, languages, includes, excludes, highlights, itinerary, place_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, duration = EXCLUDED.duration, duration_hours = EXCLUDED.duration_hours,
         locations = EXCLUDED.locations, rating = EXCLUDED.rating, reviews = EXCLUDED.reviews,
         price = EXCLUDED.price, currency = EXCLUDED.currency, price_display = EXCLUDED.price_display,
         badge = EXCLUDED.badge, badge_color = EXCLUDED.badge_color, description = EXCLUDED.description,
         image = EXCLUDED.image, difficulty = EXCLUDED.difficulty, languages = EXCLUDED.languages,
         includes = EXCLUDED.includes, excludes = EXCLUDED.excludes, highlights = EXCLUDED.highlights,
         itinerary = EXCLUDED.itinerary, place_ids = EXCLUDED.place_ids`,
      [
        id,
        (body.name || 'Untitled Tour').toString(),
        (body.duration || '0').toString(),
        body.durationHours != null ? parseInt(body.durationHours, 10) : (body.duration_hours != null ? parseInt(body.duration_hours, 10) : 0),
        body.locations != null ? parseInt(body.locations, 10) : 0,
        body.rating != null ? parseFloat(body.rating) : 0,
        body.reviews != null ? parseInt(body.reviews, 10) : 0,
        body.price != null ? parseFloat(body.price) : 0,
        (body.currency || 'USD').toString(),
        (body.priceDisplay || body.price_display || '0').toString(),
        (body.badge || '').toString() || null,
        (body.badgeColor || body.badge_color || '').toString() || null,
        (body.description || '').toString(),
        (body.image || '').toString() || 'https://via.placeholder.com/400',
        (body.difficulty || 'Easy').toString(),
        JSON.stringify(languages),
        JSON.stringify(includes),
        JSON.stringify(excludes),
        JSON.stringify(highlights),
        JSON.stringify(itinerary),
        JSON.stringify(placeIds),
      ]
    );
    res.status(201).json({ id, message: 'Tour saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save tour', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const languages = body.languages !== undefined ? safeJson(body.languages, []) : null;
    const includes = body.includes !== undefined ? safeJson(body.includes, []) : null;
    const excludes = body.excludes !== undefined ? safeJson(body.excludes, []) : null;
    const highlights = body.highlights !== undefined ? safeJson(body.highlights, []) : null;
    const itinerary = body.itinerary !== undefined ? safeJson(body.itinerary, []) : null;
    const placeIds = body.placeIds !== undefined || body.place_ids !== undefined ? safeJson(body.placeIds ?? body.place_ids, []) : null;

    const result = await query(
      `UPDATE tours SET
         name = COALESCE($2, name), duration = COALESCE($3, duration), duration_hours = COALESCE($4, duration_hours),
         locations = COALESCE($5, locations), rating = COALESCE($6, rating), reviews = COALESCE($7, reviews),
         price = COALESCE($8, price), currency = COALESCE($9, currency), price_display = COALESCE($10, price_display),
         badge = COALESCE($11, badge), badge_color = COALESCE($12, badge_color), description = COALESCE($13, description),
         image = COALESCE($14, image), difficulty = COALESCE($15, difficulty), languages = COALESCE($16::jsonb, languages),
         includes = COALESCE($17::jsonb, includes), excludes = COALESCE($18::jsonb, excludes),
         highlights = COALESCE($19::jsonb, highlights), itinerary = COALESCE($20::jsonb, itinerary),
         place_ids = COALESCE($21::jsonb, place_ids)
       WHERE id = $1`,
      [
        id,
        body.name !== undefined ? String(body.name) : null,
        body.duration !== undefined ? String(body.duration) : null,
        body.durationHours !== undefined || body.duration_hours !== undefined ? parseInt(body.durationHours ?? body.duration_hours, 10) : null,
        body.locations !== undefined ? parseInt(body.locations, 10) : null,
        body.rating !== undefined ? parseFloat(body.rating) : null,
        body.reviews !== undefined ? parseInt(body.reviews, 10) : null,
        body.price !== undefined ? parseFloat(body.price) : null,
        body.currency !== undefined ? String(body.currency) : null,
        body.priceDisplay !== undefined || body.price_display !== undefined ? String(body.priceDisplay ?? body.price_display) : null,
        body.badge !== undefined ? String(body.badge) : null,
        body.badgeColor !== undefined || body.badge_color !== undefined ? String(body.badgeColor ?? body.badge_color) : null,
        body.description !== undefined ? String(body.description) : null,
        body.image !== undefined ? String(body.image) : null,
        body.difficulty !== undefined ? String(body.difficulty) : null,
        languages !== null ? JSON.stringify(languages) : null,
        includes !== null ? JSON.stringify(includes) : null,
        excludes !== null ? JSON.stringify(excludes) : null,
        highlights !== null ? JSON.stringify(highlights) : null,
        itinerary !== null ? JSON.stringify(itinerary) : null,
        placeIds !== null ? JSON.stringify(placeIds) : null,
      ]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Tour not found' });
    res.json({ id, message: 'Tour updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update tour', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await query('DELETE FROM tours WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Tour not found' });
    res.json({ message: 'Tour deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete tour', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

module.exports = router;
