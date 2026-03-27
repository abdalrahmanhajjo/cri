const db = require('../db');
const { parsePlaceId } = require('../utils/validate');

const dbQuery = db.query;

/**
 * After authMiddleware. Allows business portal if users.is_business_owner
 * or user has at least one place_owners row.
 */
async function businessPortalMiddleware(req, res, next) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  try {
    const { rows } = await dbQuery(
      `SELECT COALESCE(u.is_business_owner, false) AS is_business_owner,
              (SELECT COUNT(*)::int FROM place_owners po WHERE po.user_id = u.id) AS owned_places
       FROM users u WHERE u.id = $1`,
      [userId]
    );
    const row = rows[0];
    if (!row) return res.status(403).json({ error: 'Forbidden' });
    const ok = row.is_business_owner === true || (row.owned_places || 0) > 0;
    if (!ok) {
      return res.status(403).json({
        error: 'Business owner access required. Ask an admin to assign your place or enable the business owner role.',
      });
    }
    req.businessPortal = {
      isBusinessOwner: row.is_business_owner === true,
      ownedPlaceCount: row.owned_places || 0,
    };
    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to verify business access' });
  }
}

/** Requires a row in place_owners for req.params.placeId (or param name). */
function requirePlaceOwnerParam(paramName = 'placeId') {
  return async function requirePlaceOwner(req, res, next) {
    const userId = req.user?.userId;
    const raw = req.params[paramName];
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const parsed = parsePlaceId(raw);
    if (!parsed.valid) return res.status(400).json({ error: 'Invalid place id' });
    const placeId = parsed.value;
    try {
      if (!dbQuery) throw new Error('dbQuery is undefined in requirePlaceOwnerParam');
      const { rows } = await dbQuery(
        'SELECT 1 FROM place_owners WHERE user_id = $1 AND place_id = $2',
        [userId, placeId]
      );
      if (!rows.length) {
        return res.status(403).json({ error: 'You do not manage this place' });
      }
      req.ownsPlaceId = placeId;
      return next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to verify place ownership' });
    }
  };
}

module.exports = { businessPortalMiddleware, requirePlaceOwnerParam };
