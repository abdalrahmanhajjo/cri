const express = require('express');
const { query } = require('../db');
const { getRequestLang } = require('../utils/requestLang');
const { parsePositiveInt } = require('../utils/validate');
const { sendDbAwareError } = require('../utils/dbHttpError');
const { normalizeDbText } = require('../utils/normalizeDbText');
const { cachePublicList } = require('../middleware/publicCache');

const router = express.Router();

function rowToEvent(row) {
  return {
    id: row.id,
    name: normalizeDbText(row.name),
    description: normalizeDbText(row.description || ''),
    startDate: row.start_date instanceof Date ? row.start_date.toISOString() : row.start_date,
    endDate: row.end_date instanceof Date ? row.end_date.toISOString() : row.end_date,
    location: normalizeDbText(row.location || ''),
    image: row.image,
    category: normalizeDbText(row.category || ''),
    organizer: normalizeDbText(row.organizer || ''),
    price: row.price,
    priceDisplay: row.price_display != null ? normalizeDbText(String(row.price_display)) : row.price_display,
    status: row.status != null ? normalizeDbText(String(row.status)) : row.status,
    placeId: row.place_id
  };
}

router.get('/', cachePublicList(45, 240), async (req, res) => {
  try {
    const lang = getRequestLang(req);
    const result = await query(
      `SELECT e.id, e.start_date, e.end_date, e.image, e.price, e.place_id,
              COALESCE(et.name, e.name) AS name, COALESCE(et.description, e.description) AS description,
              COALESCE(et.location, e.location) AS location, COALESCE(et.category, e.category) AS category,
              COALESCE(et.organizer, e.organizer) AS organizer,
              COALESCE(et.price_display, e.price_display) AS price_display,
              COALESCE(et.status, e.status) AS status
       FROM events e
       LEFT JOIN event_translations et ON et.event_id = e.id AND et.lang = $1
       ORDER BY e.start_date DESC`,
      [lang]
    );
    res.json({ events: result.rows.map(rowToEvent) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch events', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

router.get('/:id', async (req, res) => {
  const idResult = parsePositiveInt(req.params.id);
  if (!idResult.valid) return res.status(400).json({ error: 'Invalid event id' });
  try {
    const lang = getRequestLang(req);
    const result = await query(
      `SELECT e.id, e.start_date, e.end_date, e.image, e.price, e.place_id,
              COALESCE(et.name, e.name) AS name, COALESCE(et.description, e.description) AS description,
              COALESCE(et.location, e.location) AS location, COALESCE(et.category, e.category) AS category,
              COALESCE(et.organizer, e.organizer) AS organizer,
              COALESCE(et.price_display, e.price_display) AS price_display,
              COALESCE(et.status, e.status) AS status
       FROM events e
       LEFT JOIN event_translations et ON et.event_id = e.id AND et.lang = $1
       WHERE e.id = $2`,
      [lang, idResult.value]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json(rowToEvent(result.rows[0]));
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to fetch event');
  }
});

module.exports = router;
