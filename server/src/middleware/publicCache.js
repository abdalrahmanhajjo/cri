'use strict';

/**
 * Short CDN/browser cache for anonymous public JSON list endpoints.
 * Vary on query (?lang=) and Accept-Language so translated payloads do not mix.
 */
function cachePublicList(maxAgeSec = 60, staleWhileRevalidateSec = 300) {
  return (req, res, next) => {
    res.set(
      'Cache-Control',
      `public, max-age=${maxAgeSec}, stale-while-revalidate=${staleWhileRevalidateSec}`
    );
    res.set('Vary', 'Accept-Language, Accept-Encoding');
    next();
  };
}

module.exports = { cachePublicList };
