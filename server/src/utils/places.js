const { query: dbQuery } = require('../db');

/** Fix malformed extension (e.g. xxxjpg -> xxx.jpg) from old upload bug */
function fixImageUrlExtension(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/([a-f0-9]{32})(jpe?g|png|gif|webp)$/i, '$1.$2');
}

function resolveImageUrls(images, baseUrl) {
  if (!Array.isArray(images)) return [];
  const base = (baseUrl || process.env.UPLOADS_BASE_URL || '').replace(/\/$/, '');
  return images.filter(Boolean).map((url) => {
    if (!url || typeof url !== 'string') return null;
    url = fixImageUrlExtension(url);
    if (url.startsWith('http')) return url;
    if (url.startsWith('/') && base) return base + url;
    return url;
  }).filter(Boolean);
}

function safeParseJson(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function rowToPlace(row, baseUrl) {
  let images = safeParseJson(row.images, []);
  images = resolveImageUrls(images, baseUrl);
  const appN = row.app_review_count != null ? Number(row.app_review_count) : 0;
  const appAvg = row.app_avg_rating != null ? Number(row.app_avg_rating) : null;
  const useAppReviews = appN > 0 && appAvg != null && Number.isFinite(appAvg);
  const rating = useAppReviews ? appAvg : row.rating != null ? Number(row.rating) : null;
  const reviewCount = useAppReviews
    ? appN
    : row.review_count != null
      ? Number(row.review_count)
      : null;
  const result = {
    id: row.id,
    name: row.name,
    description: row.description || '',
    location: row.location || '',
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    images,
    category: row.category || '',
    categoryId: row.category_id,
    duration: row.duration,
    price: row.price,
    bestTime: row.best_time,
    rating: rating != null && Number.isFinite(rating) ? rating : null,
    reviewCount:
      reviewCount != null && Number.isFinite(reviewCount) ? Math.round(reviewCount) : null,
    hours: row.hours,
    tags: row.tags,
    searchName: row.search_name
  };
  if (row.latitude != null && row.longitude != null) result.coordinates = { lat: row.latitude, lng: row.longitude };
  if (images.length === 1) result.image = images[0];
  return result;
}

function getUploadsBaseUrl(req) {
  if (process.env.UPLOADS_BASE_URL) return process.env.UPLOADS_BASE_URL;
  const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:' + (process.env.PORT || 3095);
  return proto + '://' + host;
}

function buildPlaceReviewStatsJoin(excludeHiddenReviews) {
  const hiddenFilter = excludeHiddenReviews ? '\n  WHERE hidden_at IS NULL' : '';
  return `
LEFT JOIN (
  SELECT place_id::varchar AS pr_place_id,
         AVG(rating::double precision) AS app_avg_rating,
         COUNT(*)::int AS app_review_count
  FROM place_reviews${hiddenFilter}
  GROUP BY place_id
) pr_stats ON pr_stats.pr_place_id = p.id`;
}

let placeReviewMetaPromise = null;
async function getPlaceReviewMeta() {
  if (!placeReviewMetaPromise) {
    placeReviewMetaPromise = (async () => {
      try {
        const { rows } = await dbQuery(
          `SELECT 1 AS ok FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'place_reviews' AND column_name = 'hidden_at'
           LIMIT 1`
        );
        const hasHiddenAt = rows.length > 0;
        return {
          hasHiddenAt,
          statsJoinSql: buildPlaceReviewStatsJoin(hasHiddenAt),
        };
      } catch {
        return { hasHiddenAt: false, statsJoinSql: buildPlaceReviewStatsJoin(false) };
      }
    })();
  }
  return placeReviewMetaPromise;
}

async function userIsAdmin(userId) {
  if (!userId) return false;
  const allowEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  try {
    const { rows } = await dbQuery(
      'SELECT email, COALESCE(is_admin, false) AS is_admin FROM users WHERE id = $1',
      [userId]
    );
    const row = rows[0];
    if (!row) return false;
    if (row.is_admin === true) return true;
    const email = (row.email || '').toLowerCase();
    return allowEmails.length > 0 && allowEmails.includes(email);
  } catch {
    return false;
  }
}

async function userManagesPlace(userId, placeId) {
  try {
    const { rows } = await dbQuery(
      'SELECT 1 FROM place_owners WHERE user_id = $1 AND place_id = $2',
      [userId, placeId]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

module.exports = {
  fixImageUrlExtension,
  resolveImageUrls,
  safeParseJson,
  rowToPlace,
  getUploadsBaseUrl,
  getPlaceReviewMeta,
  userIsAdmin,
  userManagesPlace,
};
