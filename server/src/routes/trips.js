const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getCollection } = require('../mongo');
const { parsePlaceId, parseTripId } = require('../utils/validate');
const crypto = require('crypto');

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
  const tripsColl = await getCollection('trips');
  const queryObj = {
    user_id: userId,
    start_date: { $lte: endYmd },
    end_date: { $gte: startYmd }
  };
  if (excludeTripId) {
    queryObj.id = { $ne: excludeTripId };
  }
  const results = await tripsColl.find(queryObj).toArray();
  return results;
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

router.get('/trips', async (req, res) => {
  try {
    const userId = req.user.userId;
    const tripsColl = await getCollection('trips');
    const rows = await tripsColl.find({ user_id: userId }).sort({ start_date: -1 }).toArray();
    
    const trips = rows.map((row) => ({
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

router.get('/trips/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const tripId = req.params.id;
    const tripsColl = await getCollection('trips');
    const row = await tripsColl.findOne({ id: tripId, user_id: userId });
    
    if (!row) return res.status(404).json({ error: 'Trip not found' });
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

router.post('/trips', async (req, res) => {
  const userId = req.user.userId;
  const name = req.body && typeof req.body.name === 'string' ? req.body.name.trim() : null;
  const startDate = req.body && req.body.startDate ? String(req.body.startDate).trim().slice(0, 10) : null;
  const endDate = req.body && req.body.endDate ? String(req.body.endDate).trim().slice(0, 10) : null;
  let description = null;
  if (req.body && typeof req.body.description === 'string') {
    const t = req.body.description.trim();
    description = t.length ? t.slice(0, 10000) : null;
  }
  
  if (!name || name.length > 200) return res.status(400).json({ error: 'Trip name required' });
  if (!startDate || !endDate) return res.status(400).json({ error: 'Dates required' });
  if (startDate > endDate) return res.status(400).json({ error: 'Invalid range' });
  
  const overlaps = await findOverlappingTrips(userId, startDate, endDate, null);
  if (overlaps.length > 0) {
    return res.status(409).json({ error: 'Overlap detected', conflicts: overlaps.map(o => ({ id: o.id, name: o.name })) });
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
    const tripsColl = await getCollection('trips');
    const newTrip = {
      id,
      user_id: userId,
      name,
      start_date: startDate,
      end_date: endDate,
      description,
      days: initialDays,
      created_at: new Date()
    };
    await tripsColl.insertOne(newTrip);
    res.status(201).json({
      ...newTrip,
      days: normalizeDays(newTrip.days)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

router.patch('/trips/:id', async (req, res) => {
  const userId = req.user.userId;
  const tripId = req.params.id;
  const { name, startDate, endDate, days, description } = req.body || {};
  
  try {
    const tripsColl = await getCollection('trips');
    const trip = await tripsColl.findOne({ id: tripId, user_id: userId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    
    const setObj = {};
    if (name !== undefined) setObj.name = name.trim().slice(0, 200);
    if (description !== undefined) setObj.description = description ? description.trim().slice(0, 10000) : null;
    if (startDate !== undefined) setObj.start_date = String(startDate).trim().slice(0, 10);
    if (endDate !== undefined) setObj.end_date = String(endDate).trim().slice(0, 10);
    if (Array.isArray(days)) {
       setObj.days = normalizeDays(days).map(d => ({ slots: d.slots, date: d.date }));
    }
    
    if (Object.keys(setObj).length === 0) return res.status(400).json({ error: 'No updates' });
    
    if (setObj.start_date || setObj.end_date) {
      const s = setObj.start_date || trip.start_date;
      const e = setObj.end_date || trip.end_date;
      if (s > e) return res.status(400).json({ error: 'Invalid range' });
      const overlaps = await findOverlappingTrips(userId, s, e, tripId);
      if (overlaps.length > 0) {
        return res.status(409).json({ error: 'Overlap', conflicts: overlaps.map(o => ({ id: o.id, name: o.name })) });
      }
    }
    
    await tripsColl.updateOne({ id: tripId }, { $set: setObj });
    const updated = await tripsColl.findOne({ id: tripId });
    res.json({
      ...updated,
      days: normalizeDays(updated.days)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

router.delete('/trips/:id', async (req, res) => {
  const userId = req.user.userId;
  const tripId = req.params.id;
  try {
    const tripsColl = await getCollection('trips');
    const result = await tripsColl.deleteOne({ id: tripId, user_id: userId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

router.get('/favourites', async (req, res) => {
  try {
    const userId = req.user.userId;
    const favsColl = await getCollection('saved_places');
    const rows = await favsColl.find({ user_id: userId }).toArray();
    res.json({ placeIds: rows.map((r) => r.place_id) });
  } catch (err) {
    console.error(err);
    res.json({ placeIds: [] });
  }
});

router.post('/favourites', async (req, res) => {
  const userId = req.user.userId;
  const placeId = req.body && (req.body.placeId ?? req.body.place_id);
  if (!placeId) return res.status(400).json({ error: 'placeId required' });
  try {
    const favsColl = await getCollection('saved_places');
    await favsColl.updateOne(
      { user_id: userId, place_id: String(placeId) },
      { $set: { user_id: userId, place_id: String(placeId), created_at: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add favourite' });
  }
});

router.delete('/favourites/:placeId', async (req, res) => {
  const userId = req.user.userId;
  const placeId = req.params.placeId;
  try {
    const favsColl = await getCollection('saved_places');
    await favsColl.deleteOne({ user_id: userId, place_id: String(placeId) });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove favourite' });
  }
});

module.exports = router;
