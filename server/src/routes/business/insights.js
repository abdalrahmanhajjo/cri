const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { parsePlaceId } = require('../../utils/validate');

const router = express.Router();
router.use(authMiddleware, businessPortalMiddleware);

async function assertOwnsPlace(userId, placeId) {
  const poColl = await getCollection('place_owners');
  const owner = await poColl.findOne({ user_id: userId, place_id: placeId });
  return !!owner;
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

  try {
    if (!(await assertOwnsPlace(userId, placeId))) {
      return res.status(403).json({ error: 'You do not manage this place' });
    }

    const tripsColl = await getCollection('trips');
    const tripRows = await tripsColl.aggregate([
      { $match: { 'days.placeIds': placeId } },
      { $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
      }},
      { $addFields: {
          user_name: { $arrayElemAt: ['$user.name', 0] },
          user_email: { $arrayElemAt: ['$user.email', 0] }
      }},
      { $sort: { created_at: -1 } },
      { $limit: 200 }
    ]).toArray();

    const tripPlanners = tripRows.map((r) => ({
      tripId: r.id,
      tripName: r.name,
      userId: r.user_id,
      userName: r.user_name || '',
      userEmail: r.user_email || '',
      tripCreatedAt: r.created_at,
    }));

    const checkinsColl = await getCollection('place_checkins');
    const checkinRows = await checkinsColl.aggregate([
      { $match: { place_id: placeId } },
      { $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
      }},
      { $addFields: {
          user_name: { $arrayElemAt: ['$user.name', 0] },
          user_email: { $arrayElemAt: ['$user.email', 0] }
      }},
      { $sort: { created_at: -1 } },
      { $limit: 200 }
    ]).toArray();

    const checkins = checkinRows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name || '',
      userEmail: r.user_email || '',
      note: r.note || '',
      createdAt: r.created_at,
    }));

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
        tripsUnavailable: false,
        checkinsUnavailable: false,
      },
    });
  } catch (err) {
    console.error('[insights]', err);
    res.status(500).json({ error: 'Failed to load insights' });
  }
});

module.exports = router;
