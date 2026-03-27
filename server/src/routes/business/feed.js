const express = require('express');
const crypto = require('crypto');
const { query } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { parsePlaceId, safeUrl } = require('../../utils/validate');
const { feedImagesForStorage } = require('../../utils/feedImageUrls');

const router = express.Router();
router.use(authMiddleware, businessPortalMiddleware);

/** Resolve feed post id and ensure place is owned by this user. */
async function loadOwnedPost(userId, postId) {
  if (!postId || String(postId).length > 64) return null;
  const { rows } = await query(
    `SELECT fp.* FROM feed_posts fp
     INNER JOIN place_owners po ON po.place_id = fp.place_id AND po.user_id = $1
     WHERE fp.id = $2`,
    [userId, postId]
  );
  return rows[0] || null;
}

/**
 * GET /api/business/feed
 * Query: ?placeId= — optional filter to one owned place
 */
router.get('/', async (req, res) => {
  const userId = req.user.userId;
  const placeFilter = req.query.placeId ? parsePlaceId(req.query.placeId) : null;
  if (req.query.placeId && !placeFilter.valid) {
    return res.status(400).json({ error: 'Invalid place id' });
  }
  const format = String(req.query.format || 'all').toLowerCase();
  /** Video / reel = explicit type, or legacy video-only rows (no cover image). */
  const reelLikeSql = `(
    fp.type IN ('reel', 'video')
    OR (
      NULLIF(TRIM(COALESCE(fp.video_url, '')), '') IS NOT NULL
      AND NULLIF(TRIM(COALESCE(fp.image_url, '')), '') IS NULL
    )
  )`;
  const formatExtra =
    format === 'reel'
      ? ` AND ${reelLikeSql}`
      : format === 'post'
        ? ` AND NOT (${reelLikeSql})`
        : '';
  try {
    const params = [userId];
    let extra = '';
    if (placeFilter?.valid) {
      params.push(placeFilter.value);
      extra = ' AND fp.place_id = $2';
    }
    extra += formatExtra;
    const { rows } = await query(
      `SELECT fp.id, fp.user_id, fp.author_name, fp.place_id, fp.caption, fp.image_url, fp.image_urls, fp.video_url,
              fp.type, fp.created_at, fp.author_role,
              fp.moderation_status, fp.discoverable, fp.updated_at,
              COALESCE(fp.hide_likes, false) AS hide_likes,
              COALESCE(fp.comments_disabled, false) AS comments_disabled
       FROM feed_posts fp
       WHERE fp.place_id IN (SELECT place_id FROM place_owners WHERE user_id = $1)${extra}
       ORDER BY fp.created_at DESC
       LIMIT 200`,
      params
    );
    res.json({ posts: rows });
  } catch (err) {
    if (err.code === '42703') {
      return res.status(503).json({ error: 'Feed schema incomplete. Run migration 006_feed_moderation.sql' });
    }
    if (err.code === '42P01') return res.json({ posts: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to list posts' });
  }
});

/**
 * POST /api/business/feed
 * Body: { placeId, caption, image_url?, video_url?, type? } — type is `post`, `video`, or `reel` (reel alias → stored as video).
 * New posts: approved + discoverable so partner content can appear without admin bottleneck; admin can still moderate.
 */
router.post('/', async (req, res) => {
  const userId = req.user.userId;
  const pid = parsePlaceId(req.body?.placeId);
  if (!pid.valid) return res.status(400).json({ error: 'placeId is required' });
  const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim() : '';
  if (!caption || caption.length > 8000) {
    return res.status(400).json({ error: 'caption is required (max 8000 characters)' });
  }
  const { image_url: imageUrl, image_urls: imageUrlsArr } = feedImagesForStorage(req.body || {});
  const videoUrl = safeUrl(req.body?.video_url) || null;
  const rawType = typeof req.body?.type === 'string' ? req.body.type.trim().toLowerCase() : 'post';
  const type = rawType === 'reel' || rawType === 'video' ? 'video' : 'post';
  if (type === 'video' && !videoUrl) {
    return res.status(400).json({ error: 'Video posts require a valid video URL' });
  }

  try {
    const { rows: own } = await query(
      'SELECT 1 FROM place_owners WHERE user_id = $1 AND place_id = $2',
      [userId, pid.value]
    );
    if (!own.length) return res.status(403).json({ error: 'You do not manage this place' });

    const { rows: uRows } = await query('SELECT name, email FROM users WHERE id = $1', [userId]);
    const u = uRows[0];
    const authorName = (u?.name && String(u.name).trim()) || (u?.email && String(u.email).split('@')[0]) || 'Partner';
    const authorShort = authorName.slice(0, 255);

    const id = crypto.randomUUID();

    await query(
      `INSERT INTO feed_posts (
         id, user_id, author_name, place_id, caption, image_url, image_urls, video_url, type, author_role,
         moderation_status, discoverable
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, 'business_owner', 'approved', true)`,
      [
        id,
        userId,
        authorShort,
        pid.value,
        caption,
        imageUrl,
        imageUrlsArr ? JSON.stringify(imageUrlsArr) : null,
        videoUrl,
        type,
      ]
    );

    const { rows } = await query('SELECT * FROM feed_posts WHERE id = $1', [id]);
    res.status(201).json({ post: rows[0] });
  } catch (err) {
    if (err.code === '42703') {
      return res.status(503).json({ error: 'Run migration 006_feed_moderation.sql' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

/**
 * PATCH /api/business/feed/:id
 * Owners may edit content (not moderation_status or discoverable — admins control discovery).
 */
router.patch('/:id', async (req, res) => {
  const userId = req.user.userId;
  const existing = await loadOwnedPost(userId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });

  const body = req.body || {};
  const mergedType =
    body.type !== undefined
      ? ['reel', 'video'].includes(String(body.type).trim().toLowerCase())
        ? 'video'
        : 'post'
      : ['reel', 'video'].includes(String(existing.type || '').toLowerCase())
        ? 'video'
        : 'post';
  const mergedVideo =
    body.video_url !== undefined
      ? body.video_url
        ? safeUrl(body.video_url)
        : null
      : existing.video_url
        ? safeUrl(existing.video_url)
        : null;
  if (mergedType === 'video' && !mergedVideo) {
    return res.status(400).json({ error: 'Video posts require a valid video URL' });
  }

  const updates = [];
  const vals = [];
  let n = 1;

  if (body.caption !== undefined) {
    const cap = String(body.caption).trim();
    if (!cap || cap.length > 8000) return res.status(400).json({ error: 'Invalid caption' });
    updates.push(`caption = $${n++}`);
    vals.push(cap);
  }
  const hasImageUrls = Object.prototype.hasOwnProperty.call(body, 'image_urls');
  const hasImageUrl = Object.prototype.hasOwnProperty.call(body, 'image_url');
  if (hasImageUrls || hasImageUrl) {
    const { image_url: nextFirst, image_urls: nextList } = feedImagesForStorage({
      image_url: hasImageUrl ? body.image_url : undefined,
      image_urls: hasImageUrls ? body.image_urls : undefined,
    });
    updates.push(`image_url = $${n++}`);
    vals.push(nextFirst);
    updates.push(`image_urls = $${n++}::jsonb`);
    vals.push(nextList ? JSON.stringify(nextList) : null);
  }
  if (body.video_url !== undefined) {
    updates.push(`video_url = $${n++}`);
    vals.push(body.video_url ? safeUrl(body.video_url) : null);
  }
  if (body.type !== undefined) {
    const raw = String(body.type).trim().toLowerCase();
    const normalized = raw === 'reel' || raw === 'video' ? 'video' : 'post';
    updates.push(`type = $${n++}`);
    vals.push(normalized);
  }
  if (body.hide_likes !== undefined) {
    updates.push(`hide_likes = $${n++}`);
    vals.push(Boolean(body.hide_likes));
  }
  if (body.comments_disabled !== undefined) {
    updates.push(`comments_disabled = $${n++}`);
    vals.push(Boolean(body.comments_disabled));
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  updates.push(`updated_at = NOW()`);
  vals.push(req.params.id);

  try {
    const sql = `UPDATE feed_posts SET ${updates.join(', ')} WHERE id = $${n} RETURNING *`;
    const result = await query(sql, vals);
    res.json({ post: result.rows[0] });
  } catch (err) {
    if (err.code === '42703') return res.status(503).json({ error: 'Migration required for feed fields' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

/** DELETE /api/business/feed/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.user.userId;
  const existing = await loadOwnedPost(userId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });

  const id = req.params.id;
  try {
    await query('DELETE FROM feed_comments WHERE post_id = $1', [id]);
    await query('DELETE FROM feed_likes WHERE post_id = $1', [id]);
    await query('DELETE FROM feed_saves WHERE post_id = $1', [id]);
    const result = await query('DELETE FROM feed_posts WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '42P01') return res.status(404).json({ error: 'Feed not available' });
    console.error(err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
