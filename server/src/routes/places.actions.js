const express = require('express');
const { query: dbQuery } = require('../db');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { reviewSchema, checkinSchema, inquirySchema, inquiryFollowupSchema } = require('../schemas/places');
const { haversineMeters } = require('../utils/geo');
const { visitorFollowupsFromDb } = require('../utils/inquiryFollowups');
const { isMessagingBlocked } = require('../utils/messagingBlocks');
const { getPlaceReviewMeta, userIsAdmin, userManagesPlace } = require('../utils/places');

const router = express.Router();
const MAX_VISITOR_FOLLOWUPS_PER_INQUIRY = 50;

function isValidContactEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

function isPlausiblePhone(s) {
  const t = String(s || '').trim();
  if (t.length < 8 || t.length > 40) return false;
  const digits = (t.match(/\d/g) || []).length;
  return digits >= 8;
}

/** Logged-in user posts or updates their review for this place (one per user). */
router.post('/:id/reviews', authMiddleware, validate(reviewSchema), async (req, res) => {
  const rawId = req.params.id;
  const userId = req.user.userId;
  const ratingRaw = req.body?.rating;
  const rating = parseInt(String(ratingRaw), 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 200) : '';
  let text = typeof req.body?.review === 'string' ? req.body.review.trim() : '';
  if (text.length > 8000) text = text.slice(0, 8000);
  if (text.length > 0 && text.length < 4) {
    return res.status(400).json({ error: 'Review text must be at least 4 characters.' });
  }

  try {
    const { rows: placeRows } = await dbQuery('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;
    const { hasHiddenAt } = await getPlaceReviewMeta();

    let existing;
    try {
      const sel = hasHiddenAt
        ? 'SELECT id, hidden_at FROM place_reviews WHERE place_id = $1 AND user_id = $2'
        : 'SELECT id FROM place_reviews WHERE place_id = $1 AND user_id = $2';
      ({ rows: existing } = await dbQuery(sel, [placeId, userId]));
    } catch (e) {
      if (e.code === '42703') {
        ({ rows: existing } = await dbQuery('SELECT id FROM place_reviews WHERE place_id = $1 AND user_id = $2', [placeId, userId]));
      } else throw e;
    }

    const titleVal = title || null;
    const reviewVal = text || null;

    if (existing.length) {
      if (hasHiddenAt && existing[0].hidden_at != null) {
        if (!(await userIsAdmin(userId))) return res.status(403).json({ error: 'Review is hidden.', code: 'REVIEW_HIDDEN' });
      }
      await dbQuery('UPDATE place_reviews SET rating = $1, title = $2, review = $3, created_at = now() WHERE id = $4', [rating, titleVal, reviewVal, existing[0].id]);
    } else {
      await dbQuery('INSERT INTO place_reviews (place_id, user_id, rating, title, review) VALUES ($1, $2, $3, $4, $5)', [placeId, userId, rating, titleVal, reviewVal]);
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save review' });
  }
});

/** Author, admin, or place owner: remove a review row. */
router.delete('/:id/reviews/:reviewId', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const reviewId = parseInt(req.params.reviewId, 10);
  const userId = req.user.userId;
  try {
    const { rows: placeRows } = await dbQuery('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;

    const { rows: revRows } = await dbQuery('SELECT id, user_id, place_id FROM place_reviews WHERE id = $1', [reviewId]);
    if (!revRows.length || revRows[0].place_id !== placeId) return res.status(404).json({ error: 'Review not found' });

    const rev = revRows[0];
    if (String(rev.user_id) !== String(userId) && !(await userIsAdmin(userId)) && !(await userManagesPlace(userId, placeId))) {
      return res.status(403).json({ error: 'You cannot delete this review' });
    }
    await dbQuery('DELETE FROM place_reviews WHERE id = $1', [reviewId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete review' });
  }
});

/** Admin or business owner for this place: hide (soft) or restore a review. */
router.patch('/:id/reviews/:reviewId', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const reviewId = parseInt(req.params.reviewId, 10);
  const hidden = req.body?.hidden;
  if (typeof hidden !== 'boolean') return res.status(400).json({ error: 'hidden must be boolean' });
  const userId = req.user.userId;

  try {
    const { rows: placeRows } = await dbQuery('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;

    if (!(await userIsAdmin(userId)) && !(await userManagesPlace(userId, placeId))) {
      return res.status(403).json({ error: 'Only an admin or owner can moderate reviews.' });
    }

    const { hasHiddenAt } = await getPlaceReviewMeta();
    if (!hasHiddenAt) return res.status(503).json({ error: 'Moderation requires DB migration 013.' });

    await dbQuery(`UPDATE place_reviews SET hidden_at = ${hidden ? 'now()' : 'NULL'} WHERE id = $1`, [reviewId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update review' });
  }
});

/** Logged-in user checks in. */
router.post('/:id/checkin', authMiddleware, validate(checkinSchema), async (req, res) => {
  const rawId = req.params.id;
  const userId = req.user.userId;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : null;
  const maxM = parseInt(process.env.CHECKIN_MAX_DISTANCE_METERS || '400', 10);

  try {
    const { rows } = await dbQuery('SELECT id, latitude, longitude FROM places WHERE id = $1', [rawId]);
    if (!rows.length) return res.status(404).json({ error: 'Place not found' });
    const place = rows[0];
    const placeId = place.id;

    if (place.latitude != null && place.longitude != null && maxM > 0) {
      const uLat = parseFloat(req.body.latitude);
      const uLng = parseFloat(req.body.longitude);
      const dist = haversineMeters(uLat, uLng, Number(place.latitude), Number(place.longitude));
      if (dist > maxM) return res.status(400).json({ error: 'Too far', code: 'TOO_FAR', distanceMeters: Math.round(dist) });
    }

    try {
      await dbQuery('INSERT INTO place_checkins (place_id, user_id, note) VALUES ($1, $2, $3)', [placeId, userId, note]);
    } catch (e) {
      if (e.code === '23505') return res.json({ ok: true, alreadyCheckedInToday: true });
      throw e;
    }
    res.status(201).json({ ok: true, placeId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Check-in failed' });
  }
});

/** Visitor inquiry/message. */
router.post('/:id/inquiries', optionalAuthMiddleware, validate(inquirySchema), async (req, res) => {
  const rawId = req.params.id;
  const messageRaw = (req.body?.message || '').trim();
  if (messageRaw.length < 3 || messageRaw.length > 8000) return res.status(400).json({ error: 'Invalid message length' });

  const guestPhone = (req.body?.guestPhone || '').trim().slice(0, 40);
  if (!isPlausiblePhone(guestPhone)) return res.status(400).json({ error: 'Invalid phone' });

  const userId = req.user?.userId || null;
  let guestName = (req.body?.guestName || '').trim();
  let guestEmail = (req.body?.guestEmail || '').trim().toLowerCase();

  if (userId) {
    const { rows } = await dbQuery('SELECT email, name FROM users WHERE id = $1', [userId]);
    const u = rows[0];
    if (!guestEmail) guestEmail = u?.email;
    if (!guestName) guestName = u?.name;
  }
  if (!guestName || !isValidContactEmail(guestEmail)) return res.status(400).json({ error: 'Name and email required' });

  try {
    const { rows: placeRows } = await dbQuery('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;

    if (await isMessagingBlocked(placeId, userId, guestEmail)) return res.status(403).json({ error: 'Blocked', code: 'MESSAGING_BLOCKED' });

    const { rows: insRows } = await dbQuery(
      `INSERT INTO place_inquiries (place_id, user_id, guest_name, guest_email, guest_phone, message)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [placeId, userId, guestName, guestEmail, guestPhone, messageRaw]
    );
    res.status(201).json({ ok: true, id: insRows[0].id, createdAt: insRows[0].created_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Inquiry failed' });
  }
});

/** GET /api/places/:id/inquiries/:inquiryId */
router.get('/:id/inquiries/:inquiryId', optionalAuthMiddleware, async (req, res) => {
  const inquiryId = parseInt(req.params.inquiryId, 10);
  const emailQ = (req.query.email || '').trim().toLowerCase();
  try {
    const { rows: invRows } = await dbQuery('SELECT * FROM place_inquiries WHERE id = $1', [inquiryId]);
    if (!invRows.length) return res.status(404).json({ error: 'Not found' });
    const inv = invRows[0];

    const userId = req.user?.userId || null;
    let allowed = (userId && String(inv.user_id) === String(userId)) || (emailQ && inv.guest_email === emailQ);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    res.json({
      id: inv.id,
      status: inv.status,
      response: inv.response,
      createdAt: inv.created_at,
      visitorFollowups: visitorFollowupsFromDb(inv.visitor_followups),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

/** POST /api/places/:id/inquiries/:inquiryId/follow-up */
router.post('/:id/inquiries/:inquiryId/follow-up', optionalAuthMiddleware, validate(inquiryFollowupSchema), async (req, res) => {
  const inquiryId = parseInt(req.params.inquiryId, 10);
  const text = (req.body?.message || '').trim();
  const guestEmail = (req.body?.guestEmail || '').trim().toLowerCase();
  const userId = req.user?.userId || null;

  try {
    const { rows } = await dbQuery('SELECT * FROM place_inquiries WHERE id = $1', [inquiryId]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const inv = rows[0];

    if (inv.status === 'archived') return res.status(403).json({ error: 'Archived' });
    let allowed = (userId && String(inv.user_id) === String(userId)) || (guestEmail && inv.guest_email === guestEmail);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    const existing = visitorFollowupsFromDb(inv.visitor_followups);
    if (existing.length >= MAX_VISITOR_FOLLOWUPS_PER_INQUIRY) return res.status(400).json({ error: 'Too many follow-ups' });

    const entry = { body: text, createdAt: new Date().toISOString() };
    await dbQuery(
      `UPDATE place_inquiries SET visitor_followups = COALESCE(visitor_followups, '[]'::jsonb) || $1::jsonb,
       status = CASE WHEN status = 'answered' THEN 'open' ELSE status END
       WHERE id = $2`,
      [JSON.stringify([entry]), inquiryId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
