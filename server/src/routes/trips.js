const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { query: dbQuery } = require('../db');
const { parsePlaceId, parseTripId } = require('../utils/validate');
const { validate } = require('../middleware/validation');
const { createTripSchema, updateTripSchema } = require('../schemas/trips');

function generateTripId() {
  const t = Date.now();
  const r = Math.random().toString(36).slice(2, 9);
  return `trip_${t}_${r}`;
}

const router = express.Router();
router.use(authMiddleware);

function toYmdDb(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim().slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

async function findOverlappingTrips(userId, startYmd, endYmd, excludeTripId) {
  const exclude = excludeTripId ?? null;
  const result = await dbQuery(
    `SELECT id, name FROM trips
     WHERE user_id = $1
       AND ($4::text IS NULL OR id <> $4)
       AND start_date <= $3::date
       AND end_date >= $2::date`,
    [userId, startYmd, endYmd, exclude]
  );
  return result.rows;
}

function parseDays(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

function normalizeSlot(s) {
  if (!s || typeof s !== 'object') return null;
  const placeId = s.placeId ?? s.place_id;
  if (placeId == null || String(placeId).trim() === '') return null;
  const st = s.startTime != null && String(s.startTime).trim() ? String(s.startTime).trim().slice(0, 8) : null;
  const en = s.endTime != null && String(s.endTime).trim() ? String(s.endTime).trim().slice(0, 8) : null;
  const notes = s.notes != null && String(s.notes).trim() ? String(s.notes).trim().slice(0, 2000) : null;
  return { placeId: String(placeId), startTime: st, endTime: en, notes };
}

/** Normalize days to TripDay-shaped JSON (Flutter parity) plus derived placeIds. */
function normalizeDays(raw) {
  const arr = parseDays(raw);
  return arr.map((day) => {
    if (!day || typeof day !== 'object') return { placeIds: [], slots: [] };
    const dateStr = typeof day.date === 'string' ? day.date.trim().slice(0, 10) : undefined;
    if (Array.isArray(day.slots)) {
      const slots = day.slots.map(normalizeSlot).filter(Boolean);
      const placeIds = slots.map((s) => s.placeId);
      const out = { placeIds, slots };
      if (dateStr) out.date = dateStr;
      return out;
    }
    if (Array.isArray(day.placeIds)) {
      const placeIds = day.placeIds.map((id) => String(id));
      const slots = placeIds.map((pid) => ({ placeId: pid, startTime: null, endTime: null, notes: null }));
      const out = { placeIds, slots };
      if (dateStr) out.date = dateStr;
      return out;
    }
    return { placeIds: [], slots: [] };
  });
}

router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await dbQuery(
      'SELECT id, name, start_date, end_date, description, days, created_at FROM trips WHERE user_id = $1 ORDER BY start_date DESC',
      [userId]
    );
    const trips = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      description: row.description,
      days: normalizeDays(row.days),
      createdAt: row.created_at
    }));
    res.json({ trips });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const idResult = parseTripId(req.params.id);
    if (!idResult.valid) return res.status(400).json({ error: 'Invalid trip id' });
    const result = await dbQuery(
      'SELECT id, name, start_date, end_date, description, days, created_at FROM trips WHERE id = $1 AND user_id = $2',
      [idResult.value, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      description: row.description,
      days: normalizeDays(row.days),
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

router.post('/', validate(createTripSchema), async (req, res) => {
  const userId = req.user.userId;
  const { name, startDate, endDate, description, days } = req.body;

  if (startDate > endDate) return res.status(400).json({ error: 'startDate must be on or before endDate' });
  const postOverlaps = await findOverlappingTrips(userId, startDate, endDate, null);
  if (postOverlaps.length > 0) {
    return res.status(409).json({
      error:
        'These dates overlap another trip. Delete or change the other trip, or pick different dates.',
      code: 'TRIP_DATE_OVERLAP',
      conflicts: postOverlaps.map((r) => ({ id: r.id, name: r.name })),
    });
  }
  let initialDays = [];
  if (Array.isArray(req.body?.days)) {
    initialDays = normalizeDays(req.body.days).map((d) => {
      const row = { slots: d.slots };
      if (d.date) row.date = d.date;
      return row;
    });
  }
  const id = generateTripId();
  try {
    const result = await dbQuery(
      'INSERT INTO trips (id, user_id, name, start_date, end_date, description, days) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, start_date, end_date, description, days, created_at',
      [id, userId, name, startDate, endDate, description, JSON.stringify(initialDays)]
    );
    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      description: row.description,
      days: normalizeDays(row.days),
      createdAt: row.created_at
    });
  } catch (err) {
    if (err.code === '42P01') return res.status(500).json({ error: 'Trips table not available' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

router.patch('/:id', validate(updateTripSchema), async (req, res) => {
  const userId = req.user.userId;
  const idResult = parseTripId(req.params.id);
  if (!idResult.valid) return res.status(400).json({ error: 'Invalid trip id' });
  const { name, startDate, endDate, days, description } = req.body;
  const updates = [];
  const values = [];
  let pos = 1;
  if (name !== undefined) {
    updates.push(`name = $${pos++}`);
    values.push(name.trim());
  }
  if (description !== undefined) {
    updates.push(`description = $${pos++}`);
    values.push(description ? description.trim() : null);
  }
  if (startDate !== undefined) {
    updates.push(`start_date = $${pos++}`);
    values.push(startDate.trim());
  }
  if (endDate !== undefined) {
    updates.push(`end_date = $${pos++}`);
    values.push(endDate.trim());
  }
  if (days !== undefined) {
    const normalized = normalizeDays(days).map((d) => {
      const row = { slots: d.slots };
      if (d.date) row.date = d.date;
      return row;
    });
    updates.push(`days = $${pos++}`);
    values.push(JSON.stringify(normalized));
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
  if (startDate != null || endDate != null) {
    const cur = await dbQuery('SELECT start_date, end_date FROM trips WHERE id = $1 AND user_id = $2', [
      idResult.value,
      userId,
    ]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    const row = cur.rows[0];
    const effStart = startDate != null ? String(startDate).trim().slice(0, 10) : toYmdDb(row.start_date);
    const effEnd = endDate != null ? String(endDate).trim().slice(0, 10) : toYmdDb(row.end_date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effStart) || !/^\d{4}-\d{2}-\d{2}$/.test(effEnd)) {
      return res.status(400).json({ error: 'Invalid dates (use YYYY-MM-DD)' });
    }
    if (effStart > effEnd) return res.status(400).json({ error: 'startDate must be on or before endDate' });
    const overlaps = await findOverlappingTrips(userId, effStart, effEnd, idResult.value);
    if (overlaps.length > 0) {
      return res.status(409).json({
        error:
          'These dates overlap another trip. Delete or change the other trip, or pick different dates.',
        code: 'TRIP_DATE_OVERLAP',
        conflicts: overlaps.map((r) => ({ id: r.id, name: r.name })),
      });
    }
  }
  values.push(idResult.value, userId);
  try {
    const result = await dbQuery(
      `UPDATE trips SET ${updates.join(', ')} WHERE id = $${pos} AND user_id = $${pos + 1} RETURNING id, name, start_date, end_date, description, days, created_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      description: row.description,
      days: normalizeDays(row.days),
      createdAt: row.created_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

router.delete('/:id', async (req, res) => {
  const userId = req.user.userId;
  const idResult = parseTripId(req.params.id);
  if (!idResult.valid) return res.status(400).json({ error: 'Invalid trip id' });
  try {
    const result = await dbQuery('DELETE FROM trips WHERE id = $1 AND user_id = $2 RETURNING id', [idResult.value, userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// Saved places – uses table: saved_places (user_id uuid, place_id varchar), composite primary key (user_id, place_id)
router.get('/favourites', async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await dbQuery('SELECT place_id FROM saved_places WHERE user_id = $1', [userId]);
    res.json({ placeIds: result.rows.map((r) => r.place_id) });
  } catch (err) {
    if (err.code === '42P01') return res.json({ placeIds: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch favourites' });
  }
});

router.post('/favourites', async (req, res) => {
  const userId = req.user.userId;
  const placeIdRaw = req.body && (req.body.placeId ?? req.body.place_id);
  const placeIdResult = parsePlaceId(placeIdRaw);
  if (!placeIdResult.valid) return res.status(400).json({ error: 'placeId required (string or number, max 255 chars)' });
  try {
    await dbQuery(
      'INSERT INTO saved_places (user_id, place_id) VALUES ($1, $2) ON CONFLICT (user_id, place_id) DO NOTHING',
      [userId, placeIdResult.value]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '42P01') return res.json({ ok: true });
    console.error(err);
    res.status(500).json({ error: 'Failed to add favourite' });
  }
});

router.delete('/favourites/:placeId', async (req, res) => {
  const placeIdResult = parsePlaceId(req.params.placeId);
  if (!placeIdResult.valid) return res.status(400).json({ error: 'Invalid place id' });
  const userId = req.user.userId;
  try {
    await dbQuery('DELETE FROM saved_places WHERE user_id = $1 AND place_id = $2', [userId, placeIdResult.value]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '42P01') return res.json({ ok: true });
    console.error(err);
    res.status(500).json({ error: 'Failed to remove favourite' });
  }
});

module.exports = router;
