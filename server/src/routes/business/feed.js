const express = require('express');
const crypto = require('crypto');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { parsePlaceId, safeUrl } = require('../../utils/validate');
const { feedImagesForStorage } = require('../../utils/feedImageUrls');
const { normalizeFeedEnhancements } = require('../../utils/feedPostPayload');
const { canManageFeedPost, loadFeedPostById } = require('../../utils/feedPostAccess');

const router = express.Router();
router.use(authMiddleware, businessPortalMiddleware);


async function loadManagedPost(userId, postId) {
  const post = await loadFeedPostById(postId);
  if (!post) return null;
  if (await canManageFeedPost(userId, post)) return post;
  return null;
}

/** Legacy: business portal uses loadManagedPost (author or place owner). */


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

  try {
    const poColl = await getCollection('place_owners');
    const ownedPlaceIds = (await poColl.find({ user_id: userId }).toArray()).map(o => o.place_id);
    
    if (!ownedPlaceIds.length) return res.json({ posts: [] });

    const postsColl = await getCollection('feed_posts');
    const queryObj = { place_id: { $in: ownedPlaceIds } };
    
    if (placeFilter?.valid) {
      if (!ownedPlaceIds.includes(placeFilter.value)) {
        return res.status(403).json({ error: 'You do not manage this place' });
      }
      queryObj.place_id = placeFilter.value;
    }

    if (format === 'reel') {
      queryObj.type = { $in: ['reel', 'video'] };
    } else if (format === 'post') {
      queryObj.type = { $ne: 'video' };
    }

    const rows = await postsColl.find(queryObj).sort({ created_at: -1 }).limit(200).toArray();
    res.json({ posts: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list posts' });
  }
});

/** POST /api/business/feed */
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
    const poColl = await getCollection('place_owners');
    const own = await poColl.findOne({ user_id: userId, place_id: pid.value });
    if (!own) return res.status(403).json({ error: 'You do not manage this place' });

    const usersColl = await getCollection('users');
    const user = await usersColl.findOne({ id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.feed_upload_blocked === true) {
      return res.status(403).json({ error: 'Your account is blocked from uploading posts/reels' });
    }

    const placesColl = await getCollection('places');
    const place = await placesColl.findOne({ id: pid.value });
    if (!place) return res.status(404).json({ error: 'Place not found' });
    if (place.feed_linking_disabled === true) {
      return res.status(403).json({ error: 'Post/reel linking is disabled for this place by admin' });
    }

    const authorName = (user?.name && String(user.name).trim()) || (user?.email && String(user.email).split('@')[0]) || 'Partner';
    const authorShort = authorName.slice(0, 255);

    const id = crypto.randomUUID();
    const postsColl = await getCollection('feed_posts');
    const enhancements = normalizeFeedEnhancements(req.body || {});
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
      author_role: 'business_owner',
      author_verified: true,
      moderation_status: 'approved',
      discoverable: true,
      ...enhancements,
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

/** PATCH /api/business/feed/:id */
router.patch('/:id', async (req, res) => {
  const userId = req.user.userId;
  const existing = await loadManagedPost(userId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });

  const body = req.body || {};
  const setObj = {};

  if (body.placeId !== undefined || body.place_id !== undefined) {
    const pid = parsePlaceId(body.placeId ?? body.place_id);
    if (!pid.valid) return res.status(400).json({ error: 'Invalid placeId' });
    if (pid.value !== existing.place_id) {
      const poColl = await getCollection('place_owners');
      const own = await poColl.findOne({ user_id: userId, place_id: pid.value });
      if (!own) return res.status(403).json({ error: 'You do not manage this place' });
      const placesColl = await getCollection('places');
      const place = await placesColl.findOne({ id: pid.value });
      if (!place) return res.status(404).json({ error: 'Place not found' });
      if (place.feed_linking_disabled === true) {
        return res.status(403).json({ error: 'Post/reel linking is disabled for this place' });
      }
      setObj.place_id = pid.value;
    }
  }

  if (body.caption !== undefined) {
    const cap = String(body.caption).trim();
    if (!cap || cap.length > 8000) return res.status(400).json({ error: 'Invalid caption' });
    setObj.caption = cap;
  }
  
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
  if (body.video_url !== undefined) {
    setObj.video_url = body.video_url ? safeUrl(body.video_url) : null;
  }
  if (body.type !== undefined) {
    const raw = String(body.type).trim().toLowerCase();
    setObj.type = raw === 'reel' || raw === 'video' ? 'video' : 'post';
  }
  if (body.hide_likes !== undefined) setObj.hide_likes = Boolean(body.hide_likes);
  if (body.comments_disabled !== undefined) setObj.comments_disabled = Boolean(body.comments_disabled);
  Object.assign(setObj, normalizeFeedEnhancements(body));

  if (Object.keys(setObj).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  setObj.updated_at = new Date();

  try {
    const postsColl = await getCollection('feed_posts');
    await postsColl.updateOne({ id: req.params.id }, { $set: setObj });
    const updated = await postsColl.findOne({ id: req.params.id });
    res.json({ post: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

/** DELETE /api/business/feed/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.user.userId;
  const existing = await loadManagedPost(userId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });

  const id = req.params.id;
  try {
    const postsColl = await getCollection('feed_posts');
    const commentsColl = await getCollection('feed_comments');
    const likesColl = await getCollection('feed_likes');
    const savesColl = await getCollection('feed_saves');

    await commentsColl.deleteMany({ post_id: id });
    await likesColl.deleteMany({ post_id: id });
    await savesColl.deleteMany({ post_id: id });
    await postsColl.deleteOne({ id: id });
    
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
