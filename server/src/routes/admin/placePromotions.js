const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { query } = require('../../db');
const { parsePlaceId } = require('../../utils/validate');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

function rowToPromotion(row) {
  return {
    id: row.id,
    placeId: row.place_id,
    placeName: row.place_name != null ? String(row.place_name) : '',
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

/** GET /api/admin/place-promotions ?placeId= optional */
router.get('/', async (req, res) => {
  const filterPlace = parsePlaceId(req.query.placeId);
  try {
    const params = [];
    let where = '';
    if (filterPlace.valid) {
      params.push(filterPlace.value);
      where = `WHERE pr.place_id = $1`;
    }
    params.push(500);
    const limitParam = params.length;
    const { rows } = await query(
      `SELECT pr.id, pr.place_id, pl.name AS place_name, pr.title, pr.subtitle, pr.code, pr.discount_label, pr.terms,
              pr.starts_at, pr.ends_at, pr.active, pr.created_at, pr.updated_at
       FROM place_promotions pr
       LEFT JOIN places pl ON pl.id = pr.place_id
       ${where}
       ORDER BY pr.created_at DESC
       LIMIT $${limitParam}`,
      params
    );
    res.json({ promotions: rows.map(rowToPromotion) });
  } catch (err) {
    if (err.code === '42P01') return res.json({ promotions: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to load place promotions' });
  }
});

/** POST /api/admin/place-promotions */
router.post('/', async (req, res) => {
  const parsed = parsePlaceId(req.body?.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'Valid placeId required' });
  const placeId = parsed.value;

  const { rows: exists } = await query('SELECT 1 FROM places WHERE id = $1', [placeId]);
  if (!exists.length) return res.status(400).json({ error: 'Place not found' });

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
    const { rows } = await query(
      `INSERT INTO place_promotions (place_id, title, subtitle, code, discount_label, terms, starts_at, ends_at, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9)
       RETURNING id, place_id, title, subtitle, code, discount_label, terms, starts_at, ends_at, active, created_at, updated_at`,
      [placeId, title, subtitle, code, discountLabel, terms, startsAt || null, endsAt || null, active]
    );
    const r0 = rows[0];
    const { rows: pn } = await query('SELECT name FROM places WHERE id = $1', [placeId]);
    res.status(201).json({
      promotion: rowToPromotion({ ...r0, place_name: pn[0]?.name || '' }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

/** PATCH /api/admin/place-promotions/:id */
router.patch('/:id', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });

  try {
    const cur = await query('SELECT id FROM place_promotions WHERE id = $1', [id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Promotion not found' });

    const fields = [];
    const vals = [];
    let n = 1;
    const b = req.body || {};

    if (b.placeId !== undefined) {
      const p = parsePlaceId(b.placeId);
      if (!p.valid) return res.status(400).json({ error: 'Invalid placeId' });
      const { rows: ex } = await query('SELECT 1 FROM places WHERE id = $1', [p.value]);
      if (!ex.length) return res.status(400).json({ error: 'Place not found' });
      fields.push(`place_id = $${n++}`);
      vals.push(p.value);
    }
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

    const { rows } = await query(
      `UPDATE place_promotions SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idParam}
       RETURNING id, place_id, title, subtitle, code, discount_label, terms, starts_at, ends_at, active, created_at, updated_at`,
      vals
    );
    const r0 = rows[0];
    const { rows: pn } = await query('SELECT name FROM places WHERE id = $1', [r0.place_id]);
    res.json({ promotion: rowToPromotion({ ...r0, place_name: pn[0]?.name || '' }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update promotion' });
  }
});

/** DELETE /api/admin/place-promotions/:id */
router.delete('/:id', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { rowCount } = await query('DELETE FROM place_promotions WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Promotion not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

module.exports = router;
