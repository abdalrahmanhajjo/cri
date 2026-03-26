const express = require('express');
const { query } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { assertAllowedTableName } = require('../../utils/sqlIdentifiers');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

/** Only these tables may be counted (defense in depth — names are not user-controlled today). */
const STATS_COUNT_TABLES = new Set([
  'users',
  'places',
  'categories',
  'tours',
  'events',
  'trips',
  'feed_posts',
  'interests',
  'saved_places',
]);

async function countTable(name) {
  try {
    const safe = assertAllowedTableName(name, STATS_COUNT_TABLES);
    const { rows } = await query(`SELECT COUNT(*)::int AS c FROM ${safe}`);
    return rows[0]?.c ?? 0;
  } catch {
    return 0;
  }
}

/** GET /api/admin/stats — dashboard aggregates (shared DB: app + web) */
router.get('/', async (req, res) => {
  try {
    const [
      users,
      places,
      categories,
      tours,
      events,
      trips,
      feedPosts,
      interests,
      savedPlaces,
    ] = await Promise.all([
      countTable('users'),
      countTable('places'),
      countTable('categories'),
      countTable('tours'),
      countTable('events'),
      countTable('trips'),
      countTable('feed_posts'),
      countTable('interests'),
      countTable('saved_places'),
    ]);
    res.json({
      users,
      places,
      categories,
      tours,
      events,
      trips,
      feedPosts,
      interests,
      savedPlaces,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
