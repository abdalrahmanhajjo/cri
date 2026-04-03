const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { getImageKit } = require('../../utils/imagekit');
const {
  isLikelyVideoUpload,
  multerFileAllowed,
  prepareUploadedImage,
  pickImageExtension,
  VIDEO_MIME_TO_EXT,
} = require('../../utils/imageUpload');
const { getMulterFileSizeLimit } = require('../../utils/uploadLimits');
const { prepareFeedVideoDiskPath } = require('../../utils/feedVideoUploadPrepare');

const router = express.Router();
const MULTER_TMP = path.join(os.tmpdir(), 'visit-multer-uploads');

try {
  if (!fs.existsSync(MULTER_TMP)) {
    fs.mkdirSync(MULTER_TMP, { recursive: true });
  }
} catch (_) {}

const multerFileLimits = getMulterFileSizeLimit();
const uploadMw = multer({
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

/** POST /api/admin/upload - Use ImageKit for cloud storage */
router.post('/', uploadMw.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const imagekit = getImageKit();
  if (!imagekit) {
    return res.status(500).json({ error: 'ImageKit is not configured. Please set credentials in .env' });
  }

  const multerPath = req.file.path;
  let finalFileName;
  let storageFolder = '/tripoli-explorer/admin';

  try {
    if (isLikelyVideoUpload(req.file)) {
      const rawExt = path.extname(req.file.originalname) || '';
      const ext = (rawExt.startsWith('.') ? rawExt : rawExt ? `.${rawExt}` : '').toLowerCase();
      const fromMime = VIDEO_MIME_TO_EXT[(req.file.mimetype || '').toLowerCase()] || '.mp4';
      const safeExt = /^\.(mp4|webm|mov|m4v|3gp|3g2|mkv)$/i.test(ext) ? ext : fromMime;
      
      const prep = await prepareFeedVideoDiskPath(multerPath, safeExt, req.file);
      storageFolder = '/tripoli-explorer/videos';
      finalFileName = `${crypto.randomBytes(16).toString('hex')}${prep.safeExt || safeExt}`;
      
      const uploadResponse = await imagekit.upload({
        file: fs.createReadStream(prep.diskPath),
        fileName: finalFileName,
        folder: storageFolder,
        useUniqueFileName: false
      });

      // Cleanup
      if (prep.cleanupPath) await fs.promises.unlink(prep.cleanupPath).catch(() => {});
      if (prep.transcoderCleanup) await prep.transcoderCleanup().catch(() => {});

      return res.json({ url: uploadResponse.url });

    } else {
      const uploadBuffer = await fs.promises.readFile(multerPath);
      await fs.promises.unlink(multerPath).catch(() => {});
      
      const prep = await prepareUploadedImage(uploadBuffer, req.file.mimetype, req.file.originalname);
      const safeExt = pickImageExtension(prep.contentType, req.file.originalname, prep.useExtension);
      finalFileName = `${crypto.randomBytes(16).toString('hex')}${safeExt}`;
      storageFolder = '/tripoli-explorer/places';

      const uploadResponse = await imagekit.upload({
        file: prep.buffer,
        fileName: finalFileName,
        folder: storageFolder,
        useUniqueFileName: false
      });

      return res.json({ url: uploadResponse.url });
    }
  } catch (err) {
    console.error('ImageKit admin upload error:', err);
    if (fs.existsSync(multerPath)) await fs.promises.unlink(multerPath).catch(() => {});
    res.status(500).json({ error: err?.message || 'Production storage upload failed' });
  }
});

module.exports = router;
