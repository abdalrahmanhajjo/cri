const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { getCollection } = require('../../mongo');

const router = express.Router();

router.use(
  '/sponsorship',
  authMiddleware,
  businessPortalMiddleware,
  require('./sponsorship')
);

router.get('/me', authMiddleware, businessPortalMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const poColl = await getCollection('place_owners');
    
    const ownedPlaces = await poColl.aggregate([
      { $match: { user_id: userId } },
      { $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place'
      }},
      { $unwind: '$place' },
      { $sort: { 'place.name': 1 } }
    ]).toArray();

    res.json({
      isBusinessOwner: req.businessPortal.isBusinessOwner,
      ownedPlaceCount: req.businessPortal.ownedPlaceCount,
      places: ownedPlaces.map((doc) => {
        const r = doc.place;
        return {
          id: r.id,
          name: r.name,
          location: r.location,
          category: r.category,
          images: r.images || [],
          rating: r.rating,
          latitude: r.latitude,
          longitude: r.longitude,
        };
      }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load business profile' });
  }
});

router.use('/places', require('./places'));
router.use('/feed', require('./feed'));
router.use('/upload', require('./upload'));
router.use('/insights', require('./insights'));
router.use('/proposals', require('./proposals'));
router.use('/messaging-blocks', require('./messagingBlocks'));
router.use('/promotions', require('./promotions'));

module.exports = router;
