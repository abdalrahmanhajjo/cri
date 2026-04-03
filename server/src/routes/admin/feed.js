const express = require('express');
const crypto = require('crypto');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { parsePlaceId, safeUrl } = require('../../utils/validate');
const { feedImagesForStorage } = require('../../utils/feedImageUrls');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

const MODERATION = new Set(['pending', 'approved', 'rejected']);

function buildListMatch(status, discoverable, q, format) {
  const match = {};

  if (status && status !== 'all') {
    match.moderation_status = status;
  }
  if (discoverable === 'true') {
    match.discoverable = true;
  } else if (discoverable === 'false') {
    match.discoverable = { $ne: true };
  }

  if (format === 'reel') {
    match.type = { $in: ['reel', 'video'] };
  } else if (format === 'post') {
    match.type = { $ne: 'video' }; // Assuming 'video' includes reels in this logic
  }

  if (q && q.trim()) {
    const regex = { $regex: q.trim(), $options: 'i' };
    match.$or = [
      { caption: regex },
      { author_name: regex },
      { place_id: regex },
      { 'user.email': regex }
    ];
  }

  return match;
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

  try {
    const postsColl = await getCollection('feed_posts');
    
    const pipeline = [
      { $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
      }},
      { $addFields: {
          user_email: { $arrayElemAt: ['$user.email', 0] }
      }},
      { $match: buildListMatch(status, discoverable, q, formatKey === 'all' ? null : formatKey) },
      { $lookup: {
          from: 'feed_likes',
          localField: 'id',
          foreignField: 'post_id',
          as: 'likes'
      }},
      { $lookup: {
          from: 'feed_comments',
          localField: 'id',
          foreignField: 'post_id',
          as: 'comments'
      }},
      { $addFields: {
          likes_count: { $size: '$likes' },
          comments_count: { $size: '$comments' }
      }},
      { $project: { user: 0, likes: 0, comments: 0 } },
      { $sort: { created_at: -1 } },
      { $skip: offset },
      { $limit: limit }
    ];

    const rows = await postsColl.aggregate(pipeline).toArray();
    const pendingCount = await postsColl.countDocuments({ moderation_status: 'pending' });

    res.json({ posts: rows, pendingCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list feed posts' });
  }
});

/** POST /api/admin/feed */
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
    const placesColl = await getCollection('places');
    const place = await placesColl.findOne({ id: pid.value });
    if (!place) return res.status(404).json({ error: 'Place not found' });

    const usersColl = await getCollection('users');
    const user = await usersColl.findOne({ id: userId });
    const authorName = (user?.name && String(user.name).trim()) || (user?.email && String(user.email).split('@')[0]) || 'Admin';
    const authorShort = authorName.slice(0, 255);

    const id = crypto.randomUUID();
    const postsColl = await getCollection('feed_posts');
    const newPost = {
      id,
      user_id: userId,
      author_name: authorShort,
      place_id: pid.value,
      caption,
      image_url: imageUrl,
      image_urls: imageUrlsArr || [],
      video_url: videoUrl,
      type,
      author_role: 'admin',
      moderation_status,
      discoverable,
      created_at: new Date(),
      updated_at: new Date()
    };

    await postsColl.insertOne(newPost);
    res.status(201).json({ post: newPost });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

/** GET /api/admin/feed/:id/comments */
router.get('/:id/comments', async (req, res) => {
  const postId = req.params.id;
  try {
    const commentsColl = await getCollection('feed_comments');
    const rows = await commentsColl.aggregate([
      { $match: { post_id: postId } },
      { $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
      }},
      { $addFields: {
          user_email: { $arrayElemAt: ['$user.email', 0] }
      }},
      { $project: { user: 0 } },
      { $sort: { created_at: 1 } }
    ]).toArray();
    res.json({ comments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

/** DELETE /api/admin/feed/comments/:commentId */
router.delete('/comments/:commentId', async (req, res) => {
  const commentId = req.params.commentId;
  try {
    const commentsColl = await getCollection('feed_comments');
    const result = await commentsColl.deleteOne({ id: commentId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Comment not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

/** PATCH /api/admin/feed/:id */
router.patch('/:id', async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const setObj = {};

  if (body.moderation_status !== undefined) {
    if (!MODERATION.has(body.moderation_status)) return res.status(400).json({ error: 'Invalid moderation_status' });
    setObj.moderation_status = body.moderation_status;
  }
  if (body.discoverable !== undefined) setObj.discoverable = Boolean(body.discoverable);
  if (body.caption !== undefined) setObj.caption = String(body.caption).slice(0, 8000);
  
  if (body.placeId !== undefined || body.place_id !== undefined) {
    const pid = parsePlaceId(body.placeId ?? body.place_id);
    if (!pid.valid) return res.status(400).json({ error: 'Valid placeId is required' });
    setObj.place_id = pid.value;
  }
  if (body.type !== undefined) setObj.type = String(body.type).slice(0, 40);
  
  const hasImageUrls = Object.prototype.hasOwnProperty.call(body, 'image_urls');
  const hasImageUrl = Object.prototype.hasOwnProperty.call(body, 'image_url');
  if (hasImageUrls || hasImageUrl) {
    const { image_url: nextFirst, image_urls: nextList } = feedImagesForStorage({
      image_url: hasImageUrl ? body.image_url : undefined,
      image_urls: hasImageUrls ? body.image_urls : undefined,
    });
    setObj.image_url = nextFirst;
    setObj.image_urls = nextList || [];
  }
  if (body.video_url !== undefined) setObj.video_url = body.video_url ? String(body.video_url).slice(0, 500) : null;
  if (body.admin_notes !== undefined) setObj.admin_notes = body.admin_notes ? String(body.admin_notes).slice(0, 4000) : null;

  if (Object.keys(setObj).length === 0) return res.status(400).json({ error: 'No fields to update' });
  setObj.updated_at = new Date();

  try {
    const postsColl = await getCollection('feed_posts');
    const result = await postsColl.findOneAndUpdate(
      { id: id },
      { $set: setObj },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

/** GET /api/admin/feed/:id */
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const postsColl = await getCollection('feed_posts');
    const rows = await postsColl.aggregate([
      { $match: { id: id } },
      { $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
      }},
      { $addFields: {
          user_email: { $arrayElemAt: ['$user.email', 0] }
      }},
      { $lookup: {
          from: 'feed_likes',
          localField: 'id',
          foreignField: 'post_id',
          as: 'likes'
      }},
      { $lookup: {
          from: 'feed_comments',
          localField: 'id',
          foreignField: 'post_id',
          as: 'comments'
      }},
      { $addFields: {
          likes_count: { $size: '$likes' },
          comments_count: { $size: '$comments' }
      }},
      { $project: { user: 0, likes: 0, comments: 0 } }
    ]).toArray();

    if (!rows.length) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load post' });
  }
});

/** DELETE /api/admin/feed/:id */
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const postsColl = await getCollection('feed_posts');
    const commentsColl = await getCollection('feed_comments');
    const likesColl = await getCollection('feed_likes');
    const savesColl = await getCollection('feed_saves');

    await commentsColl.deleteMany({ post_id: id });
    await likesColl.deleteMany({ post_id: id });
    await savesColl.deleteMany({ post_id: id });
    const result = await postsColl.deleteOne({ id: id });
    
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
