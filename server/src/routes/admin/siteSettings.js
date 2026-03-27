const express = require('express');
const { query: dbQuery } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
const ROW_ID = 'default';

/** Remove deprecated keys so DB merges do not keep stale fields forever. */
function stripDeprecatedSiteSettings(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const next = { ...obj };
  delete next.showWeather;
  return next;
}

/** GET /api/admin/site-settings — public-ish payload for web (also used by app if you point it here) */
router.get('/', async (req, res) => {
  try {
    const { rows } = await dbQuery('SELECT data FROM site_settings WHERE id = $1', [ROW_ID]);
    const data = rows[0]?.data;
    const settings = stripDeprecatedSiteSettings(data && typeof data === 'object' ? data : {});
    res.json({ settings });
  } catch (err) {
    if (err.code === '42P01') return res.json({ settings: {} });
    throw err;
  }
});

router.use(authMiddleware, adminMiddleware);

/** PUT /api/admin/site-settings */
router.put('/', async (req, res) => {
  const settings = req.body?.settings;
  if (settings !== undefined && typeof settings !== 'object') {
    return res.status(400).json({ error: 'Invalid settings object' });
  }
  const incoming = settings || {};
  try {
    let existing = {};
    try {
      const prev = await dbQuery('SELECT data FROM site_settings WHERE id = $1', [ROW_ID]);
      const row = prev.rows[0]?.data;
      if (row && typeof row === 'object') existing = row;
    } catch (_) {
      /* ignore */
    }
    const data = stripDeprecatedSiteSettings({ ...existing, ...incoming });
    await dbQuery(
      `INSERT INTO site_settings (id, data, updated_at) VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $2::jsonb, updated_at = NOW()`,
      [ROW_ID, JSON.stringify(data)]
    );
    res.json({ settings: data });
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(503).json({ error: 'site_settings table missing. Run migration 005_site_settings.sql' });
    }
    throw err;
  }
});

module.exports = router;
