-- Threaded replies, edit metadata, and per-comment likes (aligned with mobile app behavior)
ALTER TABLE feed_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES feed_comments(id) ON DELETE CASCADE;
ALTER TABLE feed_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_feed_comments_post_parent ON feed_comments(post_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_parent ON feed_comments(parent_id);

CREATE TABLE IF NOT EXISTS feed_comment_likes (
  comment_id UUID NOT NULL REFERENCES feed_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_comment_likes_user ON feed_comment_likes(user_id);
