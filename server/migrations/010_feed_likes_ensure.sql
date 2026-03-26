-- Ensure feed_likes / feed_saves exist (post like & save). Safe to run multiple times.
-- FKs to feed_posts / users are added in 011_feed_engagement_fk.sql.
-- Web: POST /api/feed/post/:postId/like → feed_likes; save → feed_saves.

CREATE TABLE IF NOT EXISTS feed_likes (
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_likes_user_id ON feed_likes (user_id);

CREATE TABLE IF NOT EXISTS feed_saves (
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_saves_user_id ON feed_saves (user_id);
