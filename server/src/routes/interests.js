const express = require('express');
const { query } = require('../db');
const { getRequestLang } = require('../utils/requestLang');

const router = express.Router();

function rowToInterest(row) {
  let tags = [];
  if (Array.isArray(row.tags)) tags = row.tags;
  else if (row.tags && typeof row.tags === 'object') tags = row.tags;
  else if (typeof row.tags === 'string') {
    try { tags = JSON.parse(row.tags); } catch { tags = []; }
  }
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    description: row.description || '',
    color: row.color || '#666666',
    count: row.count ?? 0,
    popularity: row.popularity ?? 0,
    tags: Array.isArray(tags) ? tags : [],
  };
}

/** GET /api/interests — same data the mobile app can consume */
router.get('/', async (req, res) => {
  try {
    const lang = getRequestLang(req);
    const result = await query(
      `SELECT i.id, i.icon, i.color, i.count, i.popularity,
              COALESCE(it.name, i.name) AS name,
              COALESCE(it.description, i.description) AS description,
              COALESCE(it.tags, i.tags) AS tags
       FROM interests i
       LEFT JOIN interest_translations it ON it.interest_id = i.id AND it.lang = $1
       ORDER BY i.popularity DESC NULLS LAST, i.name`,
      [lang]
    );
    res.json({ interests: result.rows.map(rowToInterest) });
  } catch (err) {
    if (err.code === '42P01') return res.json({ interests: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch interests' });
  }
});

module.exports = router;
