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

function generateTripShareRequestId() {
  const t = Date.now();
  const r = crypto.randomBytes(6).toString('hex');
  return `tsr_${t}_${r}`;
}

const router = express.Router();
router.use(authMiddleware);

/** Sort saved-place docs: most recently saved first; stable tie-break on place_id. */
function savedAtMs(doc) {
  if (!doc || doc.created_at == null) return 0;
  const t = new Date(doc.created_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

function sortSavedPlaceDocs(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort(
    (a, b) =>
      savedAtMs(b) - savedAtMs(a) || String(a.place_id || '').localeCompare(String(b.place_id || ''))
  );
  return list;
}

let savedPlacesIndexesPromise = null;
function ensureSavedPlacesIndexes(favsColl) {
  if (!savedPlacesIndexesPromise) {
    savedPlacesIndexesPromise = (async () => {
      try {
        await favsColl.createIndex({ user_id: 1, place_id: 1 }, { unique: true, background: true });
      } catch (err) {
        console.warn('saved_places compound index (unique):', err.message);
        await favsColl.createIndex({ user_id: 1, place_id: 1 }, { background: true }).catch(() => {});
      }
      try {
        await favsColl.createIndex({ user_id: 1, created_at: -1 }, { background: true });
      } catch (err) {
        console.warn('saved_places created_at index:', err.message);
      }
    })();
  }
  return savedPlacesIndexesPromise;
}

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

function usernameNormalize(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/\s+/g, '');
}

function escapeRegex(raw) {
  return String(raw || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getUserPreviewById(userId) {
  const usersColl = await getCollection('users');
  const user = await usersColl.findOne({ id: userId });
  if (!user) return null;
  const profile = user.profile || {};
  return {
    id: user.id,
    username: profile.username || '',
    name: user.name || '',
  };
}

async function getUserPreviewByUsername(rawUsername) {
  const handle = usernameNormalize(rawUsername);
  if (!handle) return null;
  const usersColl = await getCollection('users');
  const user = await usersColl.findOne({ 'profile.username_normalized': handle });
  if (!user) return null;
  const profile = user.profile || {};
  return {
    id: user.id,
    username: profile.username || '',
    name: user.name || '',
  };
}

function mapShareRequestForClient(row, currentUserId) {
  const trip = row.trip_snapshot || {};
  const fromUser = row.from_user || {};
  const toUser = row.to_user || {};
  const days = normalizeDays(trip.days || []);
  const stopCount = days.reduce((acc, d) => acc + (Array.isArray(d.slots) ? d.slots.length : 0), 0);
  return {
    id: row.id,
    status: row.status || 'pending',
    message: row.message || '',
    createdAt: row.created_at || null,
    respondedAt: row.responded_at || null,
    respondedBy: row.responded_by || null,
    isIncoming: String(row.to_user_id) === String(currentUserId),
    fromUser: {
      id: fromUser.id || row.from_user_id,
      name: fromUser.name || '',
      username: fromUser.username || '',
    },
    toUser: {
      id: toUser.id || row.to_user_id,
      name: toUser.name || '',
      username: toUser.username || '',
    },
    trip: {
      id: trip.id || row.trip_id,
      name: trip.name || 'Trip',
      startDate: trip.startDate || '',
      endDate: trip.endDate || '',
      description: trip.description || '',
      days,
      dayCount: days.length,
      stopCount,
    },
  };
}

async function buildTripUsersPayload(tripRow) {
  const hostId = tripRow.shared_from_user_id || tripRow.user_id;
  const hostUser = await getUserPreviewById(hostId);
  const users = [];
  if (hostUser) users.push({ ...hostUser, role: 'host' });

  if (tripRow.shared_from_user_id) {
    const owner = await getUserPreviewById(tripRow.user_id);
    if (owner && String(owner.id) !== String(hostId)) users.push({ ...owner, role: 'member' });
    return { users, hostUserId: hostId };
  }

  const requestsColl = await getCollection('trip_share_requests');
  const acceptedRows = await requestsColl
    .find({ trip_id: tripRow.id, status: 'accepted' })
    .project({ to_user_id: 1 })
    .toArray();
  const memberIds = [...new Set(acceptedRows.map((r) => r.to_user_id).filter(Boolean))];
  for (const memberId of memberIds) {
    if (String(memberId) === String(hostId)) continue;
    const member = await getUserPreviewById(memberId);
    if (member) users.push({ ...member, role: 'member' });
  }
  return { users, hostUserId: hostId };
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
      createdAt: row.created_at,
      isHost: !row.shared_from_user_id,
      sharedFromUserId: row.shared_from_user_id || null,
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
    const membership = await buildTripUsersPayload(row);
    res.json({
      id: row.id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      description: row.description,
      days: normalizeDays(row.days),
      createdAt: row.created_at,
      isHost: String(membership.hostUserId) === String(userId),
      users: membership.users,
      hostUserId: membership.hostUserId,
      sharedFromUserId: row.shared_from_user_id || null,
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
    if (trip.shared_from_user_id) {
      return res.status(403).json({ error: 'Only the trip host can edit this trip' });
    }
    
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
    const trip = await tripsColl.findOne({ id: tripId, user_id: userId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.shared_from_user_id) {
      return res.status(403).json({ error: 'Only the trip host can delete this trip' });
    }
    const result = await tripsColl.deleteOne({ id: tripId, user_id: userId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

router.get('/trip-share-requests', async (req, res) => {
  const userId = req.user.userId;
  const box = String(req.query?.box || 'inbox').toLowerCase();
  const status = String(req.query?.status || 'all').toLowerCase();
  const isSent = box === 'sent';
  const statusFilter = ['pending', 'accepted', 'rejected', 'cancelled'].includes(status) ? status : 'all';

  try {
    const requestsColl = await getCollection('trip_share_requests');
    const query = isSent ? { from_user_id: userId } : { to_user_id: userId };
    if (statusFilter !== 'all') query.status = statusFilter;
    const rows = await requestsColl.find(query).sort({ created_at: -1 }).limit(200).toArray();
    const requests = rows.map((row) => mapShareRequestForClient(row, userId));
    res.json({ requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load share requests' });
  }
});

router.get('/trip-share-users', async (req, res) => {
  const userId = req.user.userId;
  const qRaw = String(req.query?.q || '').trim();
  if (qRaw.length < 2) return res.json({ users: [] });
  try {
    const usersColl = await getCollection('users');
    const q = escapeRegex(qRaw);
    const rx = new RegExp(q, 'i');
    const rows = await usersColl
      .find({
        id: { $ne: userId },
        $or: [
          { name: rx },
          { 'profile.username': rx },
          { 'profile.username_normalized': rx },
          { email: rx },
        ],
      })
      .project({ id: 1, name: 1, email: 1, profile: 1 })
      .limit(12)
      .toArray();
    const users = rows.map((u) => ({
      id: u.id,
      name: u.name || '',
      username: u.profile?.username || '',
      email: u.email || '',
    }));
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

router.post('/trip-share-requests', async (req, res) => {
  const userId = req.user.userId;
  const tripId = req.body?.tripId != null ? String(req.body.tripId) : '';
  const recipientUserId = req.body?.recipientUserId != null ? String(req.body.recipientUserId) : '';
  const recipientUsername = req.body?.recipientUsername != null ? String(req.body.recipientUsername) : '';
  const messageRaw = req.body?.message != null ? String(req.body.message) : '';
  const message = messageRaw.trim().slice(0, 1200);
  if (!tripId) return res.status(400).json({ error: 'tripId required' });
  if (!recipientUsername.trim() && !recipientUserId.trim()) {
    return res.status(400).json({ error: 'recipient required' });
  }

  try {
    const tripsColl = await getCollection('trips');
    const requestsColl = await getCollection('trip_share_requests');
    const trip = await tripsColl.findOne({ id: tripId, user_id: userId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.shared_from_user_id) {
      return res.status(403).json({ error: 'Only the trip host can send share requests' });
    }

    let recipient = null;
    if (recipientUserId.trim()) recipient = await getUserPreviewById(recipientUserId.trim());
    if (!recipient && recipientUsername.trim()) recipient = await getUserPreviewByUsername(recipientUsername);
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    if (String(recipient.id) === String(userId)) {
      return res.status(400).json({ error: 'Cannot send a share request to yourself' });
    }

    const sender = await getUserPreviewById(userId);
    if (!sender) return res.status(404).json({ error: 'Sender not found' });

    const existingPending = await requestsColl.findOne({
      from_user_id: userId,
      to_user_id: recipient.id,
      trip_id: tripId,
      status: 'pending',
    });
    if (existingPending) {
      return res.status(409).json({ error: 'A pending request already exists for this user and trip' });
    }

    const row = {
      id: generateTripShareRequestId(),
      trip_id: trip.id,
      from_user_id: userId,
      to_user_id: recipient.id,
      status: 'pending',
      message,
      created_at: new Date(),
      responded_at: null,
      responded_by: null,
      from_user: sender,
      to_user: recipient,
      trip_snapshot: {
        id: trip.id,
        name: trip.name || 'Trip',
        startDate: trip.start_date || '',
        endDate: trip.end_date || '',
        description: trip.description || '',
        days: normalizeDays(trip.days || []).map((d) => ({
          date: d.date,
          slots: d.slots,
        })),
      },
    };
    await requestsColl.insertOne(row);
    res.status(201).json(mapShareRequestForClient(row, userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send share request' });
  }
});

router.post('/trip-share-requests/:id/respond', async (req, res) => {
  const userId = req.user.userId;
  const requestId = req.params.id;
  const decision = String(req.body?.decision || '').toLowerCase();
  if (!['accept', 'reject'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'accept' or 'reject'" });
  }

  try {
    const requestsColl = await getCollection('trip_share_requests');
    const tripsColl = await getCollection('trips');
    const row = await requestsColl.findOne({ id: requestId, to_user_id: userId });
    if (!row) return res.status(404).json({ error: 'Share request not found' });
    if (row.status !== 'pending') return res.status(409).json({ error: 'Share request already decided' });

    if (decision === 'reject') {
      await requestsColl.updateOne(
        { id: requestId },
        { $set: { status: 'rejected', responded_at: new Date(), responded_by: userId } }
      );
      const updated = await requestsColl.findOne({ id: requestId });
      return res.json({ request: mapShareRequestForClient(updated, userId) });
    }

    const snap = row.trip_snapshot || {};
    const startDate = toYmdDb(snap.startDate || '');
    const endDate = toYmdDb(snap.endDate || '');
    if (!startDate || !endDate) {
      return res.status(422).json({ error: 'Shared trip data is incomplete' });
    }
    if (startDate > endDate) {
      return res.status(422).json({ error: 'Shared trip date range is invalid' });
    }

    const overlaps = await findOverlappingTrips(userId, startDate, endDate, null);
    if (overlaps.length > 0) {
      return res.status(409).json({
        error: 'Cannot accept due to date overlap with your existing trips',
        conflicts: overlaps.map((o) => ({ id: o.id, name: o.name })),
      });
    }

    const sharedTrip = {
      id: generateTripId(),
      user_id: userId,
      name: snap.name ? `${snap.name} (Shared)` : 'Shared Trip',
      start_date: startDate,
      end_date: endDate,
      description: snap.description || null,
      days: normalizeDays(snap.days || []).map((d) => ({ date: d.date, slots: d.slots })),
      created_at: new Date(),
      shared_from_user_id: row.from_user_id,
      shared_from_request_id: row.id,
    };
    await tripsColl.insertOne(sharedTrip);
    await requestsColl.updateOne(
      { id: requestId },
      {
        $set: {
          status: 'accepted',
          responded_at: new Date(),
          responded_by: userId,
          accepted_trip_id: sharedTrip.id,
        },
      }
    );
    const updated = await requestsColl.findOne({ id: requestId });
    res.json({
      request: mapShareRequestForClient(updated, userId),
      acceptedTrip: {
        id: sharedTrip.id,
        name: sharedTrip.name,
        startDate: sharedTrip.start_date,
        endDate: sharedTrip.end_date,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process share request' });
  }
});

router.get('/favourites', async (req, res) => {
  try {
    const userId = req.user.userId;
    const favsColl = await getCollection('saved_places');
    await ensureSavedPlacesIndexes(favsColl);
    const rows = await favsColl.find({ user_id: userId }).toArray();
    const sorted = sortSavedPlaceDocs(rows);
    const placeIds = sorted.map((r) => r.place_id);
    const items = sorted.map((r) => ({
      placeId: r.place_id,
      savedAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));
    res.json({ placeIds, items });
  } catch (err) {
    console.error(err);
    res.json({ placeIds: [], items: [] });
  }
});

router.post('/favourites', async (req, res) => {
  const userId = req.user.userId;
  const raw = req.body && (req.body.placeId ?? req.body.place_id);
  const parsed = parsePlaceId(raw);
  if (!parsed.valid) return res.status(400).json({ error: 'Invalid or missing place id' });
  const placeId = parsed.value;
  try {
    const favsColl = await getCollection('saved_places');
    await ensureSavedPlacesIndexes(favsColl);
    await favsColl.updateOne(
      { user_id: userId, place_id: placeId },
      {
        $set: { user_id: userId, place_id: placeId },
        $setOnInsert: { created_at: new Date() },
      },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.json({ ok: true });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to add favourite' });
  }
});

router.delete('/favourites/:placeId', async (req, res) => {
  const userId = req.user.userId;
  const parsed = parsePlaceId(req.params.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'Invalid place id' });
  const placeId = parsed.value;
  try {
    const favsColl = await getCollection('saved_places');
    await ensureSavedPlacesIndexes(favsColl);
    await favsColl.deleteOne({ user_id: userId, place_id: placeId });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove favourite' });
  }
});

module.exports = router;
