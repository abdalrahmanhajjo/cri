const express = require('express');
const { getCollection, getMongoDb } = require('../mongo');
const { sendDbAwareError } = require('../utils/dbHttpError');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');

const router = express.Router();

/** Concurrent toggles can race; MongoDB handles this with unique indexes. */
async function insertFeedLikeOrConcurrent(postId, userId) {
  const likes = await getCollection('feed_likes');
  try {
    await likes.insertOne({ post_id: postId, user_id: userId, created_at: new Date() });
  } catch (e) {
    if (e.code === 11000) return; // Duplicate key
    throw e;
  }
}

async function insertCommentLikeOrConcurrent(commentId, userId) {
  const likes = await getCollection('feed_comment_likes');
  try {
    await likes.insertOne({ comment_id: commentId, user_id: userId, created_at: new Date() });
  } catch (e) {
    if (e.code === 11000) return;
    throw e;
  }
}

/** `feed_posts.place_id` matches `places.id` (varchar). */
function normalizeFeedPlaceId(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.length > 255) return null;
  return t;
}

/** Single post lookup. */
async function getPublicPostRow(postId) {
  try {
    const posts = await getCollection('feed_posts');
    const post = await posts.findOne({
      id: postId,
      moderation_status: { $nin: ['rejected'] },
    });
    if (!post) return null;
    return {
      id: post.id,
      hide_likes: post.hide_likes ?? false,
      comments_disabled: post.comments_disabled ?? false
    };
  } catch (err) {
    return null;
  }
}

/** GET /api/feed — public community feed. */
router.get('/', optionalAuthMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const format = String(req.query.format || 'all').toLowerCase();
  const sort = String(req.query.sort || 'recent').toLowerCase();
  const placeIdFilter = normalizeFeedPlaceId(req.query.placeId);
  const userId = req.user?.userId || null;

  try {
    const postsColl = await getCollection('feed_posts');
    const db = await getMongoDb();
    
    const queryObj = {
      moderation_status: { $nin: ['rejected'] },
    };
    
    if (format === 'reel' || format === 'video') {
      queryObj.type = { $in: ['reel', 'video'] };
    } else if (format === 'post') {
      queryObj.type = { $nin: ['reel', 'video'] };
    }
    
    if (placeIdFilter) {
      queryObj.place_id = placeIdFilter;
    }

    // Sort logic
    let sortObj = { created_at: -1 };
    if (sort === 'popular' || sort === 'engagement') {
      // In a real Mongo app, we'd have engagement scores denormalized.
      // For now, we'll stick to recent or implement a simple aggregation.
      sortObj = { likes_count: -1, created_at: -1 };
    }

    const posts = await postsColl.aggregate([
      { $match: queryObj },
      { $sort: sortObj },
      { $skip: offset },
      { $limit: limit },
      { $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place'
      }},
      { $addFields: {
          place_name: { $arrayElemAt: ['$place.name', 0] },
          place_image_url: { $arrayElemAt: [{ $ifNull: [{ $arrayElemAt: ['$place.images', 0] }, null] }, 0] }
      }},
      { $project: { place: 0 } }
    ]).toArray();

    // Fill social flags and counts
    const likesColl = await getCollection('feed_likes');
    const savesColl = await getCollection('feed_saves');
    const commentsColl = await getCollection('feed_comments');
    const placeOwnersColl = await getCollection('place_owners');

    const mappedPosts = await Promise.all(posts.map(async (p) => {
      const likesCount = await likesColl.countDocuments({ post_id: p.id });
      const commentsCount = await commentsColl.countDocuments({ post_id: p.id });
      
      let likedByMe = false;
      let savedByMe = false;
      let iManagePost = false;
      
      if (userId) {
        likedByMe = !!(await likesColl.findOne({ post_id: p.id, user_id: userId }));
        savedByMe = !!(await savesColl.findOne({ post_id: p.id, user_id: userId }));
        if (p.user_id === userId) iManagePost = true;
        else if (p.place_id) {
          iManagePost = !!(await placeOwnersColl.findOne({ place_id: p.place_id, user_id: userId }));
        }
      }
      
      return {
        ...p,
        likes_count: likesCount,
        comments_count: commentsCount,
        liked_by_me: likedByMe,
        saved_by_me: savedByMe,
        i_manage_post: iManagePost,
        hide_likes: p.hide_likes ?? false,
        comments_disabled: p.comments_disabled ?? false
      };
    }));

    res.json({ posts: mappedPosts, hasMore: mappedPosts.length === limit, offset, limit });
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to load feed');
  }
});

/** GET single post. */
router.get('/post/:postId', optionalAuthMiddleware, async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user?.userId || null;
  try {
    const postsColl = await getCollection('feed_posts');
    const post = await postsColl.aggregate([
      { $match: { id: postId, moderation_status: { $nin: ['rejected'] } } },
      { $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place'
      }},
      { $addFields: {
          place_name: { $arrayElemAt: ['$place.name', 0] },
          place_image_url: { $arrayElemAt: [{ $ifNull: [{ $arrayElemAt: ['$place.images', 0] }, null] }, 0] }
      }},
      { $project: { place: 0 } }
    ]).next();

    if (!post) return res.status(404).json({ error: 'Post not found' });

    const likesColl = await getCollection('feed_likes');
    const savesColl = await getCollection('feed_saves');
    const commentsColl = await getCollection('feed_comments');
    const placeOwnersColl = await getCollection('place_owners');

    const likesCount = await likesColl.countDocuments({ post_id: post.id });
    const commentsCount = await commentsColl.countDocuments({ post_id: post.id });
    
    let likedByMe = false;
    let savedByMe = false;
    let iManagePost = false;
    
    if (userId) {
      likedByMe = !!(await likesColl.findOne({ post_id: post.id, user_id: userId }));
      savedByMe = !!(await savesColl.findOne({ post_id: post.id, user_id: userId }));
      if (post.user_id === userId) iManagePost = true;
      else if (post.place_id) {
        iManagePost = !!(await placeOwnersColl.findOne({ place_id: post.place_id, user_id: userId }));
      }
    }

    res.json({ post: {
      ...post,
      likes_count: likesCount,
      comments_count: commentsCount,
      liked_by_me: likedByMe,
      saved_by_me: savedByMe,
      i_manage_post: iManagePost,
      hide_likes: post.hide_likes ?? false,
      comments_disabled: post.comments_disabled ?? false
    }});
  } catch (err) {
    console.error(err);
    return sendDbAwareError(res, err, 'Failed to load post');
  }
});

/** GET comments. */
router.get('/post/:postId/comments', optionalAuthMiddleware, async (req, res) => {
  const postId = req.params.postId;
  const post = await getPublicPostRow(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.comments_disabled === true) return res.json({ comments: [] });
  
  const userId = req.user?.userId || null;
  try {
    const commentsColl = await getCollection('feed_comments');
    const commentLikesColl = await getCollection('feed_comment_likes');
    
    const rows = await commentsColl.find({ post_id: postId }).sort({ created_at: 1 }).limit(200).toArray();
    
    const comments = await Promise.all(rows.map(async (r) => {
      const likesCount = await commentLikesColl.countDocuments({ comment_id: r.id });
      let likedByMe = false;
      if (userId) {
        likedByMe = !!(await commentLikesColl.findOne({ comment_id: r.id, user_id: userId }));
      }
      return {
        id: r.id,
        authorName: r.author_name,
        body: r.body,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        userId: r.user_id,
        parentId: r.parent_id || null,
        likesCount,
        likedByMe
      };
    }));
    
    res.json({ comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

/** Toggle comment like. */
router.post('/post/:postId/comments/:commentId/like', authMiddleware, async (req, res) => {
  const postId = req.params.postId;
  const commentId = req.params.commentId;
  const userId = req.user.userId;
  
  const post = await getPublicPostRow(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.comments_disabled === true) return res.status(403).json({ error: 'Comments disabled' });
  
  try {
    const commentsColl = await getCollection('feed_comments');
    const comment = await commentsColl.findOne({ id: commentId, post_id: postId });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    
    const commentLikesColl = await getCollection('feed_comment_likes');
    const existing = await commentLikesColl.findOne({ comment_id: commentId, user_id: userId });
    
    if (existing) {
      await commentLikesColl.deleteOne({ _id: existing._id });
    } else {
      await insertCommentLikeOrConcurrent(commentId, userId);
    }
    
    const likesCount = await commentLikesColl.countDocuments({ comment_id: commentId });
    const liked = !!(await commentLikesColl.findOne({ comment_id: commentId, user_id: userId }));
    
    res.json({ liked, likes_count: likesCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update comment like' });
  }
});

/** POST comment. */
router.post('/post/:postId/comments', authMiddleware, async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.userId;
  const { body, parentId } = req.body;
  
  if (!body || body.length > 2000) return res.status(400).json({ error: 'Invalid comment body' });
  
  const post = await getPublicPostRow(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.comments_disabled === true) return res.status(403).json({ error: 'Comments disabled' });
  
  try {
    const commentsColl = await getCollection('feed_comments');
    if (parentId) {
      const parent = await commentsColl.findOne({ id: parentId, post_id: postId });
      if (!parent) return res.status(400).json({ error: 'Parent not found' });
      if (parent.parent_id) return res.status(400).json({ error: 'Deep threading not supported' });
    }
    
    const usersColl = await getCollection('users');
    const user = await usersColl.findOne({ id: userId });
    const authorName = user?.name || 'Guest';
    
    const newId = require('crypto').randomUUID();
    const newComment = {
      id: newId,
      post_id: postId,
      user_id: userId,
      author_name: authorName,
      body,
      parent_id: parentId || null,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await commentsColl.insertOne(newComment);
    res.status(201).json({ comment: {
      id: newComment.id,
      authorName: newComment.author_name,
      body: newComment.body,
      createdAt: newComment.created_at,
      parentId: newComment.parent_id,
      userId: newComment.user_id,
      likesCount: 0,
      likedByMe: false
    }});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

/** Toggle post like. */
router.post('/post/:postId/like', authMiddleware, async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.userId;
  
  const post = await getPublicPostRow(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.hide_likes === true) return res.status(403).json({ error: 'Likes hidden' });
  
  try {
    const likesColl = await getCollection('feed_likes');
    const existing = await likesColl.findOne({ post_id: postId, user_id: userId });
    
    if (existing) {
      await likesColl.deleteOne({ _id: existing._id });
    } else {
      await insertFeedLikeOrConcurrent(postId, userId);
    }
    
    const likesCount = await likesColl.countDocuments({ post_id: postId });
    const liked = !!(await likesColl.findOne({ post_id: postId, user_id: userId }));
    
    res.json({ liked, likes_count: likesCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update like' });
  }
});

/** Toggle save. */
router.post('/post/:postId/save', authMiddleware, async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.userId;
  
  const post = await getPublicPostRow(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  
  try {
    const savesColl = await getCollection('feed_saves');
    const existing = await savesColl.findOne({ post_id: postId, user_id: userId });
    
    if (existing) {
      await savesColl.deleteOne({ _id: existing._id });
    } else {
      await savesColl.insertOne({ post_id: postId, user_id: userId, created_at: new Date() });
    }
    
    const saved = !!(await savesColl.findOne({ post_id: postId, user_id: userId }));
    res.json({ saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update save' });
  }
});

/** PATCH comment — author only. */
router.patch('/post/:postId/comments/:commentId', authMiddleware, async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.userId;
  const { body } = req.body;

  if (!body || body.length > 2000) return res.status(400).json({ error: 'Invalid comment body' });

  try {
    const commentsColl = await getCollection('feed_comments');
    const comment = await commentsColl.findOne({ id: commentId, post_id: postId });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (comment.user_id !== userId) {
      // Check if admin
      const usersColl = await getCollection('users');
      const user = await usersColl.findOne({ id: userId });
      if (!user?.is_admin) {
        return res.status(403).json({ error: 'Not authorized to edit this comment' });
      }
    }

    await commentsColl.updateOne(
      { id: commentId },
      { $set: { body, updated_at: new Date() } }
    );

    const updated = await commentsColl.findOne({ id: commentId });
    res.json({
      comment: {
        id: updated.id,
        body: updated.body,
        updatedAt: updated.updated_at
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

/** DELETE comment — author or admin. */
router.delete('/post/:postId/comments/:commentId', authMiddleware, async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.userId;

  try {
    const commentsColl = await getCollection('feed_comments');
    const comment = await commentsColl.findOne({ id: commentId, post_id: postId });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    let canDelete = comment.user_id === userId;
    if (!canDelete) {
      const usersColl = await getCollection('users');
      const user = await usersColl.findOne({ id: userId });
      if (user?.is_admin) canDelete = true;
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Delete comment and its direct replies (one level supported by nestComments)
    await commentsColl.deleteMany({
      $or: [
        { id: commentId },
        { parent_id: commentId }
      ]
    });

    const newCount = await commentsColl.countDocuments({ post_id: postId });
    res.json({ ok: true, comments_count: newCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
