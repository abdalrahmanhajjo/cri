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

function googleWebClientIdFromEnv() {
  const raw = process.env.GOOGLE_CLIENT_ID;
  if (raw == null || !String(raw).trim()) return null;
  return String(raw).trim();
}

router.get('/', async (req, res) => {
  try {
    const siteSettings = await getCollection('site_settings');
    const row = await siteSettings.findOne({ id: ROW_ID });
    
    const data = row?.data;
    const settings = stripDeprecatedSiteSettings(data && typeof data === 'object' ? data : {});
    /** Public OAuth web client id — same as VITE_GOOGLE_CLIENT_ID / GIS; not a secret. */
    const googleWebClientId = googleWebClientIdFromEnv();
    res.json({ settings, updatedAt: row?.updated_at ?? null, googleWebClientId });
  } catch (err) {
    res.json({ settings: {}, updatedAt: null, googleWebClientId: googleWebClientIdFromEnv() });
  }
});

module.exports = router;
