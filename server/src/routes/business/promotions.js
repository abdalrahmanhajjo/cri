const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { query: dbQuery } = require('../../db');
const { parsePlaceId } = require('../../utils/validate');

const router = express.Router();
router.use(authMiddleware, businessPortalMiddleware);

async function assertOwnsPlace(userId, placeId) {
  const { rows } = await dbQuery(
    'SELECT 1 FROM place_owners WHERE user_id = $1 AND place_id = $2',
    [userId, placeId]
  );
  return rows.length > 0;
}

function rowToPromotion(row) {
  return {
    id: row.id,
    placeId: row.place_id,
    title: row.title,
    subtitle: row.subtitle || '',
    code: row.code || '',
    discountLabel: row.discount_label || '',
    terms: row.terms || '',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** GET /api/business/promotions?placeId= */
router.get('/', async (req, res) => {
  const parsed = parsePlaceId(req.query.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'Valid placeId query required' });
  const placeId = parsed.value;
  if (!(await assertOwnsPlace(req.user.userId, placeId))) {
    return res.status(403).json({ error: 'You do not manage this place' });
  }
  try {
    const { rows } = await dbQuery(
      `SELECT id, place_id, title, subtitle, code, discount_label, terms, starts_at, ends_at, active, created_at, updated_at
       FROM place_promotions
       WHERE place_id = $1
       ORDER BY created_at DESC`,
      [placeId]
    );
    res.json({ placeId, promotions: rows.map(rowToPromotion) });
  } catch (err) {
    console.error(err);
    if (err.code === '42P01') {
      return res.json({
        placeId,
        promotions: [],
        _warning: 'place_promotions table missing — run server/migrations/007_business_engagement.sql',
      });
    }
    res.status(500).json({ error: 'Failed to load promotions' });
  }
});

/** POST /api/business/promotions */
router.post('/', async (req, res) => {
  const parsed = parsePlaceId(req.body?.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'placeId required' });
  const placeId = parsed.value;
  if (!(await assertOwnsPlace(req.user.userId, placeId))) {
    return res.status(403).json({ error: 'You do not manage this place' });
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 200) : '';
  if (!title) return res.status(400).json({ error: 'title required' });
  const subtitle = typeof req.body?.subtitle === 'string' ? req.body.subtitle.trim().slice(0, 500) : null;
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().slice(0, 64) : null;
  const discountLabel = typeof req.body?.discountLabel === 'string' ? req.body.discountLabel.trim().slice(0, 120) : null;
  const terms = typeof req.body?.terms === 'string' ? req.body.terms.trim().slice(0, 2000) : null;
  const startsAt = req.body?.startsAt ? String(req.body.startsAt) : null;
  const endsAt = req.body?.endsAt ? String(req.body.endsAt) : null;
  const active = req.body?.active !== false;

  try {
    const { rows } = await dbQuery(
      `INSERT INTO place_promotions (place_id, title, subtitle, code, discount_label, terms, starts_at, ends_at, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9)
       RETURNING id, place_id, title, subtitle, code, discount_label, terms, starts_at, ends_at, active, created_at, updated_at`,
      [placeId, title, subtitle, code, discountLabel, terms, startsAt || null, endsAt || null, active]
    );
    res.status(201).json({ promotion: rowToPromotion(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

/** PATCH /api/business/promotions/:id */
router.patch('/:id', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });

  try {
    const own = await dbQuery(
      `SELECT p.id FROM place_promotions p
       INNER JOIN place_owners po ON po.place_id = p.place_id AND po.user_id = $2
       WHERE p.id = $1`,
      [id, req.user.userId]
    );
    if (!own.rows.length) return res.status(404).json({ error: 'Promotion not found' });

    const fields = [];
    const vals = [];
    let n = 1;
    const b = req.body || {};
    if (typeof b.title === 'string') {
      fields.push(`title = $${n++}`);
      vals.push(b.title.trim().slice(0, 200));
    }
    if (typeof b.subtitle === 'string') {
      fields.push(`subtitle = $${n++}`);
      vals.push(b.subtitle.trim().slice(0, 500));
    }
    if (typeof b.code === 'string') {
      fields.push(`code = $${n++}`);
      vals.push(b.code.trim().slice(0, 64));
    }
    if (typeof b.discountLabel === 'string') {
      fields.push(`discount_label = $${n++}`);
      vals.push(b.discountLabel.trim().slice(0, 120));
    }
    if (typeof b.terms === 'string') {
      fields.push(`terms = $${n++}`);
      vals.push(b.terms.trim().slice(0, 2000));
    }
    if (b.startsAt !== undefined) {
      fields.push(`starts_at = $${n++}`);
      vals.push(b.startsAt ? String(b.startsAt) : null);
    }
    if (b.endsAt !== undefined) {
      fields.push(`ends_at = $${n++}`);
      vals.push(b.endsAt ? String(b.endsAt) : null);
    }
    if (typeof b.active === 'boolean') {
      fields.push(`active = $${n++}`);
      vals.push(b.active);
    }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    vals.push(id);
    const idParam = n;

    const { rows } = await dbQuery(
      `UPDATE place_promotions SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idParam}
       RETURNING id, place_id, title, subtitle, code, discount_label, terms, starts_at, ends_at, active, created_at, updated_at`,
      vals
    );
    res.json({ promotion: rowToPromotion(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update promotion' });
  }
});

/** DELETE /api/business/promotions/:id */
router.delete('/:id', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { rowCount } = await dbQuery(
      `DELETE FROM place_promotions p
       USING place_owners po
       WHERE p.id = $1 AND po.place_id = p.place_id AND po.user_id = $2`,
      [id, req.user.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Promotion not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

module.exports = router;
