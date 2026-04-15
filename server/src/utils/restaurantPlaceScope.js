/**
 * Heuristic: dining / restaurant venues for admin business-console scope.
 */

const DINING_CATEGORY_RX = /restaurant|dining|café|cafe|coffee|food|bar|bistro|kitchen|grill|pizza|bakery|sweet/i;

function restaurantRowFilter() {
  return {
    $or: [{ category: { $regex: DINING_CATEGORY_RX } }, { 'dining_profile.cuisines.0': { $exists: true } }],
  };
}

function isDiningVenueRow(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.category && DINING_CATEGORY_RX.test(String(row.category))) return true;
  const dp = row.dining_profile;
  if (dp && typeof dp === 'object') {
    if (Array.isArray(dp.cuisines) && dp.cuisines.length) return true;
    if (Array.isArray(dp.signatureDishes) && dp.signatureDishes.length) return true;
  }
  return false;
}

module.exports = { restaurantRowFilter, isDiningVenueRow, DINING_CATEGORY_RX };
