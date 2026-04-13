const { getCollection } = require('../mongo');

/**
 * @param {string} userId
 * @param {{ user_id?: string, place_id?: string | null } | null} post
 */
async function canManageFeedPost(userId, post) {
  if (!userId || !post) return false;
  if (post.user_id === userId) return true;
  if (!post.place_id) return false;
  const poColl = await getCollection('place_owners');
  const row = await poColl.findOne({ place_id: post.place_id, user_id: userId });
  return !!row;
}

async function loadFeedPostById(postId) {
  if (!postId || String(postId).length > 64) return null;
  const postsColl = await getCollection('feed_posts');
  return postsColl.findOne({ id: postId });
}

module.exports = { canManageFeedPost, loadFeedPostById };
