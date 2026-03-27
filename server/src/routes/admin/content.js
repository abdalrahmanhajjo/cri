const express = require('express');
const { query: dbQuery } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { validate } = require('../../middleware/validation');
const { adminContentSchema } = require('../../schemas/admin');

const router = express.Router();
const ROW_ID = 'default';

/** GET /api/admin/content - fetch all translation overrides (public) */
router.get('/', async (req, res) => {
  try {
    const { rows } = await dbQuery(
      'SELECT data FROM translation_overrides WHERE id = $1',
      [ROW_ID]
    );
    const data = rows[0]?.data || {};
    res.json({ overrides: typeof data === 'object' ? data : {} });
  } catch (err) {
    if (err.code === '42P01') {
      return res.json({ overrides: {} });
    }
    throw err;
  }
});

/** PUT /api/admin/content - save translation overrides (admin: web + app CMS) */
router.put('/', authMiddleware, adminMiddleware, validate(adminContentSchema), async (req, res) => {
  try {
    const data = req.body.overrides || {};
    await dbQuery(
      `INSERT INTO translation_overrides (id, data, updated_at) VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $2::jsonb, updated_at = NOW()`,
      [ROW_ID, JSON.stringify(data)]
    );
    res.json({ overrides: data });
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(503).json({ error: 'Translation overrides table not found. Run migration 004_translation_overrides.sql' });
    }
    throw err;
  }
});

module.exports = router;
