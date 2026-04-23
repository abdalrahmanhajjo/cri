const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { getCollection } = require('../mongo');
const { optionalAuthMiddleware } = require('../middleware/auth');
const { isMessagingBlocked } = require('../utils/messagingBlocks');
const { visitorFollowupsFromDb, ownerMessagesFromInquiry } = require('../utils/inquiryFollowups');

const MAX_VISITOR_FOLLOWUPS_PER_INQUIRY = 50;
/** Same contact + place + message within this window returns the existing row (idempotent sends, double-clicks). */
const INQUIRY_DEDUPE_MS = 120_000;
const FOLLOWUP_DEDUPE_MS = 90_000;

const inquiryPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 24,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false, default: false },
  message: { error: 'Too many messages. Please try again later.', code: 'INQUIRY_RATE_LIMIT' },
  keyGenerator: (req) => {
    if (req.user?.userId) return `piq:u:${req.user.userId}`;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '0';
    const em = (typeof req.body?.guestEmail === 'string' ? req.body.guestEmail : '').trim().toLowerCase().slice(0, 200);
    return `piq:${ip}:${em || 'no-email'}`;
  },
});

const inquiryFollowUpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false, default: false },
  message: { error: 'Too many follow-up messages. Please try again later.', code: 'INQUIRY_FOLLOWUP_RATE_LIMIT' },
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '0';
    const iid = String(req.params?.inquiryId || '').trim().slice(0, 80);
    if (req.user?.userId) return `pfu:u:${req.user.userId}:${iid}`;
    const em = (typeof req.body?.guestEmail === 'string' ? req.body.guestEmail : '').trim().toLowerCase().slice(0, 200);
    return `pfu:${ip}:${iid}:${em || 'guest'}`;
  },
});

function isValidContactEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

function isPlausiblePhone(s) {
  const t = String(s || '').trim();
  if (t.length < 8 || t.length > 40) return false;
  const digits = (t.match(/\d/g) || []).length;
  return digits >= 8;
}

async function findPublicPlaceByParam(rawId) {
  const places = await getCollection('places');
  return places.findOne({
    $or: [
      { id: rawId },
      { searchName: rawId },
      { name: new RegExp('^' + String(rawId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
    ],
  });
}

function inquiryToGuestResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    placeId: row.place_id,
    status: row.status,
    message: row.message || '',
    response: row.response || '',
    ownerFollowups: ownerMessagesFromInquiry(row),
    respondedAt: row.responded_at || null,
    createdAt: row.created_at || null,
    visitorFollowups: visitorFollowupsFromDb(row.visitor_followups),
  };
}

async function loadInquiry(placeId, inquiryId) {
  const inquiriesColl = await getCollection('place_inquiries');
  return inquiriesColl.findOne({ id: inquiryId, place_id: placeId });
}

function canAccessInquiry(req, inv) {
  if (!inv) return false;
  const uid = req.user?.userId ? String(req.user.userId) : '';
  if (inv.user_id && uid && String(inv.user_id) === uid) return true;
  if (inv.user_id) return false;
  return false;
}

function canAccessInquiryGuestEmail(inv, emailRaw) {
  const ge = String(inv.guest_email || '').trim().toLowerCase();
  const em = String(emailRaw || '').trim().toLowerCase();
  return ge && em && ge === em;
}

function attachPlaceInquiryRoutes(router) {
  router.post('/:id/inquiries', optionalAuthMiddleware, inquiryPostLimiter, async (req, res) => {
    const rawPlaceId = req.params.id;
    let message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (message.length < 3) return res.status(400).json({ error: 'Message is too short' });
    if (message.length > 8000) message = message.slice(0, 8000);

    const intent =
      typeof req.body?.intent === 'string' ? req.body.intent.trim().slice(0, 40) : '';

    try {
      const place = await findPublicPlaceByParam(rawPlaceId);
      if (!place) return res.status(404).json({ error: 'Place not found' });

      const placeId = place.id;
      const userId = req.user?.userId || null;

      let guestName = typeof req.body?.guestName === 'string' ? req.body.guestName.trim().slice(0, 200) : '';
      let guestEmail = typeof req.body?.guestEmail === 'string' ? req.body.guestEmail.trim().slice(0, 320) : '';
      const guestPhone = typeof req.body?.guestPhone === 'string' ? req.body.guestPhone.trim().slice(0, 40) : '';

      if (userId) {
        const users = await getCollection('users');
        const u = await users.findOne({ id: userId });
        if (u && !guestEmail && u.email) guestEmail = String(u.email).trim();
        if (u && !guestName && u.name) guestName = String(u.name).trim();
      }

      if (!isValidContactEmail(guestEmail)) {
        return res.status(400).json({ error: 'Valid email is required' });
      }
      if (!isPlausiblePhone(guestPhone)) {
        return res.status(400).json({ error: 'Valid phone number is required' });
      }
      if (!userId && guestName.length < 2) {
        return res.status(400).json({ error: 'Your name is required' });
      }

      const blocked = await isMessagingBlocked(placeId, userId || null, guestEmail.toLowerCase());
      if (blocked) {
        return res.status(403).json({ error: 'Messaging is not available for this contact.', code: 'MESSAGING_BLOCKED' });
      }

      const fullMessage = intent ? '[' + intent + '] ' + message : message;
      const inquiriesColl = await getCollection('place_inquiries');
      const since = new Date(Date.now() - INQUIRY_DEDUPE_MS);
      const dedupeQ = {
        place_id: placeId,
        message: fullMessage,
        created_at: { $gte: since },
      };
      if (userId) dedupeQ.user_id = userId;
      else dedupeQ.guest_email = guestEmail.trim().toLowerCase();

      const existingSame = await inquiriesColl.findOne(dedupeQ);
      if (existingSame) {
        return res.status(201).json({
          id: existingSame.id,
          message: 'Thank you — the venue can reply by email or phone.',
          duplicate: true,
        });
      }

      const id = crypto.randomUUID();
      const doc = {
        id,
        place_id: placeId,
        user_id: userId || null,
        guest_name: guestName || null,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        message: fullMessage,
        response: null,
        status: 'open',
        created_at: new Date(),
        visitor_followups: [],
        owner_followups: [],
      };

      await inquiriesColl.insertOne(doc);

      res.status(201).json({
        id,
        message: 'Thank you — the venue can reply by email or phone.',
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not send message' });
    }
  });

  router.get('/:id/inquiries/:inquiryId', optionalAuthMiddleware, async (req, res) => {
    const rawPlaceId = req.params.id;
    const inquiryId = String(req.params.inquiryId || '').trim();
    const emailQ = typeof req.query?.email === 'string' ? req.query.email : '';

    try {
      const place = await findPublicPlaceByParam(rawPlaceId);
      if (!place) return res.status(404).json({ error: 'Place not found' });

      const inv = await loadInquiry(place.id, inquiryId);
      if (!inv) return res.status(404).json({ error: 'Message not found' });

      if (canAccessInquiry(req, inv)) {
        return res.json(inquiryToGuestResponse(inv));
      }
      if (canAccessInquiryGuestEmail(inv, emailQ)) {
        return res.json(inquiryToGuestResponse(inv));
      }
      return res.status(403).json({ error: 'Cannot access this thread' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to load message' });
    }
  });

  router.post('/:id/inquiries/:inquiryId/follow-up', optionalAuthMiddleware, inquiryFollowUpLimiter, async (req, res) => {
    const rawPlaceId = req.params.id;
    const inquiryId = String(req.params.inquiryId || '').trim();
    const emailQ = typeof req.query?.email === 'string' ? req.query.email : '';
    let body = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (body.length < 3) return res.status(400).json({ error: 'Message is too short' });
    if (body.length > 8000) body = body.slice(0, 8000);

    try {
      const place = await findPublicPlaceByParam(rawPlaceId);
      if (!place) return res.status(404).json({ error: 'Place not found' });

      const inquiriesColl = await getCollection('place_inquiries');
      const inv = await loadInquiry(place.id, inquiryId);
      if (!inv) return res.status(404).json({ error: 'Message not found' });

      const emailForGuest =
        typeof req.body?.guestEmail === 'string' && req.body.guestEmail.trim()
          ? req.body.guestEmail
          : emailQ;
      const allowed =
        canAccessInquiry(req, inv) || canAccessInquiryGuestEmail(inv, emailForGuest);
      if (!allowed) return res.status(403).json({ error: 'Cannot access this thread' });

      if (String(inv.status || '').toLowerCase() === 'archived') {
        return res.status(403).json({ error: 'This thread is closed.', code: 'INQUIRY_ARCHIVED' });
      }

      const blocked = await isMessagingBlocked(
        place.id,
        inv.user_id || null,
        String(inv.guest_email || '').trim().toLowerCase()
      );
      if (blocked) {
        return res.status(403).json({ error: 'Messaging is not available.', code: 'MESSAGING_BLOCKED' });
      }

      const prev = visitorFollowupsFromDb(inv.visitor_followups);
      if (prev.length >= MAX_VISITOR_FOLLOWUPS_PER_INQUIRY) {
        return res.status(400).json({ error: 'Too many follow-up messages on this thread.' });
      }

      const nowMs = Date.now();
      const dupFollow = prev.some((f) => {
        if (String(f.body).trim() !== body) return false;
        const t = f.createdAt ? Date.parse(f.createdAt) : NaN;
        return Number.isFinite(t) && nowMs - t < FOLLOWUP_DEDUPE_MS;
      });
      if (dupFollow) {
        return res.json(inquiryToGuestResponse(inv));
      }

      const entry = { body, createdAt: new Date().toISOString() };
      await inquiriesColl.updateOne(
        { id: inquiryId, place_id: place.id },
        {
          $push: { visitor_followups: entry },
          $set: { updated_at: new Date() },
        }
      );

      const next = await loadInquiry(place.id, inquiryId);
      res.json(inquiryToGuestResponse(next));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not send follow-up' });
    }
  });
}

module.exports = { attachPlaceInquiryRoutes };
