const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { query } = require('../../db');
const { parsePlaceId } = require('../../utils/validate');
const {
  isVideoMime,
  multerFileAllowed,
  prepareUploadedImage,
  pickImageExtension,
  VIDEO_MIME_TO_EXT,
} = require('../../utils/imageUpload');

const router = express.Router();
const BUCKET = 'place-images';
const LOCAL_PLACES = path.join(__dirname, '../../../uploads/places');
const LOCAL_FEED_VIDEOS = path.join(__dirname, '../../../uploads/feed/videos');

try {
  fs.mkdirSync(LOCAL_PLACES, { recursive: true });
  fs.mkdirSync(LOCAL_FEED_VIDEOS, { recursive: true });
} catch (_) {}

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
const uploadMw = multer({
  storage: memoryStorage,
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = multerFileAllowed(file);
    cb(
      ok
        ? null
        : new Error(
            'Only images (JPEG, PNG, GIF, WebP, HEIC/HEIF — HEIC is saved as JPEG) or videos (MP4, WebM, MOV) allowed'
          ),
      ok
    );
  },
});

router.use(authMiddleware, businessPortalMiddleware);

/** POST /api/business/upload — FormData: file, placeId (must be a place you own). */
router.post('/', uploadMw.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const parsed = parsePlaceId(req.body?.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'placeId is required' });
  const placeId = parsed.value;
  try {
    const { rows } = await query(
      'SELECT 1 FROM place_owners WHERE user_id = $1 AND place_id = $2',
      [req.user.userId, placeId]
    );
    if (!rows.length) return res.status(403).json({ error: 'You do not manage this place' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to verify place' });
  }

  let uploadBuffer = req.file.buffer;
  let contentType = req.file.mimetype;
  let safeExt;
  let storagePrefix;

  if (isVideoMime(req.file.mimetype)) {
    const rawExt = path.extname(req.file.originalname) || '';
    const ext = (rawExt.startsWith('.') ? rawExt : rawExt ? `.${rawExt}` : '').toLowerCase();
    const fromMime = VIDEO_MIME_TO_EXT[req.file.mimetype.toLowerCase()] || '.mp4';
    safeExt = /^\.(mp4|webm|mov|m4v)$/i.test(ext) ? ext : fromMime;
    storagePrefix = 'feed/videos';
  } else {
    try {
      const prep = await prepareUploadedImage(uploadBuffer, req.file.mimetype, req.file.originalname);
      uploadBuffer = prep.buffer;
      contentType = prep.contentType;
      safeExt = pickImageExtension(contentType, req.file.originalname, prep.useExtension);
      storagePrefix = 'places';
    } catch (e) {
      if (e.code === 'HEIC_CONVERT_FAILED') {
        return res.status(e.status || 422).json({ error: e.message });
      }
      throw e;
    }
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
        .upload(filePath, uploadBuffer, {
          contentType,
          upsert: false,
        });

      if (!error) {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
        return res.json({ url: urlData.publicUrl });
      }
      if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
        const bucketReady = await ensureBucket(supabase);
        if (bucketReady) {
          const retry = await supabase.storage.from(BUCKET).upload(filePath, uploadBuffer, {
            contentType,
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
    fs.writeFileSync(localPath, uploadBuffer);
    const publicPrefix = storagePrefix === 'places' ? '/uploads/places' : '/uploads/feed/videos';
    res.json({ url: `${publicPrefix}/${filename}` });
  } catch (err) {
    console.error('Local upload error:', err);
    res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

module.exports = router;
