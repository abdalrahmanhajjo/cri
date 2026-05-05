const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { getCollection } = require('../../mongo');
const { isDiningVenueRow, restaurantRowFilter } = require('../../utils/restaurantPlaceScope');

const router = express.Router();

function mapPlaceForBusiness(r, access) {
  return {
    id: r.id,
    name: r.name,
    location: r.location,
    category: r.category,
    images: r.images || [],
    rating: r.rating,
    latitude: r.latitude,
    longitude: r.longitude,
    venueKind: isDiningVenueRow(r) ? 'dining' : 'other',
    access,
  };
}

router.get('/me', authMiddleware, businessPortalMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const poColl = await getCollection('place_owners');
    const placesColl = await getCollection('places');

    const ownedPlaces = await poColl.aggregate([
      { $match: { user_id: userId } },
      {
        $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place',
        },
      },
      { $unwind: '$place' },
      { $sort: { 'place.name': 1 } },
    ]).toArray();

    let places = ownedPlaces.map((doc) => mapPlaceForBusiness(doc.place, 'owner'));

    if (req.businessPortal.isAdmin === true) {
      const existing = new Set(places.map((p) => p.id));
      const extra = await placesColl
        .find(
          { ...restaurantRowFilter(), id: { $nin: [...existing] } },
          { projection: { id: 1, name: 1, location: 1, category: 1, images: 1, rating: 1, latitude: 1, longitude: 1, dining_profile: 1 } }
        )
        .sort({ name: 1 })
        .limit(500)
        .toArray();
      places = places.concat(extra.map((r) => mapPlaceForBusiness(r, 'admin')));
    }

    res.json({
      isBusinessOwner: req.businessPortal.isBusinessOwner,
      ownedPlaceCount: req.businessPortal.ownedPlaceCount,
      isAdmin: req.businessPortal.isAdmin === true,
      places,
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
