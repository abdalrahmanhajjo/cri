const express = require('express');
const { haversineMeters } = require('../utils/geo');
const { query } = require('../db');
const { getRequestLang } = require('../utils/requestLang');
const { parsePositiveInt } = require('../utils/validate');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { sendDbAwareError } = require('../utils/dbHttpError');
const {
  SQL_PLACE_PROMOTIONS,
  SQL_PLACE_PROMOTIONS_FALLBACK,
} = require('../utils/activeOfferFilters');

const router = express.Router();
const { visitorFollowupsFromDb } = require('../utils/inquiryFollowups');
const { isMessagingBlocked } = require('../utils/messagingBlocks');
const { normalizeDbText } = require('../utils/normalizeDbText');

const MAX_VISITOR_FOLLOWUPS_PER_INQUIRY = 50;

/** Lazy: place_reviews.hidden_at exists only after migration 013_place_reviews_hidden.sql */
let placeReviewMetaPromise = null;

function buildPlaceReviewStatsJoin(excludeHiddenReviews) {
  const hiddenFilter = excludeHiddenReviews ? '\n  WHERE hidden_at IS NULL' : '';
  return `
LEFT JOIN (
  SELECT place_id::varchar AS pr_place_id,
         AVG(rating::double precision) AS app_avg_rating,
         COUNT(*)::int AS app_review_count
  FROM place_reviews${hiddenFilter}
  GROUP BY place_id
) pr_stats ON pr_stats.pr_place_id = p.id`;
}

async function getPlaceReviewMeta() {
  if (!placeReviewMetaPromise) {
    placeReviewMetaPromise = (async () => {
      try {
        const { rows } = await query(
          `SELECT 1 AS ok FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'place_reviews' AND column_name = 'hidden_at'
           LIMIT 1`
        );
        const hasHiddenAt = rows.length > 0;
        return {
          hasHiddenAt,
          statsJoinSql: buildPlaceReviewStatsJoin(hasHiddenAt),
        };
      } catch {
        return { hasHiddenAt: false, statsJoinSql: buildPlaceReviewStatsJoin(false) };
      }
    })();
  }
  return placeReviewMetaPromise;
}

async function userIsAdmin(userId) {
  if (!userId) return false;
  const allowEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  try {
    const { rows } = await query(
      'SELECT email, COALESCE(is_admin, false) AS is_admin FROM users WHERE id = $1',
      [userId]
    );
    const row = rows[0];
    if (!row) return false;
    if (row.is_admin === true) return true;
    const email = (row.email || '').toLowerCase();
    return allowEmails.length > 0 && allowEmails.includes(email);
  } catch {
    return false;
  }
}

async function userManagesPlace(userId, placeId) {
  try {
    const { rows } = await query(
      'SELECT 1 FROM place_owners WHERE user_id = $1 AND place_id = $2',
      [userId, placeId]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

function isValidContactEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

function isPlausiblePhone(s) {
  const t = String(s || '').trim();
  if (t.length < 8 || t.length > 40) return false;
  const digits = (t.match(/\d/g) || []).length;
  return digits >= 8;
}

/** Fix malformed extension (e.g. xxxjpg -> xxx.jpg) from old upload bug */
function fixImageUrlExtension(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/([a-f0-9]{32})(jpe?g|png|gif|webp)$/i, '$1.$2');
}

function resolveImageUrls(images, baseUrl) {
  if (!Array.isArray(images)) return [];
  const base = (baseUrl || process.env.UPLOADS_BASE_URL || '').replace(/\/$/, '');
  return images.filter(Boolean).map((url) => {
    if (!url || typeof url !== 'string') return null;
    url = fixImageUrlExtension(url);
    if (url.startsWith('http')) return url;
    if (url.startsWith('/') && base) return base + url;
    return url;
  }).filter(Boolean);
}

function safeParseJson(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((x) => (typeof x === 'string' ? normalizeDbText(x) : x));
  }
  if (typeof tags === 'string') return normalizeDbText(tags);
  return tags;
}

function rowToPlace(row, baseUrl) {
  let images = safeParseJson(row.images, []);
  images = resolveImageUrls(images, baseUrl);
  const appN = row.app_review_count != null ? Number(row.app_review_count) : 0;
  const appAvg = row.app_avg_rating != null ? Number(row.app_avg_rating) : null;
  const useAppReviews = appN > 0 && appAvg != null && Number.isFinite(appAvg);
  const rating = useAppReviews ? appAvg : row.rating != null ? Number(row.rating) : null;
  const reviewCount = useAppReviews
    ? appN
    : row.review_count != null
      ? Number(row.review_count)
      : null;
  const result = {
    id: row.id,
    name: normalizeDbText(row.name),
    description: normalizeDbText(row.description || ''),
    location: normalizeDbText(row.location || ''),
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    images,
    category: normalizeDbText(row.category || ''),
    categoryId: row.category_id,
    duration: row.duration != null ? normalizeDbText(String(row.duration)) : row.duration,
    price: row.price != null ? normalizeDbText(String(row.price)) : row.price,
    bestTime: row.best_time != null ? normalizeDbText(String(row.best_time)) : row.best_time,
    rating: rating != null && Number.isFinite(rating) ? rating : null,
    reviewCount:
      reviewCount != null && Number.isFinite(reviewCount) ? Math.round(reviewCount) : null,
    hours: typeof row.hours === 'string' ? normalizeDbText(row.hours) : row.hours,
    tags: normalizeTags(row.tags),
    searchName: row.search_name != null ? normalizeDbText(String(row.search_name)) : row.search_name
  };
  if (row.latitude != null && row.longitude != null) result.coordinates = { lat: row.latitude, lng: row.longitude };
  if (images.length === 1) result.image = images[0];
  return result;
}

function getUploadsBaseUrl(req) {
  if (process.env.UPLOADS_BASE_URL) return process.env.UPLOADS_BASE_URL;
  const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:' + (process.env.PORT || 3000);
  return proto + '://' + host;
}

router.get('/', async (req, res) => {
  try {
    const baseUrl = getUploadsBaseUrl(req);
    const lang = getRequestLang(req);
    const { statsJoinSql } = await getPlaceReviewMeta();
    const result = await query(
      `SELECT p.id, p.latitude, p.longitude, p.images, p.rating, p.review_count, p.hours, p.search_name, p.category_id,
              pr_stats.app_avg_rating, pr_stats.app_review_count,
              COALESCE(pt.name, p.name) AS name, COALESCE(pt.description, p.description) AS description,
              COALESCE(pt.location, p.location) AS location, COALESCE(pt.category, p.category) AS category,
              COALESCE(pt.duration, p.duration) AS duration, COALESCE(pt.price, p.price) AS price,
              COALESCE(pt.best_time, p.best_time) AS best_time, COALESCE(pt.tags, p.tags) AS tags
       FROM places p
       LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $1
       ${statsJoinSql}
       ORDER BY p.name`,
      [lang]
    );
    const places = result.rows.map((r) => rowToPlace(r, baseUrl));
    res.json({ popular: places, locations: places });
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to fetch places');
  }
});

/** Public: active promotions + coupons for a place (UNION ALL, same filters as Discover). */
router.get('/:id/promotions', async (req, res) => {
  const rawId = req.params.id;
  const limit = 200;
  try {
    const { rows: placeRows } = await query('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;
    let rows;
    try {
      ({ rows } = await query(SQL_PLACE_PROMOTIONS, [placeId, limit]));
    } catch (err) {
      if (err.code !== '42P01') throw err;
      try {
        ({ rows } = await query(SQL_PLACE_PROMOTIONS_FALLBACK, [placeId, limit]));
      } catch (e2) {
        if (e2.code === '42P01') rows = [];
        else throw e2;
      }
    }
    const forDetail = rows.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      code: r.code,
      discountLabel: r.discountLabel,
      terms: r.terms,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
    }));
    res.json({ placeId, promotions: forDetail });
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to load promotions');
  }
});

function displayReviewAuthorName(name, email) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (n) return n;
  const e = typeof email === 'string' ? email.trim() : '';
  if (e && e.includes('@')) {
    const local = e.split('@')[0] || '';
    if (local) return local;
  }
  return 'Member';
}

/** Public: visitor reviews (optional JWT → isYours on each row). Hidden rows omitted. */
router.get('/:id/reviews', optionalAuthMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const viewerId = req.user?.userId || null;
  try {
    const { rows: placeRows } = await query('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;
    const { hasHiddenAt } = await getPlaceReviewMeta();
    const hiddenClause = hasHiddenAt ? 'AND r.hidden_at IS NULL' : '';
    let rows;
    try {
      ({ rows } = await query(
        `SELECT r.id, r.rating, r.title, r.review, r.created_at, r.user_id,
                u.name AS user_name,
                u.email AS user_email
         FROM place_reviews r
         INNER JOIN users u ON u.id = r.user_id
         WHERE r.place_id = $1 ${hiddenClause}
         ORDER BY r.created_at DESC
         LIMIT 80`,
        [placeId]
      ));
    } catch (err) {
      if (err.code === '42P01') return res.json({ placeId, reviews: [] });
      throw err;
    }
    const reviews = rows.map((r) => ({
      id: String(r.id),
      rating: r.rating,
      title: r.title || null,
      review: r.review || null,
      createdAt: r.created_at,
      authorName: displayReviewAuthorName(r.user_name, r.user_email),
      isYours: !!(viewerId && String(r.user_id) === String(viewerId)),
    }));
    res.json({ placeId, reviews });
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to load reviews');
  }
});

/** Logged-in user posts or updates their review for this place (one per user). */
router.post('/:id/reviews', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const userId = req.user.userId;
  const ratingRaw = req.body?.rating;
  const rating = parseInt(String(ratingRaw), 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }
  const title =
    typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 200) : '';
  let text = typeof req.body?.review === 'string' ? req.body.review.trim() : '';
  if (text.length > 8000) text = text.slice(0, 8000);
  if (text.length > 0 && text.length < 4) {
    return res.status(400).json({
      error: 'Review text must be at least 4 characters, or leave it empty to submit stars only.',
    });
  }

  try {
    const { rows: placeRows } = await query('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;
    const { hasHiddenAt } = await getPlaceReviewMeta();

    let existing;
    try {
      const sel = hasHiddenAt
        ? 'SELECT id, hidden_at FROM place_reviews WHERE place_id = $1 AND user_id = $2'
        : 'SELECT id FROM place_reviews WHERE place_id = $1 AND user_id = $2';
      ({ rows: existing } = await query(sel, [placeId, userId]));
    } catch (e) {
      if (e.code === '42703' && String(e.message || '').includes('hidden_at')) {
        ({ rows: existing } = await query(
          'SELECT id FROM place_reviews WHERE place_id = $1 AND user_id = $2',
          [placeId, userId]
        ));
      } else {
        throw e;
      }
    }
    const titleVal = title || null;
    const reviewVal = text || null;
    if (existing.length) {
      if (hasHiddenAt && existing[0].hidden_at != null) {
        const isAdm = await userIsAdmin(userId);
        if (!isAdm) {
          return res.status(403).json({
            error:
              'This review is hidden by the venue or an administrator. Remove it from your account or contact support.',
            code: 'REVIEW_HIDDEN',
          });
        }
      }
      await query(
        `UPDATE place_reviews
         SET rating = $1, title = $2, review = $3, created_at = now()
         WHERE id = $4`,
        [rating, titleVal, reviewVal, existing[0].id]
      );
    } else {
      await query(
        `INSERT INTO place_reviews (place_id, user_id, rating, title, review)
         VALUES ($1, $2, $3, $4, $5)`,
        [placeId, userId, rating, titleVal, reviewVal]
      );
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(503).json({
        error: 'Reviews are not available yet. Run server migrations for place_reviews.',
        code: 'REVIEWS_UNAVAILABLE',
      });
    }
    console.error(err);
    sendDbAwareError(res, err, 'Could not save review');
  }
});

/** Author, admin, or place owner: remove a review row. */
router.delete('/:id/reviews/:reviewId', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const reviewIdRaw = req.params.reviewId;
  const reviewId = parseInt(String(reviewIdRaw), 10);
  if (!Number.isFinite(reviewId)) return res.status(400).json({ error: 'Invalid review id' });
  const userId = req.user.userId;
  try {
    const { rows: placeRows } = await query('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;

    const { rows: revRows } = await query(
      'SELECT id, user_id, place_id FROM place_reviews WHERE id = $1',
      [reviewId]
    );
    if (!revRows.length) return res.status(404).json({ error: 'Review not found' });
    const rev = revRows[0];
    if (rev.place_id !== placeId) return res.status(404).json({ error: 'Review not found' });

    const isAuthor = String(rev.user_id) === String(userId);
    const isAdm = await userIsAdmin(userId);
    const owns = await userManagesPlace(userId, placeId);
    if (!isAuthor && !isAdm && !owns) {
      return res.status(403).json({ error: 'You cannot delete this review' });
    }

    await query('DELETE FROM place_reviews WHERE id = $1', [reviewId]);
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(503).json({
        error: 'Reviews are not available yet.',
        code: 'REVIEWS_UNAVAILABLE',
      });
    }
    console.error(err);
    return sendDbAwareError(res, err, 'Could not delete review');
  }
});

/** Admin or business owner for this place: hide (soft) or restore a review on the public page. */
router.patch('/:id/reviews/:reviewId', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const reviewIdRaw = req.params.reviewId;
  const reviewId = parseInt(String(reviewIdRaw), 10);
  if (!Number.isFinite(reviewId)) return res.status(400).json({ error: 'Invalid review id' });
  const hiddenRaw = req.body?.hidden;
  if (hiddenRaw !== true && hiddenRaw !== false) {
    return res.status(400).json({ error: 'JSON body must include hidden: true or false' });
  }
  const userId = req.user.userId;
  try {
    const { rows: placeRows } = await query('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;

    const { rows: revRows } = await query(
      'SELECT id, place_id FROM place_reviews WHERE id = $1',
      [reviewId]
    );
    if (!revRows.length) return res.status(404).json({ error: 'Review not found' });
    if (revRows[0].place_id !== placeId) return res.status(404).json({ error: 'Review not found' });

    const isAdm = await userIsAdmin(userId);
    const owns = await userManagesPlace(userId, placeId);
    if (!isAdm && !owns) {
      return res.status(403).json({
        error: 'Only an administrator or an owner of this place can hide or restore reviews.',
      });
    }

    const { hasHiddenAt } = await getPlaceReviewMeta();
    if (!hasHiddenAt) {
      return res.status(503).json({
        error:
          'Review moderation requires database migration server/migrations/013_place_reviews_hidden.sql (column hidden_at).',
        code: 'REVIEWS_HIDDEN_COLUMN_MISSING',
      });
    }

    if (hiddenRaw === true) {
      await query('UPDATE place_reviews SET hidden_at = now() WHERE id = $1', [reviewId]);
    } else {
      await query('UPDATE place_reviews SET hidden_at = NULL WHERE id = $1', [reviewId]);
    }
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(503).json({
        error: 'Reviews are not available yet.',
        code: 'REVIEWS_UNAVAILABLE',
      });
    }
    if (err.code === '42703' && String(err.message || '').includes('hidden_at')) {
      return res.status(503).json({
        error:
          'Review moderation requires database migration server/migrations/013_place_reviews_hidden.sql (column hidden_at).',
        code: 'REVIEWS_HIDDEN_COLUMN_MISSING',
      });
    }
    console.error(err);
    return sendDbAwareError(res, err, 'Could not update review');
  }
});

/** Max distance from venue (meters). Set to 0 in .env to skip proximity (dev only). Default 400 (typical app geofence). */
function checkinMaxDistanceMeters() {
  const raw = process.env.CHECKIN_MAX_DISTANCE_METERS;
  if (raw === '' || raw === undefined) return 400;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : 400;
}

/** Logged-in user checks in at a venue (once per UTC day). If the place has coordinates, requires client lat/lng within geofence (same idea as the mobile app). */
router.post('/:id/checkin', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const userId = req.user.userId;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : null;
  try {
    const { rows: placeRows } = await query(
      'SELECT id, latitude, longitude FROM places WHERE id = $1',
      [rawId]
    );
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeRow = placeRows[0];
    const placeId = placeRow.id;
    const plat = placeRow.latitude != null ? Number(placeRow.latitude) : null;
    const plng = placeRow.longitude != null ? Number(placeRow.longitude) : null;
    const hasPlaceCoords =
      plat != null && plng != null && Number.isFinite(plat) && Number.isFinite(plng);

    const maxM = checkinMaxDistanceMeters();
    if (hasPlaceCoords && maxM > 0) {
      const uLat = parseFloat(req.body?.latitude);
      const uLng = parseFloat(req.body?.longitude);
      if (!Number.isFinite(uLat) || !Number.isFinite(uLng)) {
        return res.status(400).json({
          error: 'Location is required to check in at this place.',
          code: 'LOCATION_REQUIRED',
        });
      }
      const dist = haversineMeters(uLat, uLng, plat, plng);
      if (dist > maxM) {
        return res.status(400).json({
          error: 'You are too far from this place to check in.',
          code: 'TOO_FAR',
          distanceMeters: Math.round(dist),
          maxMeters: maxM,
        });
      }
    }

    try {
      await query(
        'INSERT INTO place_checkins (place_id, user_id, note) VALUES ($1, $2, $3)',
        [placeId, userId, note]
      );
    } catch (e) {
      if (e.code === '23505') {
        return res.status(200).json({ ok: true, alreadyCheckedInToday: true, placeId });
      }
      throw e;
    }
    res.status(201).json({ ok: true, placeId });
  } catch (err) {
    if (err.code === '42P01') return res.status(503).json({ error: 'Check-in not available yet' });
    console.error(err);
    res.status(500).json({ error: 'Check-in failed' });
  }
});

/** Visitor message / offer proposal to the venue (email + mobile required for contact). */
router.post('/:id/inquiries', optionalAuthMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const messageRaw = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (messageRaw.length < 3) return res.status(400).json({ error: 'Message is too short' });
  if (messageRaw.length > 8000) return res.status(400).json({ error: 'Message is too long' });

  const intentRaw =
    typeof req.body?.intent === 'string' ? req.body.intent.trim().toLowerCase() : 'general';
  const intent = ['booking', 'event', 'general'].includes(intentRaw) ? intentRaw : 'general';
  const intentPrefixes = { booking: '[Booking] ', event: '[Private event] ', general: '' };
  const message = intentPrefixes[intent] + messageRaw;
  if (message.length > 8000) return res.status(400).json({ error: 'Message is too long' });

  const guestPhoneRaw = typeof req.body?.guestPhone === 'string' ? req.body.guestPhone.trim().slice(0, 40) : '';
  if (!isPlausiblePhone(guestPhoneRaw)) {
    return res.status(400).json({ error: 'Enter a valid mobile phone number' });
  }

  const userId = req.user?.userId || null;
  let guestName = null;
  let guestEmail = null;

  if (!userId) {
    guestName = typeof req.body?.guestName === 'string' ? req.body.guestName.trim().slice(0, 200) : '';
    guestEmail = typeof req.body?.guestEmail === 'string' ? req.body.guestEmail.trim().slice(0, 320).toLowerCase() : '';
    if (!guestName || !isValidContactEmail(guestEmail)) {
      return res.status(400).json({ error: 'Provide your name, email, and mobile number' });
    }
  } else {
    let guestEmailInput = typeof req.body?.guestEmail === 'string' ? req.body.guestEmail.trim().slice(0, 320).toLowerCase() : '';
    const nameFromBody = typeof req.body?.guestName === 'string' ? req.body.guestName.trim().slice(0, 200) : '';
    const { rows: urows } = await query('SELECT email, name FROM users WHERE id = $1', [userId]);
    const u = urows[0];
    guestEmail = guestEmailInput || (u?.email || '').trim().toLowerCase();
    if (!isValidContactEmail(guestEmail)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    guestName = nameFromBody || (u?.name ? String(u.name).trim().slice(0, 200) : null);
  }

  try {
    const { rows: placeRows } = await query('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;

    try {
      if (await isMessagingBlocked(placeId, userId, guestEmail)) {
        return res.status(403).json({
          error: 'This venue is not accepting messages from your account.',
          code: 'MESSAGING_BLOCKED',
        });
      }
    } catch (blockErr) {
      if (blockErr.code !== '42P01') throw blockErr;
    }

    let rows;
    try {
      ({ rows } = await query(
        `INSERT INTO place_inquiries (place_id, user_id, guest_name, guest_email, guest_phone, message)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [placeId, userId, guestName, guestEmail, guestPhoneRaw, message]
      ));
    } catch (insErr) {
      if (insErr.code === '42703' && String(insErr.message || '').includes('guest_phone')) {
        ({ rows } = await query(
          `INSERT INTO place_inquiries (place_id, user_id, guest_name, guest_email, message)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, created_at`,
          [placeId, userId, guestName, guestEmail, message]
        ));
      } else {
        throw insErr;
      }
    }
    res.status(201).json({
      ok: true,
      id: rows[0].id,
      createdAt: rows[0].created_at,
      message: 'Your message was sent. The venue can reply by email or phone.',
    });
  } catch (err) {
    if (err.code === '42P01') return res.status(503).json({ error: 'Inquiries not available yet' });
    console.error(err);
    res.status(500).json({ error: 'Could not send message' });
  }
});

/**
 * Visitor checks for a venue reply (same email as submitted, or same logged-in user).
 * GET /api/places/:id/inquiries/:inquiryId?email=  (guests must pass email query)
 */
router.get('/:id/inquiries/:inquiryId', optionalAuthMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const inquiryId = parseInt(String(req.params.inquiryId), 10);
  if (!Number.isInteger(inquiryId) || inquiryId < 1) {
    return res.status(400).json({ error: 'Invalid inquiry id' });
  }
  const emailQ =
    typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase().slice(0, 320) : '';

  try {
    const { rows: placeRows } = await query('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;

    let invRows;
    try {
      ({ rows: invRows } = await query(
        `SELECT id, user_id, guest_email, status, response, responded_at, created_at,
                COALESCE(visitor_followups, '[]'::jsonb) AS visitor_followups
         FROM place_inquiries WHERE id = $1 AND place_id = $2`,
        [inquiryId, placeId]
      ));
    } catch (selErr) {
      if (selErr.code === '42703' && String(selErr.message || '').includes('visitor_followups')) {
        ({ rows: invRows } = await query(
          `SELECT id, user_id, guest_email, status, response, responded_at, created_at
           FROM place_inquiries WHERE id = $1 AND place_id = $2`,
          [inquiryId, placeId]
        ));
      } else {
        throw selErr;
      }
    }
    if (!invRows.length) return res.status(404).json({ error: 'Inquiry not found' });
    const inv = invRows[0];

    const sessionUserId = req.user?.userId || null;
    const invEmail = inv.guest_email ? String(inv.guest_email).trim().toLowerCase() : '';

    let allowed = false;
    if (sessionUserId && inv.user_id && String(inv.user_id) === String(sessionUserId)) allowed = true;
    else if (emailQ && invEmail && emailQ === invEmail) allowed = true;

    if (!allowed) {
      return res.status(403).json({
        error: 'Use the same email you used for this message, or sign in with the same account.',
        code: 'INQUIRY_FORBIDDEN',
      });
    }

    res.json({
      ok: true,
      id: inv.id,
      status: inv.status,
      response: inv.response || null,
      respondedAt: inv.responded_at || null,
      createdAt: inv.created_at,
      visitorFollowups: visitorFollowupsFromDb(inv.visitor_followups),
    });
  } catch (err) {
    if (err.code === '42P01') return res.status(503).json({ error: 'Inquiries not available yet' });
    console.error(err);
    res.status(500).json({ error: 'Could not load inquiry' });
  }
});

/**
 * Visitor adds another message on the same inquiry (not allowed if venue archived the thread).
 * POST /api/places/:id/inquiries/:inquiryId/follow-up
 * Body: { message } — guests should also send { guestEmail } matching the inquiry.
 */
router.post('/:id/inquiries/:inquiryId/follow-up', optionalAuthMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const inquiryId = parseInt(String(req.params.inquiryId), 10);
  if (!Number.isInteger(inquiryId) || inquiryId < 1) {
    return res.status(400).json({ error: 'Invalid inquiry id' });
  }
  const text = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (text.length < 3) return res.status(400).json({ error: 'Message is too short' });
  if (text.length > 8000) return res.status(400).json({ error: 'Message is too long' });
  const emailBody =
    typeof req.body?.guestEmail === 'string' ? req.body.guestEmail.trim().toLowerCase().slice(0, 320) : '';

  try {
    const { rows: placeRows } = await query('SELECT id FROM places WHERE id = $1', [rawId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const placeId = placeRows[0].id;

    const { rows: invRows } = await query(
      `SELECT id, user_id, guest_email, status,
              COALESCE(visitor_followups, '[]'::jsonb) AS visitor_followups
       FROM place_inquiries WHERE id = $1 AND place_id = $2`,
      [inquiryId, placeId]
    );
    if (!invRows.length) return res.status(404).json({ error: 'Inquiry not found' });
    const inv = invRows[0];

    if (String(inv.status).toLowerCase() === 'archived') {
      return res.status(403).json({
        error: 'This conversation was archived by the venue. You cannot add more messages.',
        code: 'INQUIRY_ARCHIVED',
      });
    }

    const sessionUserId = req.user?.userId || null;
    const invEmail = inv.guest_email ? String(inv.guest_email).trim().toLowerCase() : '';
    let allowed = false;
    if (sessionUserId && inv.user_id && String(inv.user_id) === String(sessionUserId)) allowed = true;
    else if (emailBody && invEmail && emailBody === invEmail) allowed = true;

    if (!allowed) {
      return res.status(403).json({
        error: 'Use the same email you used for this message, or sign in with the same account.',
        code: 'INQUIRY_FORBIDDEN',
      });
    }

    try {
      if (await isMessagingBlocked(placeId, inv.user_id, inv.guest_email)) {
        return res.status(403).json({
          error: 'This venue is not accepting messages from your account.',
          code: 'MESSAGING_BLOCKED',
        });
      }
    } catch (blockErr) {
      if (blockErr.code !== '42P01') throw blockErr;
    }

    const existing = visitorFollowupsFromDb(inv.visitor_followups);
    if (existing.length >= MAX_VISITOR_FOLLOWUPS_PER_INQUIRY) {
      return res.status(400).json({ error: 'Too many follow-up messages in this thread' });
    }

    const entry = { body: text, createdAt: new Date().toISOString() };
    const patch = JSON.stringify([entry]);

    const { rows: upRows } = await query(
      `UPDATE place_inquiries
       SET visitor_followups = COALESCE(visitor_followups, '[]'::jsonb) || $1::jsonb,
           status = CASE WHEN LOWER(status) = 'answered' THEN 'open' ELSE status END
       WHERE id = $2 AND place_id = $3 AND LOWER(status) <> 'archived'
       RETURNING id, status, response, responded_at, created_at, visitor_followups`,
      [patch, inquiryId, placeId]
    );

    if (!upRows.length) {
      return res.status(403).json({
        error: 'This conversation was archived by the venue. You cannot add more messages.',
        code: 'INQUIRY_ARCHIVED',
      });
    }

    const row = upRows[0];
    res.json({
      ok: true,
      id: row.id,
      status: row.status,
      response: row.response || null,
      respondedAt: row.responded_at || null,
      createdAt: row.created_at,
      visitorFollowups: visitorFollowupsFromDb(row.visitor_followups),
    });
  } catch (err) {
    if (err.code === '42703' && String(err.message || '').includes('visitor_followups')) {
      return res.status(503).json({
        error:
          'Follow-up messages require a database update. Run server/migrations/009_place_inquiries_visitor_followups.sql',
      });
    }
    if (err.code === '42P01') return res.status(503).json({ error: 'Inquiries not available yet' });
    console.error(err);
    res.status(500).json({ error: 'Could not send follow-up message' });
  }
});

router.get('/:id', async (req, res) => {
  const rawId = req.params.id;
  const idResult = parsePositiveInt(rawId);
  const bySlug = !idResult.valid;
  if (bySlug && (typeof rawId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(rawId))) {
    return res.status(400).json({ error: 'Invalid place id' });
  }
  try {
    const baseUrl = getUploadsBaseUrl(req);
    const lang = getRequestLang(req);
    const { statsJoinSql } = await getPlaceReviewMeta();
    const slugNorm = rawId.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    let result = bySlug
      ? await query(
          `SELECT p.id, p.latitude, p.longitude, p.images, p.rating, p.review_count, p.hours, p.search_name, p.category_id,
                  pr_stats.app_avg_rating, pr_stats.app_review_count,
                  COALESCE(pt.name, p.name) AS name, COALESCE(pt.description, p.description) AS description,
                  COALESCE(pt.location, p.location) AS location, COALESCE(pt.category, p.category) AS category,
                  COALESCE(pt.duration, p.duration) AS duration, COALESCE(pt.price, p.price) AS price,
                  COALESCE(pt.best_time, p.best_time) AS best_time, COALESCE(pt.tags, p.tags) AS tags
           FROM places p
           LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $1
           ${statsJoinSql}
           WHERE p.id::text = $2
              OR p.search_name = $2
              OR LOWER(REPLACE(REPLACE(COALESCE(p.search_name, ''), ' ', '_'), '-', '_')) = $3
              OR LOWER(REPLACE(REPLACE(COALESCE(p.name, ''), ' ', '_'), '-', '_')) = $3`,
          [lang, rawId, slugNorm]
        )
      : await query(
          `SELECT p.id, p.latitude, p.longitude, p.images, p.rating, p.review_count, p.hours, p.search_name, p.category_id,
                  pr_stats.app_avg_rating, pr_stats.app_review_count,
                  COALESCE(pt.name, p.name) AS name, COALESCE(pt.description, p.description) AS description,
                  COALESCE(pt.location, p.location) AS location, COALESCE(pt.category, p.category) AS category,
                  COALESCE(pt.duration, p.duration) AS duration, COALESCE(pt.price, p.price) AS price,
                  COALESCE(pt.best_time, p.best_time) AS best_time, COALESCE(pt.tags, p.tags) AS tags
           FROM places p
           LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $1
           ${statsJoinSql}
           WHERE p.id = $2`,
          [lang, idResult.value]
        );
    if (result.rows.length === 0 && !bySlug) {
      result = await query(
        `SELECT p.id, p.latitude, p.longitude, p.images, p.rating, p.review_count, p.hours, p.search_name, p.category_id,
                pr_stats.app_avg_rating, pr_stats.app_review_count,
                COALESCE(pt.name, p.name) AS name, COALESCE(pt.description, p.description) AS description,
                COALESCE(pt.location, p.location) AS location, COALESCE(pt.category, p.category) AS category,
                COALESCE(pt.duration, p.duration) AS duration, COALESCE(pt.price, p.price) AS price,
                COALESCE(pt.best_time, p.best_time) AS best_time, COALESCE(pt.tags, p.tags) AS tags
         FROM places p
         LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $1
         ${statsJoinSql}
         WHERE p.id::text = $2`,
        [lang, rawId]
      );
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'Place not found' });
    res.json(rowToPlace(result.rows[0], baseUrl));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch place' });
  }
});

module.exports = router;
