const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { parsePlaceId } = require('../../utils/validate');
const crypto = require('crypto');

const router = express.Router();
router.use(authMiddleware, businessPortalMiddleware);

async function assertOwnsPlace(userId, placeId) {
  const poColl = await getCollection('place_owners');
  const owner = await poColl.findOne({ user_id: userId, place_id: placeId });
  return !!owner;
}

/**
 * POST /api/business/messaging-blocks
 * Body: { placeId, inquiryId }
 */
router.post('/', async (req, res) => {
  const parsed = parsePlaceId(req.body?.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'Valid placeId required' });
  const placeId = parsed.value;
  const inquiryId = req.body?.inquiryId;
  if (!inquiryId) return res.status(400).json({ error: 'Valid inquiryId required' });
  
  const userId = req.user.userId;
  if (!(await assertOwnsPlace(userId, placeId))) {
    return res.status(403).json({ error: 'You do not manage this place' });
  }

  try {
    const inquiriesColl = await getCollection('place_inquiries');
    const inv = await inquiriesColl.findOne({ id: inquiryId, place_id: placeId });
    if (!inv) return res.status(404).json({ error: 'Inquiry not found' });
    
    const uid = inv.user_id || null;
    const em =
      inv.guest_email && String(inv.guest_email).trim()
        ? String(inv.guest_email).trim().toLowerCase().slice(0, 320)
        : '';

    const blocksColl = await getCollection('place_messaging_blocks');

    if (uid) {
      const ex = await blocksColl.findOne({ place_id: placeId, blocked_user_id: uid });
      if (ex) {
        return res.json({ ok: true, blocked: true, already: true, blockId: ex.id });
      }
      const newId = crypto.randomUUID();
      await blocksColl.insertOne({
        id: newId,
        place_id: placeId,
        blocked_user_id: uid,
        blocked_email: null,
        created_at: new Date()
      });
      return res.json({ ok: true, blocked: true, blockId: newId });
    }

    if (!em) {
      return res.status(400).json({ error: 'Cannot block this visitor (no email on inquiry)' });
    }

    const ex = await blocksColl.findOne({ 
      place_id: placeId, 
      blocked_user_id: null, 
      blocked_email: em 
    });
    if (ex) {
      return res.json({ ok: true, blocked: true, already: true, blockId: ex.id });
    }
    
    const newId = crypto.randomUUID();
    await blocksColl.insertOne({
      id: newId,
      place_id: placeId,
      blocked_user_id: null,
      blocked_email: em,
      created_at: new Date()
    });
    return res.json({ ok: true, blocked: true, blockId: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not block visitor' });
  }
});

/**
 * DELETE /api/business/messaging-blocks?placeId=&inquiryId=
 */
router.delete('/', async (req, res) => {
  const parsed = parsePlaceId(req.query.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'Valid placeId required' });
  const placeId = parsed.value;
  const inquiryId = req.query.inquiryId;
  if (!inquiryId) return res.status(400).json({ error: 'Valid inquiryId required' });
  
  const userId = req.user.userId;
  if (!(await assertOwnsPlace(userId, placeId))) {
    return res.status(403).json({ error: 'You do not manage this place' });
  }

  try {
    const inquiriesColl = await getCollection('place_inquiries');
    const inv = await inquiriesColl.findOne({ id: inquiryId, place_id: placeId });
    if (!inv) return res.status(404).json({ error: 'Inquiry not found' });
    
    const uid = inv.user_id || null;
    const em =
      inv.guest_email && String(inv.guest_email).trim()
        ? String(inv.guest_email).trim().toLowerCase().slice(0, 320)
        : '';

    const blocksColl = await getCollection('place_messaging_blocks');

    if (uid) {
      await blocksColl.deleteOne({ place_id: placeId, blocked_user_id: uid });
    } else if (em) {
      await blocksColl.deleteOne({ 
        place_id: placeId, 
        blocked_user_id: null, 
        blocked_email: em 
      });
    } else {
      return res.status(400).json({ error: 'Cannot unblock (no identifier on inquiry)' });
    }

    res.json({ ok: true, blocked: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not unblock visitor' });
  }
});

module.exports = router;
