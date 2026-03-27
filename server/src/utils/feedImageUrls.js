const { safeUrl } = require('./validate');

const MAX_FEED_IMAGES = 10;

/**
 * Collect validated image URLs from request body (image_urls array and/or legacy image_url).
 * @returns {string[]} deduped list, max MAX_FEED_IMAGES
 */
function parseFeedImageUrlList(body) {
  if (!body || typeof body !== 'object') return [];
  const out = [];
  if (Array.isArray(body.image_urls)) {
    for (const item of body.image_urls) {
      const u = safeUrl(typeof item === 'string' ? item : '');
      if (u) out.push(u);
      if (out.length >= MAX_FEED_IMAGES) break;
    }
  }
  if (out.length === 0) {
    const single = safeUrl(body.image_url);
    if (single) out.push(single);
  }
  const seen = new Set();
  const deduped = [];
  for (const u of out) {
    if (!seen.has(u)) {
      seen.add(u);
      deduped.push(u);
    }
  }
  return deduped;
}

/**
 * For INSERT / replace: first URL is legacy image_url; full list in JSONB.
 * @returns {{ image_url: string|null, image_urls: string[]|null }}
 */
function feedImagesForStorage(body) {
  const urls = parseFeedImageUrlList(body);
  if (urls.length === 0) return { image_url: null, image_urls: null };
  return { image_url: urls[0], image_urls: urls };
}

module.exports = { parseFeedImageUrlList, feedImagesForStorage, MAX_FEED_IMAGES };
