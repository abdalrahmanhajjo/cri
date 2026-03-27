/** Raw image URL strings from API row (image_urls JSON array or legacy image_url). */
export function rawFeedImageUrls(post) {
  if (!post) return [];
  let extra = post.image_urls;
  if (typeof extra === 'string' && extra.trim()) {
    try {
      extra = JSON.parse(extra);
    } catch {
      extra = null;
    }
  }
  if (Array.isArray(extra) && extra.length) {
    return extra.map((u) => String(u).trim()).filter(Boolean);
  }
  if (post.image_url != null && String(post.image_url).trim()) {
    return [String(post.image_url).trim()];
  }
  return [];
}

export const MAX_FEED_POST_IMAGES = 10;
