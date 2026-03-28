const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { query } = require('../../db');
const { parsePlaceId } = require('../../utils/validate');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rowToCoupon(row) {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: row.discount_value != null ? Number(row.discount_value) : null,
    minPurchase: row.min_purchase != null ? Number(row.min_purchase) : 0,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    usageLimit: row.usage_limit,
    placeId: row.place_id,
    placeName: row.place_name != null ? String(row.place_name) : '',
    tourId: row.tour_id,
    eventId: row.event_id,
    createdAt: row.created_at,
  };
}

function parseOptionalPlaceId(value) {
  if (value == null || value === '') return { valid: true, value: null };
  return parsePlaceId(value);
}

function parseOptionalVarchar(value, maxLen) {
  if (value == null || value === '') return { valid: true, value: null };
  const s = String(value).trim();
  if (s.length > maxLen) return { valid: false };
  return { valid: true, value: s };
}

/** GET /api/admin/coupons ?placeId= optional */
router.get('/', async (req, res) => {
  const filterPlace = parsePlaceId(req.query.placeId);
  try {
    const params = [];
    let where = '';
    if (filterPlace.valid) {
      params.push(filterPlace.value);
      where = 'WHERE c.place_id = $1';
    }
    params.push(500);
    const limIdx = params.length;
    const { rows } = await query(
      `SELECT c.id, c.code, c.discount_type, c.discount_value, c.min_purchase, c.valid_from, c.valid_until,
              c.usage_limit, c.place_id, pl.name AS place_name, c.tour_id, c.event_id, c.created_at
       FROM coupons c
       LEFT JOIN places pl ON pl.id = c.place_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${limIdx}`,
      params
    );
    res.json({ coupons: rows.map(rowToCoupon) });
  } catch (err) {
    if (err.code === '42P01') return res.json({ coupons: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to load coupons' });
  }
});

/** POST /api/admin/coupons */
router.post('/', async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().slice(0, 32) : '';
  if (!code) return res.status(400).json({ error: 'code required' });

  const discountType = String(req.body?.discountType || req.body?.discount_type || '').toLowerCase();
  if (discountType !== 'percent' && discountType !== 'fixed') {
    return res.status(400).json({ error: 'discountType must be percent or fixed' });
  }

  const dv = Number(req.body?.discountValue ?? req.body?.discount_value);
  if (!Number.isFinite(dv) || dv < 0) return res.status(400).json({ error: 'discountValue must be a non-negative number' });

  const minPurchase = req.body?.minPurchase != null || req.body?.min_purchase != null
    ? Number(req.body?.minPurchase ?? req.body?.min_purchase)
    : 0;
  if (!Number.isFinite(minPurchase) || minPurchase < 0) {
    return res.status(400).json({ error: 'minPurchase must be >= 0' });
  }

  const vfRaw = req.body?.validFrom ?? req.body?.valid_from;
  const validFrom =
    vfRaw != null && String(vfRaw).trim() !== '' ? String(vfRaw) : null;
  const validUntilRaw = req.body?.validUntil ?? req.body?.valid_until;
  if (validUntilRaw == null || String(validUntilRaw).trim() === '') {
    return res.status(400).json({ error: 'validUntil required' });
  }
  const validUntil = String(validUntilRaw);

  let usageLimit = null;
  if (req.body?.usageLimit != null && req.body.usageLimit !== '') {
    const u = parseInt(String(req.body.usageLimit), 10);
    if (!Number.isInteger(u) || u < 1) return res.status(400).json({ error: 'usageLimit must be a positive integer' });
    usageLimit = u;
  }

  const placeParsed = parseOptionalPlaceId(req.body?.placeId ?? req.body?.place_id);
  if (!placeParsed.valid) return res.status(400).json({ error: 'Invalid placeId' });
  if (placeParsed.value != null) {
    const { rows: ex } = await query('SELECT 1 FROM places WHERE id = $1', [placeParsed.value]);
    if (!ex.length) return res.status(400).json({ error: 'Place not found' });
  }

  const tourParsed = parseOptionalVarchar(req.body?.tourId ?? req.body?.tour_id, 50);
  const eventParsed = parseOptionalVarchar(req.body?.eventId ?? req.body?.event_id, 50);
  if (!tourParsed.valid || !eventParsed.valid) return res.status(400).json({ error: 'Invalid tour or event id' });

  try {
    const { rows } = await query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_purchase, valid_from, valid_until, usage_limit, place_id, tour_id, event_id)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6::timestamptz, $7, $8, $9, $10)
       RETURNING id, code, discount_type, discount_value, min_purchase, valid_from, valid_until, usage_limit, place_id, tour_id, event_id, created_at`,
      [
        code,
        discountType,
        dv,
        minPurchase,
        validFrom,
        validUntil,
        usageLimit,
        placeParsed.value,
        tourParsed.value,
        eventParsed.value,
      ]
    );
    const r0 = rows[0];
    let placeName = '';
    if (r0.place_id) {
      const { rows: pn } = await query('SELECT name FROM places WHERE id = $1', [r0.place_id]);
      placeName = pn[0]?.name || '';
    }
    res.status(201).json({ coupon: rowToCoupon({ ...r0, place_name: placeName }) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'A coupon with this code already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

/** PATCH /api/admin/coupons/:id */
router.patch('/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid coupon id' });

  try {
    const cur = await query('SELECT id FROM coupons WHERE id = $1::uuid', [id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Coupon not found' });

    const fields = [];
    const vals = [];
    let n = 1;
    const b = req.body || {};

    if (typeof b.code === 'string') {
      fields.push(`code = $${n++}`);
      vals.push(b.code.trim().slice(0, 32));
    }
    if (b.discountType !== undefined || b.discount_type !== undefined) {
      const dt = String(b.discountType ?? b.discount_type).toLowerCase();
      if (dt !== 'percent' && dt !== 'fixed') return res.status(400).json({ error: 'discountType must be percent or fixed' });
      fields.push(`discount_type = $${n++}`);
      vals.push(dt);
    }
    if (b.discountValue !== undefined || b.discount_value !== undefined) {
      const dv = Number(b.discountValue ?? b.discount_value);
      if (!Number.isFinite(dv) || dv < 0) return res.status(400).json({ error: 'Invalid discountValue' });
      fields.push(`discount_value = $${n++}`);
      vals.push(dv);
    }
    if (b.minPurchase !== undefined || b.min_purchase !== undefined) {
      const mp = Number(b.minPurchase ?? b.min_purchase);
      if (!Number.isFinite(mp) || mp < 0) return res.status(400).json({ error: 'Invalid minPurchase' });
      fields.push(`min_purchase = $${n++}`);
      vals.push(mp);
    }
    if (b.validFrom !== undefined || b.valid_from !== undefined) {
      const v = b.validFrom ?? b.valid_from;
      fields.push(`valid_from = $${n++}`);
      vals.push(v ? String(v) : null);
    }
    if (b.validUntil !== undefined || b.valid_until !== undefined) {
      const v = b.validUntil ?? b.valid_until;
      if (v == null || String(v).trim() === '') return res.status(400).json({ error: 'validUntil cannot be empty' });
      fields.push(`valid_until = $${n++}`);
      vals.push(String(v));
    }
    if (b.usageLimit !== undefined) {
      if (b.usageLimit === null || b.usageLimit === '') {
        fields.push(`usage_limit = $${n++}`);
        vals.push(null);
      } else {
        const u = parseInt(String(b.usageLimit), 10);
        if (!Number.isInteger(u) || u < 1) return res.status(400).json({ error: 'Invalid usageLimit' });
        fields.push(`usage_limit = $${n++}`);
        vals.push(u);
      }
    }
    if (b.placeId !== undefined || b.place_id !== undefined) {
      const raw = b.placeId ?? b.place_id;
      const p = parseOptionalPlaceId(raw);
      if (!p.valid) return res.status(400).json({ error: 'Invalid placeId' });
      if (p.value != null) {
        const { rows: ex } = await query('SELECT 1 FROM places WHERE id = $1', [p.value]);
        if (!ex.length) return res.status(400).json({ error: 'Place not found' });
      }
      fields.push(`place_id = $${n++}`);
      vals.push(p.value);
    }
    if (b.tourId !== undefined || b.tour_id !== undefined) {
      const t = parseOptionalVarchar(b.tourId ?? b.tour_id, 50);
      if (!t.valid) return res.status(400).json({ error: 'Invalid tourId' });
      fields.push(`tour_id = $${n++}`);
      vals.push(t.value);
    }
    if (b.eventId !== undefined || b.event_id !== undefined) {
      const e = parseOptionalVarchar(b.eventId ?? b.event_id, 50);
      if (!e.valid) return res.status(400).json({ error: 'Invalid eventId' });
      fields.push(`event_id = $${n++}`);
      vals.push(e.value);
    }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    vals.push(id);
    const idParam = n;

    const { rows } = await query(
      `UPDATE coupons SET ${fields.join(', ')}
       WHERE id = $${idParam}::uuid
       RETURNING id, code, discount_type, discount_value, min_purchase, valid_from, valid_until, usage_limit, place_id, tour_id, event_id, created_at`,
      vals
    );
    const r0 = rows[0];
    let placeName = '';
    if (r0.place_id) {
      const { rows: pn } = await query('SELECT name FROM places WHERE id = $1', [r0.place_id]);
      placeName = pn[0]?.name || '';
    }
    res.json({ coupon: rowToCoupon({ ...r0, place_name: placeName }) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'A coupon with this code already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

/** DELETE /api/admin/coupons/:id */
router.delete('/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid coupon id' });
  try {
    const { rowCount } = await query('DELETE FROM coupons WHERE id = $1::uuid', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Coupon not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

module.exports = router;
