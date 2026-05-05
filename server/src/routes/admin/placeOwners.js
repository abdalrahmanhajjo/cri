const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { parsePlaceId } = require('../../utils/validate');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET /api/admin/place-owners ?q= */
router.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  try {
    const ownersColl = await getCollection('place_owners');
    const pipeline = [
      { $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
      }},
      { $unwind: '$user' }
    ];

    if (q) {
      pipeline.push({
        $match: {
          $or: [
            { place_id: { $regex: q, $options: 'i' } },
            { user_id: { $regex: q, $options: 'i' } },
            { 'user.email': { $regex: q, $options: 'i' } },
            { 'user.name': { $regex: q, $options: 'i' } }
          ]
        }
      });
    }

    pipeline.push({ $sort: { place_id: 1, 'user.email': 1 } });
    
    const rows = await ownersColl.aggregate(pipeline).toArray();
    
    res.json({
      owners: rows.map(r => ({
        user_id: r.user_id,
        place_id: r.place_id,
        email: r.user.email,
        user_name: r.user.name
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list place owners' });
  }
});

/** POST /api/admin/place-owners */
router.post('/', async (req, res) => {
  const userIdRaw = req.body?.userId;
  const placeParsed = parsePlaceId(req.body?.placeId);
  
  if (!userIdRaw || typeof userIdRaw !== 'string' || !UUID_RE.test(userIdRaw.trim())) {
    return res.status(400).json({ error: 'Valid userId required' });
  }
  const userId = userIdRaw.trim();
  
  if (!placeParsed.valid) {
    return res.status(400).json({ error: 'placeId is invalid or missing' });
  }
  const placeId = placeParsed.value;

  try {
    const usersColl = await getCollection('users');
    const user = await usersColl.findOne({ id: userId });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_blocked === true) {
      return res.status(403).json({ error: 'Cannot link a blocked account to a place' });
    }

    const placesColl = await getCollection('places');
    const place = await placesColl.findOne({ id: placeId });
    if (!place) return res.status(404).json({ error: 'Place not found' });

    const ownersColl = await getCollection('place_owners');
    const existing = await ownersColl.findOne({ user_id: userId, place_id: placeId });
    if (existing) {
      return res.status(409).json({ error: 'This user is already linked to this place' });
    }

    const crypto = require('crypto');
    await ownersColl.insertOne({ 
      id: crypto.randomUUID(),
      user_id: userId, 
      place_id: placeId, 
      created_at: new Date() 
    });
    res.status(201).json({ ok: true, userId, placeId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add place owner' });
  }
});

/** DELETE /api/admin/place-owners */
router.delete('/', async (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  const placeParsed = parsePlaceId(req.query.placeId);
  
  if (!userId || !UUID_RE.test(userId) || !placeParsed.valid) {
    return res.status(400).json({ error: 'Valid userId and placeId query params required' });
  }
  const placeId = placeParsed.value;

  try {
    const ownersColl = await getCollection('place_owners');
    const result = await ownersColl.deleteOne({ user_id: userId, place_id: placeId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove place owner' });
  }
});

module.exports = router;
