const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

function safeJson(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'object' && val !== null) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return fallback;
}

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const id = (body.id || '').toString().trim() || (body.name || 'interest').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const interestsColl = await getCollection('interests');
    const doc = {
      id,
      name: (body.name || '').toString(),
      icon: (body.icon || 'place').toString(),
      description: (body.description || '').toString(),
      color: (body.color || '#666666').toString(),
      count: body.count != null ? parseInt(body.count, 10) : 0,
      popularity: body.popularity != null ? parseInt(body.popularity, 10) : 0,
      tags: safeJson(body.tags),
      updated_at: new Date()
    };

    await interestsColl.replaceOne({ id }, doc, { upsert: true });
    res.status(201).json({ id, message: 'Interest saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save interest' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    
    const setObj = {};
    if (body.name !== undefined) setObj.name = String(body.name);
    if (body.icon !== undefined) setObj.icon = String(body.icon);
    if (body.description !== undefined) setObj.description = String(body.description);
    if (body.color !== undefined) setObj.color = String(body.color);
    if (body.count !== undefined) setObj.count = parseInt(body.count, 10);
    if (body.popularity !== undefined) setObj.popularity = parseInt(body.popularity, 10);
    if (body.tags !== undefined) setObj.tags = safeJson(body.tags);
    
    setObj.updated_at = new Date();

    const interestsColl = await getCollection('interests');
    const result = await interestsColl.updateOne({ id }, { $set: setObj });
    
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Interest not found' });
    res.json({ id, message: 'Interest updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update interest' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const interestsColl = await getCollection('interests');
    const result = await interestsColl.deleteOne({ id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Interest not found' });
    res.json({ message: 'Interest deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete interest' });
  }
});

module.exports = router;
