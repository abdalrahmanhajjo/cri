const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../db');
const { parsePlaceId, parseTripId } = require('../utils/validate');

function generateTripId() {
  const t = Date.now();
  const r = Math.random().toString(36).slice(2, 9);
  return `trip_${t}_${r}`;
}

const router = express.Router();
router.use(authMiddleware);

function parseDays(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

/** Normalize days to [{ placeIds: string[] }] for the client. Supports legacy slots format. */
function normalizeDays(raw) {
  const arr = parseDays(raw);
  return arr.map((day) => {
    if (day && Array.isArray(day.placeIds)) return { placeIds: [...day.placeIds] };
    if (day && Array.isArray(day.slots)) {
      const placeIds = day.slots.map((s) => s && (s.placeId ?? s.place_id)).filter(Boolean);
      return { placeIds };
    }
    return { placeIds: [] };
  });
}

router.get('/trips', async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await query(
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

router.post('/trips', async (req, res) => {
  const userId = req.user.userId;
  const name = req.body && typeof req.body.name === 'string' ? req.body.name.trim() : null;
  const startDate = req.body && req.body.startDate ? String(req.body.startDate).trim().slice(0, 10) : null;
  const endDate = req.body && req.body.endDate ? String(req.body.endDate).trim().slice(0, 10) : null;
  if (!name || name.length > 200) return res.status(400).json({ error: 'Trip name required (max 200 chars)' });
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });
  const id = generateTripId();
  try {
    const result = await query(
      'INSERT INTO trips (id, user_id, name, start_date, end_date, days) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, start_date, end_date, description, days, created_at',
      [id, userId, name, startDate, endDate, JSON.stringify([])]
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

router.patch('/trips/:id', async (req, res) => {
  const userId = req.user.userId;
  const idResult = parseTripId(req.params.id);
  if (!idResult.valid) return res.status(400).json({ error: 'Invalid trip id' });
  const { name, startDate, endDate, days } = req.body || {};
  const updates = [];
  const values = [];
  let pos = 1;
  if (typeof name === 'string' && name.trim()) {
    updates.push(`name = $${pos++}`);
    values.push(name.trim().slice(0, 200));
  }
  if (startDate != null) {
    updates.push(`start_date = $${pos++}`);
    values.push(String(startDate).trim().slice(0, 10));
  }
  if (endDate != null) {
    updates.push(`end_date = $${pos++}`);
    values.push(String(endDate).trim().slice(0, 10));
  }
  if (Array.isArray(days)) {
    updates.push(`days = $${pos++}`);
    values.push(JSON.stringify(days));
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
  values.push(idResult.value, userId);
  try {
    const result = await query(
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

router.delete('/trips/:id', async (req, res) => {
  const userId = req.user.userId;
  const idResult = parseTripId(req.params.id);
  if (!idResult.valid) return res.status(400).json({ error: 'Invalid trip id' });
  try {
    const result = await query('DELETE FROM trips WHERE id = $1 AND user_id = $2 RETURNING id', [idResult.value, userId]);
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
    const result = await query('SELECT place_id FROM saved_places WHERE user_id = $1', [userId]);
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
    await query(
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
    await query('DELETE FROM saved_places WHERE user_id = $1 AND place_id = $2', [userId, placeIdResult.value]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '42P01') return res.json({ ok: true });
    console.error(err);
    res.status(500).json({ error: 'Failed to remove favourite' });
  }
});

module.exports = router;
