const { getCollection } = require('../mongo');

/**
 * Whether this visitor is blocked from new messages to the place (new inquiries + follow-ups).
 * @param {string} placeId
 * @param {string|null|undefined} userId - logged-in user id
 * @param {string|null|undefined} emailLower - normalized email (lowercase trim)
 */
async function isMessagingBlocked(placeId, userId, emailLower) {
  const email = emailLower ? String(emailLower).trim().toLowerCase() : '';
  const uid = userId ? String(userId) : '';
  if (!uid && !email) return false;

  try {
    const blocksColl = await getCollection('place_messaging_blocks');
    
    if (uid && email) {
      const doc = await blocksColl.findOne({
        place_id: placeId,
        $or: [
          { blocked_user_id: uid },
          { blocked_email: email }
        ]
      });
      return !!doc;
    }
    
    if (uid) {
      const doc = await blocksColl.findOne({ place_id: placeId, blocked_user_id: uid });
      return !!doc;
    }
    
    const doc = await blocksColl.findOne({ place_id: placeId, blocked_email: email });
    return !!doc;
  } catch (e) {
    console.error('[messagingBlocks] isMessagingBlocked error:', e.message);
    return false;
  }
}

module.exports = { isMessagingBlocked };
