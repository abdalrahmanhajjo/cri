const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

/** GET /api/admin/all-trips — all user trips. ?q= */
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  
  try {
    const tripsColl = await getCollection('trips');
    const pipeline = [
      { $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
      }},
      { $addFields: {
          user_email: { $arrayElemAt: ['$user.email', 0] },
          user_name: { $arrayElemAt: ['$user.name', 0] }
      }}
    ];

    if (q) {
      const regex = { $regex: q, $options: 'i' };
      pipeline.push({
        $match: {
          $or: [
            { name: regex },
            { id: regex },
            { user_email: regex },
            { user_name: regex }
          ]
        }
      });
    }

    pipeline.push({ $sort: { created_at: -1 } });
    pipeline.push({ $limit: limit });

    const rows = await tripsColl.aggregate(pipeline).toArray();
    
    res.json({
      trips: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userEmail: r.user_email || null,
        userName: r.user_name || null,
        name: r.name,
        startDate: r.start_date,
        endDate: r.end_date,
        description: r.description,
        days: r.days || [],
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list trips' });
  }
});

module.exports = router;
