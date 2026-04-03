const express = require('express');
const { getRequestLang } = require('../utils/requestLang');
const { sendDbAwareError } = require('../utils/dbHttpError');
const { cachePublicList } = require('../middleware/publicCache');
const { listCategories } = require('../repositories/publicContent');

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

router.get('/', cachePublicList(120, 600), async (req, res) => {
  try {
    const lang = getRequestLang(req);
    const result = await listCategories(lang);
    res.json({ categories: result.categories.map(rowToCategory) });
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to fetch categories');
  }
});

module.exports = router;
