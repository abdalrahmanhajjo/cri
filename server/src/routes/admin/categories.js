const express = require('express');
const { query } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

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
    const id = (body.id || '').toString().trim() || (body.name || 'cat').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const tags = safeJson(body.tags, []);
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

    await query(
      `INSERT INTO categories (id, name, icon, description, tags, count, color)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, icon = EXCLUDED.icon, description = EXCLUDED.description,
         tags = EXCLUDED.tags, count = EXCLUDED.count, color = EXCLUDED.color`,
      [
        id,
        (body.name || '').toString(),
        (body.icon || 'fas fa-folder').toString(),
        (body.description || '').toString(),
        tagsJson,
        body.count != null ? parseInt(body.count, 10) : 0,
        (body.color || '#666666').toString(),
      ]
    );
    res.status(201).json({ id, message: 'Category saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save category', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const tags = body.tags !== undefined ? safeJson(body.tags, []) : null;
    const tagsJson = tags !== null ? JSON.stringify(Array.isArray(tags) ? tags : []) : null;

    const result = await query(
      `UPDATE categories SET
         name = COALESCE($2, name), icon = COALESCE($3, icon), description = COALESCE($4, description),
         tags = COALESCE($5::jsonb, tags), count = COALESCE($6, count), color = COALESCE($7, color)
       WHERE id = $1`,
      [
        id,
        body.name !== undefined ? String(body.name) : null,
        body.icon !== undefined ? String(body.icon) : null,
        body.description !== undefined ? String(body.description) : null,
        tagsJson,
        body.count !== undefined ? parseInt(body.count, 10) : null,
        body.color !== undefined ? String(body.color) : null,
      ]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ id, message: 'Category updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update category', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await query('DELETE FROM categories WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete category', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

module.exports = router;
