const express = require('express');
const { pool, query: dbQuery } = require('../db');
const { sendDbAwareError } = require('../utils/dbHttpError');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');

/** When migration 009 is not applied yet, parent_id / likes columns may be missing. */
function isMissingSocialColumn(err) {
  return err && (err.code === '42703' || err.code === '42P01');
}

const router = express.Router();

/** Concurrent toggles can race two INSERTs; second hits unique_violation (23505) — row already in desired state. */
async function insertFeedLikeOrConcurrent(client, postId, userId) {
  try {
    await client.query('INSERT INTO feed_likes (post_id, user_id) VALUES ($1::uuid, $2::uuid)', [postId, userId]);
  } catch (e) {
    if (e.code === '23505') return;
    throw e;
  }
}

async function insertCommentLikeOrConcurrent(client, commentId, userId) {
  try {
    await client.query(
      'INSERT INTO feed_comment_likes (comment_id, user_id) VALUES ($1::uuid, $2::uuid)',
      [commentId, userId]
    );
  } catch (e) {
    if (e.code === '23505') return;
    throw e;
  }
}

/**
 * Normalize route/JWT ids to lowercase `8-4-4-4-12` hex (PostgreSQL uuid).
 * Uses a permissive pattern so we do not reject valid DB UUIDs (strict RFC variant checks can fail incorrectly).
 */
function normalizeUuidParam(s) {
  if (s == null || typeof s !== 'string') return null;
  const t = s.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return null;
  return t.toLowerCase();
}

/** JWT user id as UUID string (same rules as path params). */
function userIdFromReq(req) {
  const raw = req.user?.userId;
  if (raw == null) return null;
  return normalizeUuidParam(String(raw));
}

/** `feed_posts.place_id` matches `places.id` (varchar). */
function normalizeFeedPlaceId(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.length > 255) return null;
  return t;
}

/**
 * Public-visible post row for actions (likes, comments). Includes social flags when columns exist.
 * @returns {Promise<{ id: string, hide_likes?: boolean, comments_disabled?: boolean } | null>}
 */
async function getPublicPostRow(postId) {
  try {
    const { rows } = await dbQuery(
      `SELECT fp.id,
              COALESCE(fp.hide_likes, false) AS hide_likes,
              COALESCE(fp.comments_disabled, false) AS comments_disabled
       FROM feed_posts fp
       WHERE fp.id = $1 AND fp.moderation_status = 'approved' AND fp.discoverable = true`,
      [postId]
    );
    return rows[0] || null;
  } catch (err) {
    if (err.code === '42703') {
      try {
        const { rows } = await dbQuery(
          `SELECT id FROM feed_posts fp
           WHERE fp.id = $1 AND fp.moderation_status = 'approved' AND fp.discoverable = true`,
          [postId]
        );
        if (!rows[0]) return null;
        return { id: rows[0].id, hide_likes: false, comments_disabled: false };
      } catch {
        const { rows } = await dbQuery('SELECT id FROM feed_posts WHERE id = $1', [postId]);
        if (!rows[0]) return null;
        return { id: rows[0].id, hide_likes: false, comments_disabled: false };
      }
    }
    throw err;
  }
}

/**
 * GET /api/feed — public community feed (app + web).
 * With Bearer token: includes liked_by_me, saved_by_me for the current user.
 */
router.get('/', optionalAuthMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const format = String(req.query.format || 'all').toLowerCase();
  const sort = String(req.query.sort || 'recent').toLowerCase();
  const placeIdFilter = normalizeFeedPlaceId(req.query.placeId);
  const formatSql =
    format === 'reel' || format === 'video'
      ? ' AND (fp.type = \'reel\' OR fp.type = \'video\')'
      : format === 'post'
        ? ' AND (fp.type IS NULL OR (fp.type <> \'reel\' AND fp.type <> \'video\'))'
        : '';
  /** Instagram-style: engagement (log-scaled) weighted by recency (days since post). */
  const orderSql = (() => {
    if (sort === 'popular' || sort === 'engagement') {
      return `ORDER BY (
           (SELECT COUNT(*)::int FROM feed_likes fl WHERE fl.post_id = fp.id) +
           (SELECT COUNT(*)::int FROM feed_comments fc WHERE fc.post_id = fp.id)
         ) DESC,
         fp.created_at DESC`;
    }
    if (sort === 'smart' || sort === 'for_you') {
      return `ORDER BY (
         (LN(1 + COALESCE((SELECT COUNT(*)::float FROM feed_likes fl WHERE fl.post_id = fp.id), 0)) +
          LN(1 + COALESCE((SELECT COUNT(*)::float FROM feed_comments fc WHERE fc.post_id = fp.id), 0)))
         / NULLIF(1.0 + GREATEST(0, EXTRACT(EPOCH FROM (NOW() - fp.created_at)) / 86400.0), 0)
       ) DESC NULLS LAST,
       fp.created_at DESC,
       fp.id DESC`;
    }
    return 'ORDER BY fp.created_at DESC';
  })();
  const userId = userIdFromReq(req);

  try {
    const params = [limit, offset];
    let userParamIdx = null;
    let placeParamIdx = null;
    if (userId) {
      userParamIdx = params.length + 1;
      params.push(userId);
    }
    if (placeIdFilter) {
      placeParamIdx = params.length + 1;
      params.push(placeIdFilter);
    }

    const userSql = userParamIdx
      ? `, EXISTS (SELECT 1 FROM feed_likes fl WHERE fl.post_id = fp.id AND fl.user_id = $${userParamIdx}::uuid) AS liked_by_me,
         EXISTS (SELECT 1 FROM feed_saves fs WHERE fs.post_id = fp.id AND fs.user_id = $${userParamIdx}::uuid) AS saved_by_me`
      : ', false AS liked_by_me, false AS saved_by_me';

    const manageSql = userParamIdx
      ? `, (fp.place_id IS NOT NULL AND EXISTS (SELECT 1 FROM place_owners po WHERE po.place_id = fp.place_id AND po.user_id = $${userParamIdx}::uuid)) AS i_manage_post`
      : ', false AS i_manage_post';
    const socialSql = `, COALESCE(fp.hide_likes, false) AS hide_likes,
              COALESCE(fp.comments_disabled, false) AS comments_disabled`;

    const placeSql = placeParamIdx ? ` AND fp.place_id = $${placeParamIdx}` : '';

    const { rows } = await dbQuery(
      `SELECT fp.id, fp.user_id, fp.author_name, fp.place_id, fp.caption, fp.image_url, fp.image_urls, fp.video_url,
              fp.type, fp.created_at, fp.author_role,
              (SELECT COUNT(*)::int FROM feed_likes fl WHERE fl.post_id = fp.id) AS likes_count,
              (SELECT COUNT(*)::int FROM feed_comments fc WHERE fc.post_id = fp.id) AS comments_count,
              (SELECT CASE
                 WHEN p.images IS NOT NULL AND jsonb_typeof(p.images) = 'array' AND jsonb_array_length(p.images) > 0
                 THEN p.images #>> '{0}'
                 ELSE NULL
               END
               FROM places p WHERE p.id = fp.place_id LIMIT 1) AS place_image_url,
              (SELECT p.name FROM places p WHERE p.id = fp.place_id LIMIT 1) AS place_name
              ${socialSql}
              ${manageSql}
              ${userSql}
       FROM feed_posts fp
       WHERE fp.moderation_status = 'approved' AND fp.discoverable = true${formatSql}${placeSql}
       ${orderSql}
       LIMIT $1 OFFSET $2`,
      params
    );
    res.json({ posts: rows, hasMore: rows.length === limit, offset, limit });
  } catch (err) {
    if (err.code === '42703' || err.code === '42P01') {
      try {
        const legParams = [limit, offset];
        let legPlaceIdx = null;
        if (placeIdFilter) {
          legPlaceIdx = legParams.length + 1;
          legParams.push(placeIdFilter);
        }
        const legWhere = legPlaceIdx ? ` WHERE fp.place_id = $${legPlaceIdx}` : '';
        const { rows } = await dbQuery(
          `SELECT fp.id, fp.user_id, fp.author_name, fp.place_id, fp.caption, fp.image_url, fp.video_url,
                  fp.type, fp.created_at, fp.author_role,
                  (SELECT p.name FROM places p WHERE p.id = fp.place_id LIMIT 1) AS place_name
           FROM feed_posts fp${legWhere}
           ORDER BY fp.created_at DESC
           LIMIT $1 OFFSET $2`,
          legParams
        );
        return res.json({
          posts: rows,
          hasMore: rows.length === limit,
          offset,
          limit,
          _warning: 'Run migration 006_feed_moderation.sql for moderation filters.',
        });
      } catch (e2) {
        if (e2.code === '42P01') return res.json({ posts: [] });
        throw e2;
      }
    }
    console.error(err);
    sendDbAwareError(res, err, 'Failed to load feed');
  }
});

/** GET /api/feed/post/:postId — public single post/reel for deep links */
router.get('/post/:postId', optionalAuthMiddleware, async (req, res) => {
  const postId = normalizeUuidParam(req.params.postId);
  if (!postId) return res.status(400).json({ error: 'Invalid post id' });
  const userId = userIdFromReq(req);
  try {
    const params = [postId];
    const userParamIdx = userId ? 2 : null;
    if (userId) params.push(userId);
    const userSql = userParamIdx
      ? `, EXISTS (SELECT 1 FROM feed_likes fl WHERE fl.post_id = fp.id AND fl.user_id = $${userParamIdx}::uuid) AS liked_by_me,
         EXISTS (SELECT 1 FROM feed_saves fs WHERE fs.post_id = fp.id AND fs.user_id = $${userParamIdx}::uuid) AS saved_by_me`
      : ', false AS liked_by_me, false AS saved_by_me';
    const manageSql = userParamIdx
      ? `, (fp.place_id IS NOT NULL AND EXISTS (SELECT 1 FROM place_owners po WHERE po.place_id = fp.place_id AND po.user_id = $${userParamIdx}::uuid)) AS i_manage_post`
      : ', false AS i_manage_post';
    const socialSql = `, COALESCE(fp.hide_likes, false) AS hide_likes,
              COALESCE(fp.comments_disabled, false) AS comments_disabled`;
    const { rows } = await dbQuery(
      `SELECT fp.id, fp.user_id, fp.author_name, fp.place_id, fp.caption, fp.image_url, fp.image_urls, fp.video_url,
              fp.type, fp.created_at, fp.author_role,
              (SELECT COUNT(*)::int FROM feed_likes fl WHERE fl.post_id = fp.id) AS likes_count,
              (SELECT COUNT(*)::int FROM feed_comments fc WHERE fc.post_id = fp.id) AS comments_count,
              (SELECT CASE
                 WHEN p.images IS NOT NULL AND jsonb_typeof(p.images) = 'array' AND jsonb_array_length(p.images) > 0
                 THEN p.images #>> '{0}'
                 ELSE NULL
               END
               FROM places p WHERE p.id = fp.place_id LIMIT 1) AS place_image_url,
              (SELECT p.name FROM places p WHERE p.id = fp.place_id LIMIT 1) AS place_name
              ${socialSql}
              ${manageSql}
              ${userSql}
       FROM feed_posts fp
       WHERE fp.id = $1 AND fp.moderation_status = 'approved' AND fp.discoverable = true
       LIMIT 1`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
    return res.json({ post: rows[0] });
  } catch (err) {
    console.error(err);
    return sendDbAwareError(res, err, 'Failed to load post');
  }
});

/** GET /api/feed/post/:postId/comments — public; optional auth adds liked_by_me on each row */
router.get('/post/:postId/comments', optionalAuthMiddleware, async (req, res) => {
  const postId = normalizeUuidParam(req.params.postId);
  if (!postId) return res.status(400).json({ error: 'Invalid post id' });
  const post = await getPublicPostRow(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.comments_disabled === true) {
    return res.json({ comments: [] });
  }
  const userId = userIdFromReq(req);
  try {
    const sql = userId
      ? `SELECT fc.id, fc.author_name, fc.body, fc.created_at, fc.user_id, fc.parent_id, fc.updated_at,
           (SELECT COUNT(*)::int FROM feed_comment_likes fcl WHERE fcl.comment_id = fc.id) AS likes_count,
           EXISTS (SELECT 1 FROM feed_comment_likes fcl WHERE fcl.comment_id = fc.id AND fcl.user_id = $2::uuid) AS liked_by_me
         FROM feed_comments fc
         WHERE fc.post_id = $1
         ORDER BY fc.created_at ASC
         LIMIT 200`
      : `SELECT fc.id, fc.author_name, fc.body, fc.created_at, fc.user_id, fc.parent_id, fc.updated_at,
           (SELECT COUNT(*)::int FROM feed_comment_likes fcl WHERE fcl.comment_id = fc.id) AS likes_count,
           false AS liked_by_me
         FROM feed_comments fc
         WHERE fc.post_id = $1
         ORDER BY fc.created_at ASC
         LIMIT 200`;
    const params = userId ? [postId, userId] : [postId];
    const { rows } = await dbQuery(sql, params);
    const comments = rows.map((r) => ({
      id: r.id,
      authorName: r.author_name,
      body: r.body,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      userId: r.user_id,
      parentId: r.parent_id || null,
      likesCount: Number(r.likes_count) || 0,
      likedByMe: r.liked_by_me === true,
    }));
    res.json({ comments });
  } catch (err) {
    if (isMissingSocialColumn(err)) {
      try {
        const { rows } = await dbQuery(
          `SELECT fc.id, fc.author_name, fc.body, fc.created_at, fc.user_id
           FROM feed_comments fc
           WHERE fc.post_id = $1
           ORDER BY fc.created_at ASC
           LIMIT 200`,
          [postId]
        );
        const comments = rows.map((r) => ({
          id: r.id,
          authorName: r.author_name,
          body: r.body,
          createdAt: r.created_at,
          userId: r.user_id,
          parentId: null,
          likesCount: 0,
          likedByMe: false,
        }));
        return res.json({ comments });
      } catch (e2) {
        if (e2.code === '42P01') return res.json({ comments: [] });
        throw e2;
      }
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

/**
 * POST /api/feed/post/:postId/comments/:commentId/like — toggle like on comment (auth).
 * Persists to `feed_comment_likes` (INSERT / DELETE) in one DB transaction.
 */
router.post('/post/:postId/comments/:commentId/like', authMiddleware, async (req, res) => {
  const postId = normalizeUuidParam(req.params.postId);
  const commentId = normalizeUuidParam(req.params.commentId);
  if (!postId || !commentId) return res.status(400).json({ error: 'Invalid id' });
  const post = await getPublicPostRow(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.comments_disabled === true) {
    return res.status(403).json({ error: 'Comments are turned off for this post', code: 'COMMENTS_DISABLED' });
  }
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Invalid token payload' });
  try {
    const { rows: crow } = await dbQuery('SELECT id FROM feed_comments WHERE id = $1::uuid AND post_id = $2::uuid', [
      commentId,
      postId,
    ]);
    if (!crow.length) return res.status(404).json({ error: 'Comment not found' });

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const existing = await client.query(
        'SELECT 1 FROM feed_comment_likes WHERE comment_id = $1::uuid AND user_id = $2::uuid',
        [commentId, userId]
      );
      if (existing.rows.length) {
        await client.query('DELETE FROM feed_comment_likes WHERE comment_id = $1::uuid AND user_id = $2::uuid', [
          commentId,
          userId,
        ]);
      } else {
        await insertCommentLikeOrConcurrent(client, commentId, userId);
      }
      const { rows: cnt } = await client.query('SELECT COUNT(*)::int AS c FROM feed_comment_likes WHERE comment_id = $1::uuid', [
        commentId,
      ]);
      const liked = await client.query(
        'SELECT 1 FROM feed_comment_likes WHERE comment_id = $1::uuid AND user_id = $2::uuid',
        [commentId, userId]
      );
      await client.query('COMMIT');
      res.json({ liked: liked.rows.length > 0, likes_count: Number(cnt[0]?.c) || 0 });
    } catch (e) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {}
      }
      throw e;
    } finally {
      if (client) client.release();
    }
  } catch (err) {
    console.error(err);
    if (err.code === '42P01') return res.status(503).json({ error: 'Comment likes not available' });
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Could not save comment like (invalid user or comment).' });
    }
    res.status(500).json({ error: 'Failed to update comment like' });
  }
});

/** PATCH /api/feed/post/:postId/comments/:commentId — edit own comment */
router.patch('/post/:postId/comments/:commentId', authMiddleware, async (req, res) => {
  const postId = normalizeUuidParam(req.params.postId);
  const commentId = normalizeUuidParam(req.params.commentId);
  if (!postId || !commentId) return res.status(400).json({ error: 'Invalid id' });
  const post = await getPublicPostRow(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.comments_disabled === true) {
    return res.status(403).json({ error: 'Comments are turned off for this post', code: 'COMMENTS_DISABLED' });
  }
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 2000) {
    return res.status(400).json({ error: 'Comment must be 1–2000 characters' });
  }
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Invalid token payload' });
  try {
    const { rows } = await dbQuery(
      `UPDATE feed_comments SET body = $1, updated_at = NOW()
       WHERE id = $2 AND post_id = $3 AND user_id = $4
       RETURNING id, author_name, body, created_at, updated_at, user_id, parent_id`,
      [body, commentId, postId, userId]
    );
    if (!rows.length) return res.status(403).json({ error: 'Cannot edit this comment' });
    const c = rows[0];
    res.json({
      comment: {
        id: c.id,
        authorName: c.author_name,
        body: c.body,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        userId: c.user_id,
        parentId: c.parent_id || null,
      },
    });
  } catch (err) {
    console.error(err);
    if (err.code === '42703') return res.status(503).json({ error: 'Edit not available — run migration 009' });
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

/** DELETE /api/feed/post/:postId/comments/:commentId — delete own comment (replies cascade) */
router.delete('/post/:postId/comments/:commentId', authMiddleware, async (req, res) => {
  const postId = normalizeUuidParam(req.params.postId);
  const commentId = normalizeUuidParam(req.params.commentId);
  if (!postId || !commentId) return res.status(400).json({ error: 'Invalid id' });
  const post = await getPublicPostRow(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.comments_disabled === true) {
    return res.status(403).json({ error: 'Comments are turned off for this post', code: 'COMMENTS_DISABLED' });
  }
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Invalid token payload' });
  try {
    const { rowCount } = await dbQuery('DELETE FROM feed_comments WHERE id = $1 AND post_id = $2 AND user_id = $3', [
      commentId,
      postId,
      userId,
    ]);
    if (!rowCount) return res.status(403).json({ error: 'Cannot delete this comment' });
    const { rows: cnt } = await dbQuery('SELECT COUNT(*)::int AS c FROM feed_comments WHERE post_id = $1', [postId]);
    res.json({ deleted: true, comments_count: Number(cnt[0]?.c) || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

/** POST /api/feed/post/:postId/comments — auth; optional parentId for reply (one level deep) */
router.post('/post/:postId/comments', authMiddleware, async (req, res) => {
  const postId = normalizeUuidParam(req.params.postId);
  if (!postId) return res.status(400).json({ error: 'Invalid post id' });
  const post = await getPublicPostRow(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.comments_disabled === true) {
    return res.status(403).json({ error: 'Comments are turned off for this post', code: 'COMMENTS_DISABLED' });
  }

  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 2000) {
    return res.status(400).json({ error: 'Comment must be 1–2000 characters' });
  }

  const rawParent = req.body?.parentId;
  let parentId = null;
  if (rawParent != null && String(rawParent).trim() !== '') {
    const pNorm = normalizeUuidParam(String(rawParent));
    if (!pNorm) return res.status(400).json({ error: 'Invalid parent comment' });
    parentId = pNorm;
  }

  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Invalid token payload' });
  try {
    if (parentId) {
      const { rows: prow } = await dbQuery(
        'SELECT parent_id FROM feed_comments WHERE id = $1 AND post_id = $2',
        [parentId, postId]
      );
      if (!prow.length) return res.status(400).json({ error: 'Parent comment not found' });
      if (prow[0].parent_id) {
        return res.status(400).json({ error: 'Cannot reply to a reply' });
      }
    }

    const { rows: urows } = await dbQuery('SELECT name FROM users WHERE id = $1', [userId]);
    const authorName = (urows[0]?.name && String(urows[0].name).trim()) || 'Guest';

    const { rows } = parentId
      ? await dbQuery(
        `INSERT INTO feed_comments (post_id, user_id, author_name, body, parent_id) VALUES ($1, $2, $3, $4, $5)
           RETURNING id, author_name, body, created_at, parent_id`,
        [postId, userId, authorName.slice(0, 255), body, parentId]
      )
      : await dbQuery(
        `INSERT INTO feed_comments (post_id, user_id, author_name, body) VALUES ($1, $2, $3, $4)
           RETURNING id, author_name, body, created_at`,
        [postId, userId, authorName.slice(0, 255), body]
      );
    const c = rows[0];
    res.status(201).json({
      comment: {
        id: c.id,
        authorName: c.author_name,
        body: c.body,
        createdAt: c.created_at,
        parentId: c.parent_id || null,
        userId,
        likesCount: 0,
        likedByMe: false,
      },
    });
  } catch (err) {
    console.error(err);
    if (err.code === '42P01') return res.status(503).json({ error: 'Comments not available' });
    if (err.code === '42703') {
      try {
        const { rows: urows } = await dbQuery('SELECT name FROM users WHERE id = $1', [userId]);
        const authorName = (urows[0]?.name && String(urows[0].name).trim()) || 'Guest';
        const { rows } = await dbQuery(
          `INSERT INTO feed_comments (post_id, user_id, author_name, body) VALUES ($1, $2, $3, $4)
           RETURNING id, author_name, body, created_at`,
          [postId, userId, authorName.slice(0, 255), body]
        );
        const c = rows[0];
        return res.status(201).json({
          comment: {
            id: c.id,
            authorName: c.author_name,
            body: c.body,
            createdAt: c.created_at,
            parentId: null,
            userId,
            likesCount: 0,
            likedByMe: false,
          },
        });
      } catch (e2) {
        console.error(e2);
        return res.status(503).json({ error: 'Comments not available' });
      }
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Could not post comment (invalid post or user).' });
    }
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

/**
 * POST /api/feed/post/:postId/like — toggle like (auth).
 * Persists immediately to `feed_likes` (INSERT = like, DELETE = unlike) in one DB transaction.
 */
router.post('/post/:postId/like', authMiddleware, async (req, res) => {
  const postId = normalizeUuidParam(req.params.postId);
  if (!postId) return res.status(400).json({ error: 'Invalid post id' });
  const post = await getPublicPostRow(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.hide_likes === true) {
    return res.status(403).json({ error: 'Likes are hidden for this post', code: 'LIKES_HIDDEN' });
  }

  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Invalid token payload' });

  const isDev = process.env.NODE_ENV !== 'production';

  for (let attempt = 0; attempt < 2; attempt++) {
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const existing = await client.query(
        'SELECT 1 FROM feed_likes WHERE post_id = $1::uuid AND user_id = $2::uuid',
        [postId, userId]
      );
      if (existing.rows.length) {
        await client.query('DELETE FROM feed_likes WHERE post_id = $1::uuid AND user_id = $2::uuid', [postId, userId]);
      } else {
        await insertFeedLikeOrConcurrent(client, postId, userId);
      }
      const { rows: cntRows } = await client.query('SELECT COUNT(*)::int AS c FROM feed_likes WHERE post_id = $1::uuid', [
        postId,
      ]);
      const liked = await client.query(
        'SELECT 1 FROM feed_likes WHERE post_id = $1::uuid AND user_id = $2::uuid',
        [postId, userId]
      );
      await client.query('COMMIT');
      return res.json({
        liked: liked.rows.length > 0,
        likes_count: Number(cntRows[0]?.c) || 0,
      });
    } catch (err) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {}
      }
      if (err.code === '40P01' && attempt === 0) {
        await new Promise((r) => setTimeout(r, 55));
        continue;
      }
      console.error('[feed like]', err.code, err.message, err.detail);
      if (err.code === '42P01') return res.status(503).json({ error: 'Likes not available' });
      if (err.code === '23503') {
        return res.status(400).json({
          error: 'Could not save like (database constraint). Ensure feed_likes exists and users table is valid.',
        });
      }
      return res.status(500).json({
        error:
          isDev && err.message
            ? `Failed to update like: ${err.message}`
            : 'Failed to update like',
      });
    } finally {
      if (client) client.release();
    }
  }
});

/** POST /api/feed/post/:postId/save — toggle save (auth) */
router.post('/post/:postId/save', authMiddleware, async (req, res) => {
  const postId = normalizeUuidParam(req.params.postId);
  if (!postId) return res.status(400).json({ error: 'Invalid post id' });
  const post = await getPublicPostRow(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Invalid token payload' });
  try {
    const existing = await dbQuery('SELECT 1 FROM feed_saves WHERE post_id = $1::uuid AND user_id = $2::uuid', [
      postId,
      userId,
    ]);
    if (existing.rows.length) {
      await dbQuery('DELETE FROM feed_saves WHERE post_id = $1::uuid AND user_id = $2::uuid', [postId, userId]);
    } else {
      try {
        await dbQuery('INSERT INTO feed_saves (post_id, user_id) VALUES ($1::uuid, $2::uuid)', [postId, userId]);
      } catch (e) {
        if (e.code !== '23505') throw e;
      }
    }
    const saved = await dbQuery('SELECT 1 FROM feed_saves WHERE post_id = $1::uuid AND user_id = $2::uuid', [
      postId,
      userId,
    ]);
    res.json({ saved: saved.rows.length > 0 });
  } catch (err) {
    console.error(err);
    if (err.code === '42P01') return res.status(503).json({ error: 'Saves not available' });
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Could not save post (invalid post or user).' });
    }
    res.status(500).json({ error: 'Failed to update save' });
  }
});

module.exports = router;
