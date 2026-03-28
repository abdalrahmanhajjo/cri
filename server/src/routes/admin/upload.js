const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
const BUCKET = 'place-images';
const LOCAL_PLACES = path.join(__dirname, '../../../uploads/places');
const LOCAL_FEED_VIDEOS = path.join(__dirname, '../../../uploads/feed/videos');

try {
  fs.mkdirSync(LOCAL_PLACES, { recursive: true });
  fs.mkdirSync(LOCAL_FEED_VIDEOS, { recursive: true });
} catch {
  void 0; /* dirs may already exist */
}

function isImageMime(m) {
  return /^image\/(jpeg|png|gif|webp)$/i.test(m || '');
}

function isVideoMime(m) {
  return /^video\/(mp4|webm|quicktime|x-m4v)$/i.test(m || '');
}

const VIDEO_MIME_TO_EXT = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-m4v': '.m4v',
};

function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch (e) {
    console.error('Supabase client init error:', e.message);
    return null;
  }
}

async function ensureBucket(supabase) {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET);
    if (exists) return true;
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) return true;
      console.error('Create bucket error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('ensureBucket error:', e);
    return false;
  }
}

const memoryStorage = multer.memoryStorage();
const upload = multer({
  storage: memoryStorage,
  // Images: high-res photos; feed reels: short MP4/WebM/MOV (higher cap for video).
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = isImageMime(file.mimetype) || isVideoMime(file.mimetype);
    cb(
      ok ? null : new Error('Only images (JPEG, PNG, GIF, WebP) or videos (MP4, WebM, MOV) allowed'),
      ok
    );
  },
});

router.use(authMiddleware, adminMiddleware);

/** POST /api/admin/upload - try Supabase Storage, fallback to local */
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const rawExt = path.extname(req.file.originalname) || '';
  const ext = (rawExt.startsWith('.') ? rawExt : rawExt ? '.' + rawExt : '').toLowerCase();
  let safeExt;
  let storagePrefix;

  if (isImageMime(req.file.mimetype)) {
    safeExt = /^\.(jpe?g|png|gif|webp)$/i.test(ext) ? ext : '.jpg';
    storagePrefix = 'places';
  } else if (isVideoMime(req.file.mimetype)) {
    const fromMime = VIDEO_MIME_TO_EXT[req.file.mimetype.toLowerCase()] || '.mp4';
    safeExt = /^\.(mp4|webm|mov|m4v)$/i.test(ext) ? ext : fromMime;
    storagePrefix = 'feed/videos';
  } else {
    return res.status(400).json({ error: 'Unsupported file type' });
  }

  const filename = `${crypto.randomBytes(16).toString('hex')}${safeExt}`;
  const filePath = `${storagePrefix}/${filename}`;

  const supabase = getSupabase();
  if (!supabase && process.env.NODE_ENV === 'production') {
    return res.status(503).json({
      error: 'Uploads are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.',
    });
  }
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (!error) {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
        return res.json({ url: urlData.publicUrl });
      }
      if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
        const bucketReady = await ensureBucket(supabase);
        if (bucketReady) {
          const retry = await supabase.storage.from(BUCKET).upload(filePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false,
          });
          if (!retry.error) {
            const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(retry.data.path);
            return res.json({ url: urlData.publicUrl });
          }
        }
      }
      console.error('Supabase storage upload error:', error);
    } catch (err) {
      console.error('Supabase upload error:', err);
    }
  }

  try {
    const localDir = storagePrefix === 'places' ? LOCAL_PLACES : LOCAL_FEED_VIDEOS;
    const localPath = path.join(localDir, filename);
    fs.writeFileSync(localPath, req.file.buffer);
    const publicPrefix = storagePrefix === 'places' ? '/uploads/places' : '/uploads/feed/videos';
    res.json({ url: `${publicPrefix}/${filename}` });
  } catch (err) {
    console.error('Local upload error:', err);
    res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

module.exports = router;
