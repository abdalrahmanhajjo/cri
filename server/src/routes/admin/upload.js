const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { authMiddleware } = require('../../middleware/auth');

const router = express.Router();
const BUCKET = 'place-images';
const LOCAL_UPLOADS = path.join(__dirname, '../../../uploads/places');

try {
  fs.mkdirSync(LOCAL_UPLOADS, { recursive: true });
} catch (_) {}

function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();
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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(ok ? null : new Error('Only images (JPEG, PNG, GIF, WebP) allowed'), ok);
  },
});

router.use(authMiddleware);

/** POST /api/admin/upload - try Supabase Storage, fallback to local */
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const rawExt = path.extname(req.file.originalname) || '.jpg';
  const ext = (rawExt.startsWith('.') ? rawExt : '.' + rawExt).toLowerCase();
  const safeExt = /^\.(jpe?g|png|gif|webp)$/i.test(ext) ? ext : '.jpg';
  const filename = `${crypto.randomBytes(16).toString('hex')}${safeExt}`;
  const filePath = `places/${filename}`;

  const supabase = getSupabase();
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
    const localPath = path.join(LOCAL_UPLOADS, filename);
    fs.writeFileSync(localPath, req.file.buffer);
    res.json({ url: `/uploads/places/${filename}` });
  } catch (err) {
    console.error('Local upload error:', err);
    res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

module.exports = router;
