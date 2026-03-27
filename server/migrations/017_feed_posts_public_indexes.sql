-- Speed public feed queries (moderation + optional place filter + sort/pagination)
CREATE INDEX IF NOT EXISTS idx_feed_posts_public_discover_created
  ON feed_posts (moderation_status, discoverable, created_at DESC)
  WHERE moderation_status = 'approved' AND discoverable = true;

CREATE INDEX IF NOT EXISTS idx_feed_posts_public_place_created
  ON feed_posts (place_id, moderation_status, discoverable, created_at DESC)
  WHERE moderation_status = 'approved' AND discoverable = true;
