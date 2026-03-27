const express = require('express');
const { query } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { validate } = require('../../middleware/validation');
const { adminEventSchema } = require('../../schemas/admin');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

router.post('/', validate(adminEventSchema), async (req, res) => {
  try {
    const body = req.body || {};
    const id = (body.id || '').toString().trim() || ('event_' + Date.now());
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const startDate = body.startDate || body.start_date || new Date().toISOString();
    const endDate = body.endDate || body.end_date || new Date(Date.now() + 3600000).toISOString();

    await query(
      `INSERT INTO events (id, name, description, start_date, end_date, location, image, category, organizer, price, price_display, status, place_id)
       VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
         location = EXCLUDED.location, image = EXCLUDED.image, category = EXCLUDED.category, organizer = EXCLUDED.organizer,
         price = EXCLUDED.price, price_display = EXCLUDED.price_display, status = EXCLUDED.status, place_id = EXCLUDED.place_id`,
      [
        id,
        (body.name || 'Untitled Event').toString(),
        (body.description || '').toString(),
        startDate,
        endDate,
        (body.location || '').toString(),
        (body.image || '').toString() || null,
        (body.category || '').toString(),
        (body.organizer || '').toString() || null,
        body.price != null ? parseFloat(body.price) : null,
        (body.priceDisplay || body.price_display || '').toString() || null,
        (body.status || 'active').toString(),
        (body.placeId || body.place_id || '').toString() || null,
      ]
    );
    res.status(201).json({ id, message: 'Event saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save event', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

router.put('/:id', validate(adminEventSchema.partial()), async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const startDate = body.startDate !== undefined || body.start_date !== undefined ? (body.startDate ?? body.start_date) : null;
    const endDate = body.endDate !== undefined || body.end_date !== undefined ? (body.endDate ?? body.end_date) : null;

    const result = await query(
      `UPDATE events SET
         name = COALESCE($2, name), description = COALESCE($3, description),
         start_date = COALESCE($4::timestamptz, start_date), end_date = COALESCE($5::timestamptz, end_date),
         location = COALESCE($6, location), image = COALESCE($7, image), category = COALESCE($8, category),
         organizer = COALESCE($9, organizer), price = COALESCE($10, price), price_display = COALESCE($11, price_display),
         status = COALESCE($12, status), place_id = COALESCE($13, place_id)
       WHERE id = $1`,
      [
        id,
        body.name !== undefined ? String(body.name) : null,
        body.description !== undefined ? String(body.description) : null,
        startDate,
        endDate,
        body.location !== undefined ? String(body.location) : null,
        body.image !== undefined ? String(body.image) : null,
        body.category !== undefined ? String(body.category) : null,
        body.organizer !== undefined ? String(body.organizer) : null,
        body.price !== undefined ? parseFloat(body.price) : null,
        body.priceDisplay !== undefined || body.price_display !== undefined ? String(body.priceDisplay ?? body.price_display) : null,
        body.status !== undefined ? String(body.status) : null,
        body.placeId !== undefined || body.place_id !== undefined ? String(body.placeId ?? body.place_id) : null,
      ]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ id, message: 'Event updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update event', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await query('DELETE FROM events WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

module.exports = router;
