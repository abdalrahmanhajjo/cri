const express = require('express');
const { query: dbQuery } = require('../db');
const { getRequestLang } = require('../utils/requestLang');
const { parsePositiveInt } = require('../utils/validate');
const { optionalAuthMiddleware } = require('../middleware/auth');
const { sendDbAwareError } = require('../utils/dbHttpError');
const { SQL_PLACE_PROMOTIONS, SQL_PLACE_PROMOTIONS_FALLBACK } = require('../utils/activeOfferFilters');
const { rowToPlace, getUploadsBaseUrl, getPlaceReviewMeta, displayReviewAuthorName } = require('../utils/places');

const router = express.Router();

/** GET /api/places - List all places */
router.get('/', async (req, res) => {
  try {
    const baseUrl = getUploadsBaseUrl(req);
    const lang = getRequestLang(req);
    const { statsJoinSql } = await getPlaceReviewMeta();
    const result = await dbQuery(
      `SELECT p.id, p.latitude, p.longitude, p.images, p.rating, p.review_count, p.hours, p.search_name, p.category_id,
              pr_stats.app_avg_rating, pr_stats.app_review_count,
              COALESCE(pt.name, p.name) AS name, COALESCE(pt.description, p.description) AS description,
              COALESCE(pt.location, p.location) AS location, COALESCE(pt.category, p.category) AS category,
              COALESCE(pt.duration, p.duration) AS duration, COALESCE(pt.price, p.price) AS price,
              COALESCE(pt.best_time, p.best_time) AS best_time, COALESCE(pt.tags, p.tags) AS tags
       FROM places p
       LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $1
       ${statsJoinSql}
       ORDER BY p.name`,
      [lang]
    );
    const places = result.rows.map((r) => rowToPlace(r, baseUrl));
    res.json({ popular: places, locations: places });
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to fetch places');
  }
});

/** GET /api/places/:id/promotions */
router.get('/:id/promotions', async (req, res) => {
  const rawId = req.params.id;
  try {
    const { rows: placeRows } = await dbQuery('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;
    let rows;
    try {
      ({ rows } = await dbQuery(SQL_PLACE_PROMOTIONS, [placeId, 200]));
    } catch (err) {
      if (err.code !== '42P01') throw err;
      try {
        ({ rows } = await dbQuery(SQL_PLACE_PROMOTIONS_FALLBACK, [placeId, 200]));
      } catch (e2) {
        rows = [];
      }
    }
    res.json({
      placeId,
      promotions: rows.map(r => ({
        id: r.id, title: r.title, subtitle: r.subtitle, code: r.code,
        discountLabel: r.discountLabel, terms: r.terms, startsAt: r.startsAt, endsAt: r.endsAt
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load promotions' });
  }
});

/** GET /api/places/:id/reviews (Public) */
router.get('/:id/reviews', optionalAuthMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const viewerId = req.user?.userId || null;
  try {
    const { rows: placeRows } = await dbQuery('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;
    const { hasHiddenAt } = await getPlaceReviewMeta();
    const hiddenClause = hasHiddenAt ? 'AND r.hidden_at IS NULL' : '';
    const { rows } = await dbQuery(
      `SELECT r.id, r.rating, r.title, r.review, r.created_at, r.user_id, u.name AS user_name, u.email AS user_email
       FROM place_reviews r
       INNER JOIN users u ON u.id = r.user_id
       WHERE r.place_id = $1 ${hiddenClause}
       ORDER BY r.created_at DESC LIMIT 80`,
      [placeId]
    );
    res.json({
      placeId,
      reviews: rows.map(r => ({
        id: String(r.id), rating: r.rating, title: r.title, review: r.review,
        createdAt: r.created_at, authorName: displayReviewAuthorName(r.user_name, r.user_email),
        isYours: !!(viewerId && String(r.user_id) === String(viewerId))
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

/** GET /api/places/:id - Get single place details */
router.get('/:id', async (req, res) => {
  const rawId = req.params.id;
  const idResult = parsePositiveInt(rawId);
  const bySlug = !idResult.valid;
  try {
    const baseUrl = getUploadsBaseUrl(req);
    const lang = getRequestLang(req);
    const { statsJoinSql } = await getPlaceReviewMeta();
    const slugNorm = rawId.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    
    let result = bySlug
      ? await dbQuery(
        `SELECT p.id, p.latitude, p.longitude, p.images, p.rating, p.review_count, p.hours, p.search_name, p.category_id,
                pr_stats.app_avg_rating, pr_stats.app_review_count,
                COALESCE(pt.name, p.name) AS name, COALESCE(pt.description, p.description) AS description,
                COALESCE(pt.location, p.location) AS location, COALESCE(pt.category, p.category) AS category,
                COALESCE(pt.duration, p.duration) AS duration, COALESCE(pt.price, p.price) AS price,
                COALESCE(pt.best_time, p.best_time) AS best_time, COALESCE(pt.tags, p.tags) AS tags
         FROM places p
         LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $1
         ${statsJoinSql}
         WHERE p.id::text = $2 OR p.search_name = $2
            OR LOWER(REPLACE(REPLACE(COALESCE(p.search_name, ''), ' ', '_'), '-', '_')) = $3
            OR LOWER(REPLACE(REPLACE(COALESCE(p.name, ''), ' ', '_'), '-', '_')) = $3`,
        [lang, rawId, slugNorm]
      )
      : await dbQuery(
        `SELECT p.id, p.latitude, p.longitude, p.images, p.rating, p.review_count, p.hours, p.search_name, p.category_id,
                pr_stats.app_avg_rating, pr_stats.app_review_count,
                COALESCE(pt.name, p.name) AS name, COALESCE(pt.description, p.description) AS description,
                COALESCE(pt.location, p.location) AS location, COALESCE(pt.category, p.category) AS category,
                COALESCE(pt.duration, p.duration) AS duration, COALESCE(pt.price, p.price) AS price,
                COALESCE(pt.best_time, p.best_time) AS best_time, COALESCE(pt.tags, p.tags) AS tags
         FROM places p
         LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $1
         ${statsJoinSql}
         WHERE p.id = $2`,
        [lang, idResult.value]
      );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Place not found' });
    res.json(rowToPlace(result.rows[0], baseUrl));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
