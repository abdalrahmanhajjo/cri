-- Feed moderation & discovery flags (admin approves what appears in public discovery)
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'approved';
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS discoverable BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows
UPDATE feed_posts SET moderation_status = 'approved' WHERE moderation_status IS NULL OR moderation_status = '';
UPDATE feed_posts SET discoverable = true WHERE discoverable IS NULL;

COMMENT ON COLUMN feed_posts.moderation_status IS 'pending | approved | rejected — rejected/hidden from public feed';
COMMENT ON COLUMN feed_posts.discoverable IS 'When approved, whether post appears in discovery/explore surfaces';
