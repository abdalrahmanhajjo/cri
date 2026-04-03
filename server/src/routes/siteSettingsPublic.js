/**
 * GET /api/site-settings — same payload as admin site-settings.
 */
const express = require('express');
const { getCollection } = require('../mongo');

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
    const siteSettings = await getCollection('site_settings');
    const row = await siteSettings.findOne({ id: ROW_ID });
    
    const data = row?.data;
    const settings = stripDeprecatedSiteSettings(data && typeof data === 'object' ? data : {});
    res.json({ settings, updatedAt: row?.updated_at ?? null });
  } catch (err) {
    res.json({ settings: {}, updatedAt: null });
  }
});

module.exports = router;
