const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { query } = require('../../db');
const { parsePlaceId } = require('../../utils/validate');

const router = express.Router();
router.use(authMiddleware, businessPortalMiddleware);

async function assertOwnsPlace(userId, placeId) {
  const { rows } = await query(
    'SELECT 1 FROM place_owners WHERE user_id = $1 AND place_id = $2',
    [userId, placeId]
  );
  return rows.length > 0;
}

/**
 * GET /api/business/insights?placeId=
 * Trip planners who included this place in an itinerary, and users who checked in.
 */
router.get('/', async (req, res) => {
  const parsed = parsePlaceId(req.query.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'Valid placeId query required' });
  const placeId = parsed.value;
  const userId = req.user.userId;
  if (!(await assertOwnsPlace(userId, placeId))) {
    return res.status(403).json({ error: 'You do not manage this place' });
  }

  let tripPlanners = [];
  let checkins = [];
  let tripsUnavailable = false;
  let checkinsUnavailable = false;

  try {
    const tripsResult = await query(
      `SELECT t.id AS trip_id,
              t.name AS trip_name,
              t.user_id,
              u.name AS user_name,
              u.email AS user_email,
              t.created_at AS trip_created_at
       FROM trips t
       INNER JOIN users u ON u.id = t.user_id
       WHERE EXISTS (
         SELECT 1
         FROM jsonb_array_elements(COALESCE(t.days, '[]'::jsonb)) AS day,
         LATERAL jsonb_array_elements_text(COALESCE(day->'placeIds', '[]'::jsonb)) AS pid
         WHERE pid = $1::text OR pid::text = $1::text
       )
       ORDER BY t.created_at DESC
       LIMIT 200`,
      [placeId]
    );
    tripPlanners = tripsResult.rows.map((r) => ({
      tripId: r.trip_id,
      tripName: r.trip_name,
      userId: r.user_id,
      userName: r.user_name || '',
      userEmail: r.user_email || '',
      tripCreatedAt: r.trip_created_at,
    }));
  } catch (err) {
    if (err.code === '42P01') {
      tripsUnavailable = true;
    } else {
      console.error('[insights] trips', err);
      return res.status(500).json({
        error: 'Failed to load trip planner data',
        detail: process.env.NODE_ENV !== 'production' ? err.message : undefined,
      });
    }
  }

  try {
    const checkinsResult = await query(
      `SELECT c.id, c.user_id, u.name AS user_name, u.email AS user_email, c.note, c.created_at
       FROM place_checkins c
       INNER JOIN users u ON u.id = c.user_id
       WHERE c.place_id = $1
       ORDER BY c.created_at DESC
       LIMIT 200`,
      [placeId]
    );
    checkins = checkinsResult.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name || '',
      userEmail: r.user_email || '',
      note: r.note || '',
      createdAt: r.created_at,
    }));
  } catch (err) {
    if (err.code === '42P01') {
      checkinsUnavailable = true;
    } else {
      console.error('[insights] checkins', err);
      return res.status(500).json({
        error: 'Failed to load check-in data',
        detail: process.env.NODE_ENV !== 'production' ? err.message : undefined,
      });
    }
  }

  if (tripsUnavailable && checkinsUnavailable) {
    return res.status(503).json({
      error: 'Engagement tables not found. Run server/migrations/007_business_engagement.sql (and ensure trips migration exists for planner stats).',
    });
  }

  res.json({
    placeId,
    labels: {
      trips: 'Visitors who added this place to a trip plan',
      checkins: 'Visitors who checked in here (logged-in app users)',
    },
    tripPlannerCount: tripPlanners.length,
    checkinCount: checkins.length,
    tripPlanners,
    checkins,
    _meta: {
      tripsUnavailable,
      checkinsUnavailable,
    },
  });
});

module.exports = router;
