const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { validateCategoryCreate } = require('../../utils/validateAdminCategory');

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
    const parsed = validateCategoryCreate(body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.errors });
    }
    const v = parsed.value;

    const tags = safeJson(body.tags, []);
    const categoriesColl = await getCollection('categories');
    
    const doc = {
      id: v.id,
      name: v.name,
      icon: v.icon,
      description: v.description,
      tags: Array.isArray(tags) ? tags : [],
      count: v.count || 0,
      color: v.color || '#666666',
      updated_at: new Date()
    };

    await categoriesColl.replaceOne({ id: v.id }, doc, { upsert: true });
    res.status(201).json({ id: v.id, message: 'Category saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save category' });
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
    if (body.tags !== undefined) setObj.tags = safeJson(body.tags, []);
    if (body.count !== undefined) setObj.count = parseInt(body.count, 10);
    if (body.color !== undefined) setObj.color = String(body.color);
    
    setObj.updated_at = new Date();

    const categoriesColl = await getCollection('categories');
    const result = await categoriesColl.updateOne({ id }, { $set: setObj });
    
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ id, message: 'Category updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const categoriesColl = await getCollection('categories');
    const result = await categoriesColl.deleteOne({ id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
