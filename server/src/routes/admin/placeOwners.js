const express = require('express');
const { query } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { parsePlaceId } = require('../../utils/validate');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET /api/admin/place-owners ?q= filter place_id, user_id, email, name */
router.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const params = [];
  let whereSql = '';
  if (q) {
    const idx = params.length + 1;
    params.push(`%${q}%`);
    whereSql = `WHERE (
      po.place_id ILIKE $${idx}
      OR po.user_id::text ILIKE $${idx}
      OR u.email ILIKE $${idx}
      OR COALESCE(u.name, '') ILIKE $${idx}
    )`;
  }
  try {
    const { rows } = await query(
      `SELECT po.user_id, po.place_id, u.email, u.name AS user_name
       FROM place_owners po
       JOIN users u ON u.id = po.user_id
       ${whereSql}
       ORDER BY po.place_id, u.email`,
      params
    );
    res.json({ owners: rows });
  } catch (err) {
    if (err.code === '42P01') return res.json({ owners: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to list place owners' });
  }
});

/** POST /api/admin/place-owners { userId, placeId } — validates user + place exist; rejects blocked users */
router.post('/', async (req, res) => {
  const userIdRaw = req.body?.userId;
  const placeParsed = parsePlaceId(req.body?.placeId);
  if (!userIdRaw || typeof userIdRaw !== 'string') {
    return res.status(400).json({ error: 'userId required' });
  }
  const userId = userIdRaw.trim();
  if (!UUID_RE.test(userId)) {
    return res.status(400).json({ error: 'userId must be a valid UUID' });
  }
  if (!placeParsed.valid) {
    return res.status(400).json({ error: 'placeId is invalid or missing' });
  }
  const placeId = placeParsed.value;
  if (placeId.length > 50) {
    return res.status(400).json({ error: 'placeId is too long' });
  }
  try {
    const { rows: uRows } = await query(
      'SELECT id, COALESCE(is_blocked, false) AS is_blocked FROM users WHERE id = $1',
      [userId]
    );
    if (!uRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (uRows[0].is_blocked === true) {
      return res.status(403).json({ error: 'Cannot link a blocked account to a place' });
    }
    const { rows: pRows } = await query('SELECT id FROM places WHERE id = $1', [placeId]);
    if (!pRows.length) {
      return res.status(404).json({ error: 'Place not found' });
    }
    const ins = await query(
      `INSERT INTO place_owners (user_id, place_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING user_id, place_id`,
      [userId, placeId]
    );
    if (ins.rows.length === 0) {
      return res.status(409).json({ error: 'This user is already linked to this place' });
    }
    res.status(201).json({ ok: true, userId, placeId });
  } catch (err) {
    if (err.code === '42703') {
      return res.status(503).json({ error: 'Database schema out of date (users.is_blocked). Run migrations.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to add place owner' });
  }
});

/** DELETE /api/admin/place-owners?userId=&placeId= */
router.delete('/', async (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  const placeParsed = parsePlaceId(req.query.placeId);
  if (!userId || !UUID_RE.test(userId) || !placeParsed.valid) {
    return res.status(400).json({ error: 'Valid userId and placeId query params required' });
  }
  const placeId = placeParsed.value;
  if (placeId.length > 50) {
    return res.status(400).json({ error: 'placeId is too long' });
  }
  try {
    const result = await query('DELETE FROM place_owners WHERE user_id = $1 AND place_id = $2', [userId, placeId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove place owner' });
  }
});

module.exports = router;
