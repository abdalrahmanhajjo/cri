const express = require('express');
const { query: dbQuery } = require('../../db');
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

    const tags = safeJson(body.tags, []);
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

    await dbQuery(
      `INSERT INTO interests (id, name, icon, description, color, count, popularity, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, icon = EXCLUDED.icon, description = EXCLUDED.description,
         color = EXCLUDED.color, count = EXCLUDED.count, popularity = EXCLUDED.popularity, tags = EXCLUDED.tags`,
      [
        id,
        (body.name || '').toString(),
        (body.icon || 'place').toString(),
        (body.description || '').toString(),
        (body.color || '#666666').toString(),
        body.count != null ? parseInt(body.count, 10) : 0,
        body.popularity != null ? parseInt(body.popularity, 10) : 0,
        tagsJson,
      ]
    );
    res.status(201).json({ id, message: 'Interest saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save interest', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const tags = body.tags !== undefined ? safeJson(body.tags, []) : null;
    const tagsJson = tags !== null ? JSON.stringify(Array.isArray(tags) ? tags : []) : null;

    const result = await dbQuery(
      `UPDATE interests SET
         name = COALESCE($2, name), icon = COALESCE($3, icon), description = COALESCE($4, description),
         color = COALESCE($5, color), count = COALESCE($6, count), popularity = COALESCE($7, popularity),
         tags = COALESCE($8::jsonb, tags)
       WHERE id = $1`,
      [
        id,
        body.name !== undefined ? String(body.name) : null,
        body.icon !== undefined ? String(body.icon) : null,
        body.description !== undefined ? String(body.description) : null,
        body.color !== undefined ? String(body.color) : null,
        body.count !== undefined ? parseInt(body.count, 10) : null,
        body.popularity !== undefined ? parseInt(body.popularity, 10) : null,
        tagsJson,
      ]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Interest not found' });
    res.json({ id, message: 'Interest updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update interest', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await dbQuery('DELETE FROM interests WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Interest not found' });
    res.json({ message: 'Interest deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete interest', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

module.exports = router;
