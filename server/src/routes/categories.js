const express = require('express');
const { query } = require('../db');
const { getRequestLang } = require('../utils/requestLang');

const router = express.Router();

function rowToCategory(row) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    description: row.description || '',
    tags: Array.isArray(row.tags) ? row.tags : (row.tags ? JSON.parse(row.tags) : []),
    count: row.count ?? 0,
    color: row.color || '#666666'
  };
}

router.get('/', async (req, res) => {
  try {
    const lang = getRequestLang(req);
    const result = await query(
      `SELECT c.id, c.icon, c.count, c.color,
              COALESCE(ct.name, c.name) AS name,
              COALESCE(ct.description, c.description) AS description,
              COALESCE(ct.tags, c.tags) AS tags
       FROM categories c
       LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.lang = $1
       ORDER BY c.name`,
      [lang]
    );
    res.json({ categories: result.rows.map(rowToCategory) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

module.exports = router;
