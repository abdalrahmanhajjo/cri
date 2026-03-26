-- Align feed_likes / feed_saves with feed_posts and users (same integrity as feed_comment_likes).
-- Removes orphan rows, then adds FKs. Safe to run multiple times (skips existing constraints).

-- Orphan likes/saves (missing post or user)
DELETE FROM feed_likes fl
WHERE NOT EXISTS (SELECT 1 FROM feed_posts p WHERE p.id = fl.post_id)
   OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = fl.user_id);

DELETE FROM feed_saves fs
WHERE NOT EXISTS (SELECT 1 FROM feed_posts p WHERE p.id = fs.post_id)
   OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = fs.user_id);

-- Comment likes pointing at deleted comments or users
DELETE FROM feed_comment_likes fcl
WHERE NOT EXISTS (SELECT 1 FROM feed_comments fc WHERE fc.id = fcl.comment_id)
   OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = fcl.user_id);

-- Comments with invalid post or user (should be rare)
DELETE FROM feed_comments fc
WHERE NOT EXISTS (SELECT 1 FROM feed_posts fp WHERE fp.id = fc.post_id)
   OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = fc.user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_likes_post_id_fkey') THEN
    ALTER TABLE feed_likes
      ADD CONSTRAINT feed_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES feed_posts (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_likes_user_id_fkey') THEN
    ALTER TABLE feed_likes
      ADD CONSTRAINT feed_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_saves_post_id_fkey') THEN
    ALTER TABLE feed_saves
      ADD CONSTRAINT feed_saves_post_id_fkey FOREIGN KEY (post_id) REFERENCES feed_posts (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_saves_user_id_fkey') THEN
    ALTER TABLE feed_saves
      ADD CONSTRAINT feed_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
  END IF;
END $$;
