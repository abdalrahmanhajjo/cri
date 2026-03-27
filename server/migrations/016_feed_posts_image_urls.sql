-- Multiple images per feed post (gallery). image_url remains the first image for legacy clients.
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT NULL;

COMMENT ON COLUMN feed_posts.image_urls IS 'Gallery image URLs (JSON array); image_url duplicates the first entry for backward compatibility';

-- Longer URLs from storage/CDN
ALTER TABLE feed_posts ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE feed_posts ALTER COLUMN video_url TYPE TEXT;

UPDATE feed_posts
SET image_urls = to_jsonb(ARRAY[image_url::text])
WHERE image_url IS NOT NULL
  AND TRIM(image_url) <> ''
  AND (image_urls IS NULL OR image_urls = 'null'::jsonb OR image_urls = '[]'::jsonb);
