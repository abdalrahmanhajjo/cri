const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { getGridFSBucket } = require('../../mongo');
const { getMulterFileSizeLimit } = require('../../utils/uploadLimits');
const { 
  multerFileAllowed, 
  isLikelyVideoUpload, 
  prepareUploadedImage, 
  pickImageExtension,
  prepareFeedVideoDiskPath,
  VIDEO_MIME_TO_EXT
} = require('../../utils/imageUpload');

const router = express.Router();
const MULTER_TMP = path.join(os.tmpdir(), 'visit-multer-uploads');

try {
  fs.mkdirSync(MULTER_TMP, { recursive: true });
} catch (_) {}

const multerFileLimits = getMulterFileSizeLimit();
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, MULTER_TMP),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '';
      cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
    },
  }),
  ...(multerFileLimits ? { limits: multerFileLimits } : {}),
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

router.use(authMiddleware, adminMiddleware);

/** POST /api/admin/upload - Use MongoDB GridFS for cloud storage */
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const multerPath = req.file.path;
  let uploadBuffer = null;
  let uploadDiskPath = null;
  let contentType = req.file.mimetype;
  let safeExt;
  let storagePrefix;

  try {
    if (isLikelyVideoUpload(req.file)) {
      const rawExt = path.extname(req.file.originalname) || '';
      const ext = (rawExt.startsWith('.') ? rawExt : rawExt ? `.${rawExt}` : '').toLowerCase();
      const fromMime = VIDEO_MIME_TO_EXT[(req.file.mimetype || '').toLowerCase()] || '.mp4';
      safeExt = /^\.(mp4|webm|mov|m4v|3gp|3g2|mkv)$/i.test(ext) ? ext : fromMime;
      storagePrefix = 'feed/videos';
      uploadDiskPath = multerPath;
      if (!contentType || contentType === 'application/octet-stream') {
        contentType = req.file.mimetype || 'application/octet-stream';
      }
    } else {
      uploadBuffer = await fs.promises.readFile(multerPath);
      await fs.promises.unlink(multerPath).catch(() => {});
      const prep = await prepareUploadedImage(uploadBuffer, req.file.mimetype, req.file.originalname);
      uploadBuffer = prep.buffer;
      contentType = prep.contentType;
      safeExt = pickImageExtension(contentType, req.file.originalname, prep.useExtension);
      storagePrefix = 'places';
    }
  } catch (e) {
    if (e.code === 'HEIC_CONVERT_FAILED') {
      await fs.promises.unlink(multerPath).catch(() => {});
      return res.status(e.status || 422).json({ error: e.message });
    }
    await fs.promises.unlink(multerPath).catch(() => {});
    throw e;
  }

  let pathToCleanupAfterSuccess = multerPath;
  let transcoderCleanup = null;
  if (uploadDiskPath && storagePrefix === 'feed/videos') {
    const prep = await prepareFeedVideoDiskPath(multerPath, safeExt, req.file);
    uploadDiskPath = prep.diskPath;
    pathToCleanupAfterSuccess = prep.cleanupPath;
    transcoderCleanup = prep.transcoderCleanup;
    if (prep.safeExt) safeExt = prep.safeExt;
    if (prep.contentType) contentType = prep.contentType;
  }

  const filename = `${storagePrefix}_${crypto.randomBytes(16).toString('hex')}${safeExt}`;

  async function cleanupAfterStored() {
    if (pathToCleanupAfterSuccess) {
      await fs.promises.unlink(pathToCleanupAfterSuccess).catch(() => {});
    }
    if (transcoderCleanup) {
      await transcoderCleanup().catch(() => {});
    }
  }

  try {
    const bucket = await getGridFSBucket();
    let finalBody = uploadBuffer;
    if (uploadDiskPath) {
      finalBody = await fs.promises.readFile(uploadDiskPath);
    }

    if (!finalBody) {
      throw new Error('Upload body is empty');
    }

    const uploadContentType =
      (contentType && String(contentType).trim()) ||
      (storagePrefix === 'feed/videos' ? 'video/mp4' : 'application/octet-stream');

    // Upload to GridFS
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: uploadContentType,
      metadata: { prefix: storagePrefix, originalName: req.file.originalname }
    });

    await new Promise((resolve, reject) => {
      uploadStream.on('error', reject);
      uploadStream.on('finish', resolve);
      uploadStream.end(finalBody);
    });

    await cleanupAfterStored();
    
    // Return the new API URL
    res.json({ url: `/api/images/${filename}` });

  } catch (err) {
    console.error('GridFS upload error:', err);
    await cleanupAfterStored();
    res.status(500).json({ error: err?.message || 'Storage upload failed' });
  }
});

module.exports = router;
