const { getCollection } = require('../mongo');
const { parsePlaceId } = require('../utils/validate');

/**
 * After authMiddleware. Allows business portal if users.is_business_owner
 * or user has at least one place_owners row.
 */
async function businessPortalMiddleware(req, res, next) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  try {
    const usersColl = await getCollection('users');
    const poColl = await getCollection('place_owners');

    const user = await usersColl.findOne({ id: userId });
    if (!user) return res.status(403).json({ error: 'Forbidden' });

    const ownedPlaces = await poColl.countDocuments({ user_id: userId });

    const ok = user.is_admin === true || user.is_business_owner === true || ownedPlaces > 0;
    if (!ok) {
      return res.status(403).json({
        error: 'Business owner access required. Ask an admin to assign your place or enable the business owner role.',
      });
    }

    req.businessPortal = {
      isBusinessOwner: user.is_business_owner === true,
      ownedPlaceCount: ownedPlaces,
      isAdmin: user.is_admin === true,
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
      if (req.businessPortal?.isAdmin === true) {
        req.ownsPlaceId = placeId;
        return next();
      }
      const poColl = await getCollection('place_owners');
      const owner = await poColl.findOne({ user_id: userId, place_id: placeId });
      if (!owner) {
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

/**
 * Place owner or platform admin (full management in business APIs).
 * @param {string} userId
 * @param {string} placeId
 */
async function userManagesPlace(userId, placeId) {
  if (!userId || !placeId) return false;
  const usersColl = await getCollection('users');
  const u = await usersColl.findOne({ id: userId }, { projection: { is_admin: 1 } });
  if (u?.is_admin === true) return true;
  const poColl = await getCollection('place_owners');
  const row = await poColl.findOne({ user_id: userId, place_id: placeId });
  return !!row;
}

module.exports = { businessPortalMiddleware, requirePlaceOwnerParam, userManagesPlace };
