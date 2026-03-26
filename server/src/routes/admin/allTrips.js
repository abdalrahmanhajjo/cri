const express = require('express');
const { query } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

/** GET /api/admin/all-trips — all user trips (app + web planner). ?q= search name, id, user email/name */
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const params = [];
  let whereSql = '';
  if (q) {
    const idx = params.length + 1;
    params.push(`%${q}%`);
    whereSql = `WHERE (
      t.name ILIKE $${idx}
      OR t.id::text ILIKE $${idx}
      OR u.email ILIKE $${idx}
      OR COALESCE(u.name, '') ILIKE $${idx}
    )`;
  }
  params.push(limit);
  const limIdx = params.length;
  try {
    const { rows } = await query(
      `SELECT t.id, t.user_id, t.name, t.start_date, t.end_date, t.description, t.days, t.created_at,
              u.email AS user_email, u.name AS user_name
       FROM trips t
       JOIN users u ON u.id = t.user_id
       ${whereSql}
       ORDER BY t.created_at DESC
       LIMIT $${limIdx}`,
      params
    );
    res.json({
      trips: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userEmail: r.user_email,
        userName: r.user_name,
        name: r.name,
        startDate: r.start_date,
        endDate: r.end_date,
        description: r.description,
        days: r.days,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    if (err.code === '42P01') return res.json({ trips: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to list trips' });
  }
});

module.exports = router;
