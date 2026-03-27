const { query: dbQuery } = require('../db');

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
    if (uid && email) {
      const { rows } = await dbQuery(
        `SELECT 1 FROM place_messaging_blocks
         WHERE place_id = $1
           AND (
             blocked_user_id = $2::uuid
             OR (blocked_email IS NOT NULL AND lower(trim(blocked_email)) = $3)
           )
         LIMIT 1`,
        [placeId, uid, email]
      );
      return rows.length > 0;
    }
    if (uid) {
      const { rows } = await dbQuery(
        'SELECT 1 FROM place_messaging_blocks WHERE place_id = $1 AND blocked_user_id = $2::uuid LIMIT 1',
        [placeId, uid]
      );
      return rows.length > 0;
    }
    const { rows } = await dbQuery(
      `SELECT 1 FROM place_messaging_blocks
       WHERE place_id = $1 AND blocked_email IS NOT NULL AND lower(trim(blocked_email)) = $2
       LIMIT 1`,
      [placeId, email]
    );
    return rows.length > 0;
  } catch (e) {
    if (e.code === '42P01') return false;
    throw e;
  }
}

module.exports = { isMessagingBlocked };
