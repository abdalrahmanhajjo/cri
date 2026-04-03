const express = require('express');
const { getRequestLang } = require('../utils/requestLang');

const { cachePublicList } = require('../middleware/publicCache');
const { listInterests } = require('../repositories/publicContent');

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
router.get('/', cachePublicList(120, 600), async (req, res) => {
  try {
    const lang = getRequestLang(req);
    const result = await listInterests(lang);
    res.json({ interests: result.interests.map(rowToInterest) });
  } catch (err) {
    if (err.code === '42P01') return res.json({ interests: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch interests' });
  }
});

module.exports = router;
