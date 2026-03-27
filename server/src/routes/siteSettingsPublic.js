/**
 * GET /api/site-settings — same payload as GET /api/admin/site-settings (alias for mobile app / CDNs).
 */
const express = require('express');
const { query: dbQuery } = require('../db');

const router = express.Router();
const ROW_ID = 'default';

function stripDeprecatedSiteSettings(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const next = { ...obj };
  delete next.showWeather;
  return next;
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await dbQuery('SELECT data, updated_at FROM site_settings WHERE id = $1', [ROW_ID]);
    const data = rows[0]?.data;
    const settings = stripDeprecatedSiteSettings(data && typeof data === 'object' ? data : {});
    res.json({ settings, updatedAt: rows[0]?.updated_at ?? null });
  } catch (err) {
    if (err.code === '42P01') return res.json({ settings: {}, updatedAt: null });
    throw err;
  }
});

module.exports = router;
