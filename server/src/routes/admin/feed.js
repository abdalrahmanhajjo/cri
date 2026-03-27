const express = require('express');
const crypto = require('crypto');
const { query: dbQuery } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { parsePlaceId, safeUrl } = require('../../utils/validate');
const { feedImagesForStorage } = require('../../utils/feedImageUrls');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

const MODERATION = new Set(['pending', 'approved', 'rejected']);

function buildListWhere(status, discoverable, q, format) {
  const parts = [];
  const params = [];
  let i = 1;

  if (status && status !== 'all') {
    parts.push(`fp.moderation_status = $${i++}`);
    params.push(status);
  }
  if (discoverable === 'true') {
    parts.push('fp.discoverable = true');
  } else if (discoverable === 'false') {
    parts.push('fp.discoverable = false');
  }
  const reelLikeSql = `(
    fp.type IN ('reel', 'video')
    OR (
      NULLIF(TRIM(COALESCE(fp.video_url, '')), '') IS NOT NULL
      AND NULLIF(TRIM(COALESCE(fp.image_url, '')), '') IS NULL
    )
  )`;
  if (format === 'reel') {
    parts.push(reelLikeSql);
  } else if (format === 'post') {
    parts.push(`NOT (${reelLikeSql})`);
  }
  if (q && q.trim()) {
    const like = `%${q.trim().slice(0, 120)}%`;
    parts.push(
      `(fp.caption ILIKE $${i} OR fp.author_name ILIKE $${i} OR fp.place_id ILIKE $${i} OR u.email ILIKE $${i})`
    );
    params.push(like);
    i++;
  }

  const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
  return { where, params };
}

/** GET /api/admin/feed */
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const status = req.query.status || 'all';
  const discoverable = req.query.discoverable;
  const q = req.query.q || '';
  const format = String(req.query.format || 'all').toLowerCase();
  const formatKey = format === 'reel' || format === 'post' ? format : 'all';

  const { where, params } = buildListWhere(status, discoverable, q, formatKey === 'all' ? null : formatKey);
  const allParams = [...params, limit, offset];

  try {
    const { rows } = await dbQuery(
      `SELECT fp.id, fp.user_id, fp.author_name, fp.place_id, fp.caption, fp.image_url, fp.image_urls, fp.video_url,
              fp.type, fp.created_at, fp.author_role, fp.moderation_status, fp.discoverable, fp.admin_notes, fp.updated_at,
              u.email AS user_email,
              (SELECT COUNT(*)::int FROM feed_likes fl WHERE fl.post_id = fp.id) AS likes_count,
              (SELECT COUNT(*)::int FROM feed_comments fc WHERE fc.post_id = fp.id) AS comments_count
       FROM feed_posts fp
       LEFT JOIN users u ON u.id = fp.user_id
       ${where}
       ORDER BY fp.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      allParams
    );

    let pendingCount = 0;
    try {
      const pc = await dbQuery(
        'SELECT COUNT(*)::int AS n FROM feed_posts WHERE moderation_status = \'pending\''
      );
      pendingCount = pc.rows[0]?.n ?? 0;
    } catch (_) {
      /* column missing until migration */
    }

    res.json({ posts: rows, pendingCount });
  } catch (err) {
    if (err.code === '42703') {
      return res.status(503).json({
        error: 'Feed schema outdated. Run server/migrations/006_feed_moderation.sql',
        code: 'MIGRATION_REQUIRED',
      });
    }
    if (err.code === '42P01') return res.json({ posts: [], pendingCount: 0 });
    console.error(err);
    res.status(500).json({ error: 'Failed to list feed posts' });
  }
});

/**
 * POST /api/admin/feed
 * Create a feed post or reel for any place (admin).
 * Body: { placeId, caption, image_url?, video_url?, type? ('post' | 'video' | 'reel'),
 *         moderation_status?, discoverable? }
 */
router.post('/', async (req, res) => {
  const userId = req.user.userId;
  const pid = parsePlaceId(req.body?.placeId);
  if (!pid.valid) return res.status(400).json({ error: 'placeId is required' });

  const body = req.body || {};
  const caption = typeof body.caption === 'string' ? body.caption.trim() : '';
  if (!caption || caption.length > 8000) {
    return res.status(400).json({ error: 'caption is required (max 8000 characters)' });
  }
  const { image_url: imageUrl, image_urls: imageUrlsArr } = feedImagesForStorage(body);
  const videoUrl = safeUrl(body.video_url) || null;
  const rawType = typeof body.type === 'string' ? body.type.trim().toLowerCase() : 'post';
  const type = rawType === 'reel' || rawType === 'video' ? 'video' : 'post';
  if (type === 'video' && !videoUrl) {
    return res.status(400).json({ error: 'Video posts require a valid video URL' });
  }

  let moderation_status = 'approved';
  if (body.moderation_status !== undefined) {
    const s = String(body.moderation_status);
    if (!MODERATION.has(s)) return res.status(400).json({ error: 'Invalid moderation_status' });
    moderation_status = s;
  }
  let discoverable = true;
  if (body.discoverable !== undefined) discoverable = Boolean(body.discoverable);

  try {
    const { rows: placeRows } = await dbQuery('SELECT id FROM places WHERE id = $1 LIMIT 1', [pid.value]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });

    const { rows: uRows } = await dbQuery('SELECT name, email FROM users WHERE id = $1', [userId]);
    const u = uRows[0];
    const authorName = (u?.name && String(u.name).trim()) || (u?.email && String(u.email).split('@')[0]) || 'Admin';
    const authorShort = authorName.slice(0, 255);

    const id = crypto.randomUUID();

    await dbQuery(
      `INSERT INTO feed_posts (
         id, user_id, author_name, place_id, caption, image_url, image_urls, video_url, type, author_role,
         moderation_status, discoverable
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, 'admin', $10, $11)`,
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
        moderation_status,
        discoverable,
      ]
    );

    const { rows } = await dbQuery('SELECT * FROM feed_posts WHERE id = $1', [id]);
    res.status(201).json({ post: rows[0] });
  } catch (err) {
    if (err.code === '42703') {
      return res.status(503).json({ error: 'Run migration 006_feed_moderation.sql' });
    }
    if (err.code === '42P01') return res.status(503).json({ error: 'Feed not available' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

/** GET /api/admin/feed/:id/comments — list comments for a post */
router.get('/:id/comments', async (req, res) => {
  const postId = req.params.id;
  if (!postId || postId.length > 64) return res.status(400).json({ error: 'Invalid post id' });
  try {
    const { rows } = await dbQuery(
      `SELECT fc.id, fc.post_id, fc.user_id, fc.author_name, fc.body, fc.created_at, u.email AS user_email
       FROM feed_comments fc
       LEFT JOIN users u ON u.id = fc.user_id
       WHERE fc.post_id = $1
       ORDER BY fc.created_at ASC`,
      [postId]
    );
    res.json({ comments: rows });
  } catch (err) {
    if (err.code === '42P01') return res.json({ comments: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

/** DELETE /api/admin/feed/comments/:commentId */
router.delete('/comments/:commentId', async (req, res) => {
  const commentId = req.params.commentId;
  if (!commentId || commentId.length > 64) return res.status(400).json({ error: 'Invalid comment id' });
  try {
    const result = await dbQuery('DELETE FROM feed_comments WHERE id = $1', [commentId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Comment not found' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '42P01') return res.status(404).json({ error: 'Comments not available' });
    console.error(err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

/** PATCH /api/admin/feed/:id — moderate / edit */
router.patch('/:id', async (req, res) => {
  const id = req.params.id;
  if (!id || id.length > 64) return res.status(400).json({ error: 'Invalid post id' });

  const body = req.body || {};
  const updates = [];
  const vals = [];
  let n = 1;

  if (body.moderation_status !== undefined) {
    const s = String(body.moderation_status);
    if (!MODERATION.has(s)) return res.status(400).json({ error: 'Invalid moderation_status' });
    updates.push(`moderation_status = $${n++}`);
    vals.push(s);
  }
  if (body.discoverable !== undefined) {
    updates.push(`discoverable = $${n++}`);
    vals.push(Boolean(body.discoverable));
  }
  if (body.caption !== undefined) {
    const cap = String(body.caption).slice(0, 8000);
    updates.push(`caption = $${n++}`);
    vals.push(cap);
  }
  if (body.type !== undefined) {
    const t = String(body.type).slice(0, 40);
    updates.push(`type = $${n++}`);
    vals.push(t);
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
    vals.push(body.video_url ? String(body.video_url).slice(0, 500) : null);
  }
  if (body.admin_notes !== undefined) {
    updates.push(`admin_notes = $${n++}`);
    vals.push(body.admin_notes ? String(body.admin_notes).slice(0, 4000) : null);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  updates.push('updated_at = NOW()');
  vals.push(id);

  try {
    const sql = `UPDATE feed_posts SET ${updates.join(', ')} WHERE id = $${n} RETURNING *`;
    const result = await dbQuery(sql, vals);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: result.rows[0] });
  } catch (err) {
    if (err.code === '42703') {
      return res.status(503).json({ error: 'Run migration 006_feed_moderation.sql for moderation fields.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

/** GET /api/admin/feed/:id — single post */
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  if (!id || id.length > 64) return res.status(400).json({ error: 'Invalid post id' });
  try {
    const { rows } = await dbQuery(
      `SELECT fp.*, u.email AS user_email,
              (SELECT COUNT(*)::int FROM feed_likes fl WHERE fl.post_id = fp.id) AS likes_count,
              (SELECT COUNT(*)::int FROM feed_comments fc WHERE fc.post_id = fp.id) AS comments_count
       FROM feed_posts fp
       LEFT JOIN users u ON u.id = fp.user_id
       WHERE fp.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: rows[0] });
  } catch (err) {
    if (err.code === '42P01') return res.status(404).json({ error: 'Feed not available' });
    console.error(err);
    res.status(500).json({ error: 'Failed to load post' });
  }
});

/** DELETE /api/admin/feed/:id */
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  if (!id || id.length > 64) return res.status(400).json({ error: 'Invalid post id' });
  try {
    await dbQuery('DELETE FROM feed_comments WHERE post_id = $1', [id]);
    await dbQuery('DELETE FROM feed_likes WHERE post_id = $1', [id]);
    await dbQuery('DELETE FROM feed_saves WHERE post_id = $1', [id]);
    const result = await dbQuery('DELETE FROM feed_posts WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '42P01') return res.status(404).json({ error: 'Feed not available' });
    console.error(err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
