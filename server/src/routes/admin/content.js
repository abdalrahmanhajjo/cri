const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
const ROW_ID = 'default';

/** GET /api/admin/content - fetch all translation overrides (public) */
router.get('/', async (req, res) => {
  try {
    const coll = await getCollection('translation_overrides');
    const doc = await coll.findOne({ id: ROW_ID });
    const data = doc?.data || {};
    res.json({ overrides: typeof data === 'object' ? data : {} });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load content overrrides' });
  }
});

/** PUT /api/admin/content - save translation overrides (admin) */
router.put('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const overrides = req.body?.overrides;
    if (overrides !== undefined && typeof overrides !== 'object') {
      return res.status(400).json({ error: 'Invalid overrides' });
    }
    const data = overrides || {};
    const coll = await getCollection('translation_overrides');
    await coll.updateOne(
      { id: ROW_ID },
      { $set: { data, updated_at: new Date() } },
      { upsert: true }
    );
    res.json({ overrides: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save content overrides' });
  }
});

module.exports = router;
