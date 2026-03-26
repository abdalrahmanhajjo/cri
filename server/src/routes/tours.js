const express = require('express');
const { query } = require('../db');
const { getRequestLang } = require('../utils/requestLang');
const { parsePlaceId } = require('../utils/validate');
const { sendDbAwareError } = require('../utils/dbHttpError');

const router = express.Router();

function rowToTour(row) {
  return {
    id: row.id,
    name: row.name,
    duration: row.duration,
    durationHours: row.duration_hours,
    locations: row.locations,
    rating: row.rating,
    reviews: row.reviews,
    price: row.price,
    currency: row.currency,
    priceDisplay: row.price_display,
    badge: row.badge,
    badgeColor: row.badge_color,
    description: row.description,
    image: row.image,
    difficulty: row.difficulty,
    languages: Array.isArray(row.languages) ? row.languages : (row.languages ? JSON.parse(row.languages) : []),
    includes: Array.isArray(row.includes) ? row.includes : (row.includes ? JSON.parse(row.includes) : []),
    excludes: Array.isArray(row.excludes) ? row.excludes : (row.excludes ? JSON.parse(row.excludes) : []),
    highlights: Array.isArray(row.highlights) ? row.highlights : (row.highlights ? JSON.parse(row.highlights) : []),
    itinerary: Array.isArray(row.itinerary) ? row.itinerary : (row.itinerary ? JSON.parse(row.itinerary) : []),
    placeIds: Array.isArray(row.place_ids) ? row.place_ids : (row.place_ids ? JSON.parse(row.place_ids) : [])
  };
}

router.get('/', async (req, res) => {
  try {
    const lang = getRequestLang(req);
    const result = await query(
      `SELECT t.id, t.duration_hours, t.locations, t.rating, t.reviews, t.price, t.currency, t.image, t.place_ids,
              COALESCE(tt.name, t.name) AS name, COALESCE(tt.duration, t.duration) AS duration,
              COALESCE(tt.price_display, t.price_display) AS price_display,
              COALESCE(tt.badge, t.badge) AS badge, t.badge_color,
              COALESCE(tt.description, t.description) AS description,
              COALESCE(tt.difficulty, t.difficulty) AS difficulty,
              COALESCE(tt.includes, t.includes) AS includes,
              COALESCE(tt.excludes, t.excludes) AS excludes,
              COALESCE(tt.highlights, t.highlights) AS highlights,
              COALESCE(tt.itinerary, t.itinerary) AS itinerary,
              t.languages
       FROM tours t
       LEFT JOIN tour_translations tt ON tt.tour_id = t.id AND tt.lang = $1
       ORDER BY t.name`,
      [lang]
    );
    res.json({ featured: result.rows.map(rowToTour) });
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to fetch tours');
  }
});

router.get('/:id', async (req, res) => {
  const idResult = parsePlaceId(req.params.id);
  if (!idResult.valid) return res.status(400).json({ error: 'Invalid tour id' });
  try {
    const lang = getRequestLang(req);
    const result = await query(
      `SELECT t.id, t.duration_hours, t.locations, t.rating, t.reviews, t.price, t.currency, t.image, t.place_ids,
              COALESCE(tt.name, t.name) AS name, COALESCE(tt.duration, t.duration) AS duration,
              COALESCE(tt.price_display, t.price_display) AS price_display,
              COALESCE(tt.badge, t.badge) AS badge, t.badge_color,
              COALESCE(tt.description, t.description) AS description,
              COALESCE(tt.difficulty, t.difficulty) AS difficulty,
              COALESCE(tt.includes, t.includes) AS includes,
              COALESCE(tt.excludes, t.excludes) AS excludes,
              COALESCE(tt.highlights, t.highlights) AS highlights,
              COALESCE(tt.itinerary, t.itinerary) AS itinerary,
              t.languages
       FROM tours t
       LEFT JOIN tour_translations tt ON tt.tour_id = t.id AND tt.lang = $1
       WHERE t.id = $2`,
      [lang, idResult.value]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tour not found' });
    res.json(rowToTour(result.rows[0]));
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to fetch tour');
  }
});

module.exports = router;
