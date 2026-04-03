const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

const STATS_COLLECTIONS = [
  { key: 'users', coll: 'users' },
  { key: 'places', coll: 'places' },
  { key: 'categories', coll: 'categories' },
  { key: 'tours', coll: 'tours' },
  { key: 'events', coll: 'events' },
  { key: 'trips', coll: 'trips' },
  { key: 'feedPosts', coll: 'feed_posts' },
  { key: 'interests', coll: 'interests' },
  { key: 'savedPlaces', coll: 'saved_places' },
  { key: 'placePromotions', coll: 'place_promotions' },
  { key: 'coupons', coll: 'coupons' },
];

async function countColl(name) {
  try {
    const coll = await getCollection(name);
    return await coll.countDocuments();
  } catch (err) {
    return 0;
  }
}

/** GET /api/admin/stats — dashboard aggregates */
router.get('/', async (req, res) => {
  try {
    const counts = await Promise.all(
      STATS_COLLECTIONS.map(async (item) => {
        const count = await countColl(item.coll);
        return { [item.key]: count };
      })
    );
    
    const result = Object.assign({}, ...counts);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
