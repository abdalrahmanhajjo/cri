const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { query: dbQuery } = require('../../db');

const router = express.Router();

router.get('/me', authMiddleware, businessPortalMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rows } = await dbQuery(
      `SELECT p.id, p.name, p.location, p.category, p.images, p.rating, p.latitude, p.longitude
       FROM places p
       INNER JOIN place_owners po ON po.place_id = p.id AND po.user_id = $1
       ORDER BY p.name`,
      [userId]
    );
    function safeJson(val, fallback = []) {
      if (Array.isArray(val)) return val;
      if (typeof val === 'object' && val !== null) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return fallback;
        }
      }
      return fallback;
    }
    res.json({
      isBusinessOwner: req.businessPortal.isBusinessOwner,
      ownedPlaceCount: req.businessPortal.ownedPlaceCount,
      places: rows.map((r) => ({
        id: r.id,
        name: r.name,
        location: r.location,
        category: r.category,
        images: safeJson(r.images, []),
        rating: r.rating,
        latitude: r.latitude,
        longitude: r.longitude,
      })),
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
