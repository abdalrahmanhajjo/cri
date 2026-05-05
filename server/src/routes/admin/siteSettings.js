const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
const { logAuditEvent } = require('../../utils/audit');
const ROW_ID = 'default';

/** Remove deprecated keys. */
function stripDeprecatedSiteSettings(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const next = { ...obj };
  delete next.showWeather;
  return next;
}

/** GET /api/admin/site-settings */
router.get('/', async (req, res) => {
  try {
    const settingsColl = await getCollection('site_settings');
    const doc = await settingsColl.findOne({ id: ROW_ID });
    const data = doc?.data || {};
    const settings = stripDeprecatedSiteSettings(data && typeof data === 'object' ? data : {});
    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load site settings' });
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
    const settingsColl = await getCollection('site_settings');
    const existingDoc = await settingsColl.findOne({ id: ROW_ID });
    const existingData = existingDoc?.data || {};
    
    const newData = stripDeprecatedSiteSettings({ ...existingData, ...incoming });
    
    await settingsColl.updateOne(
      { id: ROW_ID },
      { $set: { data: newData, updated_at: new Date() } },
      { upsert: true }
    );

    // Audit log
    const actor = { userId: req.user.userId, email: req.user.email || 'admin', ip: req.ip };
    logAuditEvent('update_site_settings', actor, { changes: incoming });

    res.json({ settings: newData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update site settings' });
  }
});

module.exports = router;
