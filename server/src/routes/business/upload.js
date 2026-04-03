const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { getCollection } = require('../../mongo');
const { parsePlaceId } = require('../../utils/validate');
const {
  isLikelyVideoUpload,
  multerFileAllowed,
  prepareUploadedImage,
  pickImageExtension,
  VIDEO_MIME_TO_EXT,
} = require('../../utils/imageUpload');
const { getMulterFileSizeLimit } = require('../../utils/uploadLimits');
const { prepareFeedVideoDiskPath } = require('../../utils/feedVideoUploadPrepare');
const { getImageKit } = require('../../utils/imagekit');

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

router.use(authMiddleware, businessPortalMiddleware);

/** POST /api/business/upload — FormData: file, placeId (must be a place you own). */
router.post('/', uploadMw.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const imagekit = getImageKit();
  if (!imagekit) {
    return res.status(500).json({ error: 'ImageKit configuration missing' });
  }

  const parsed = parsePlaceId(req.body?.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'placeId is required' });
  const placeId = parsed.value;

  try {
    const poColl = await getCollection('place_owners');
    const own = await poColl.findOne({ user_id: req.user.userId, place_id: placeId });
    if (!own) return res.status(403).json({ error: 'You do not manage this place' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to verify place ownership' });
  }

  const multerPath = req.file.path;
  let finalFileName;
  let storageFolder = '/tripoli-explorer/business';

  try {
    if (isLikelyVideoUpload(req.file)) {
      const rawExt = path.extname(req.file.originalname) || '';
      const ext = (rawExt.startsWith('.') ? rawExt : rawExt ? `.${rawExt}` : '').toLowerCase();
      const fromMime = VIDEO_MIME_TO_EXT[(req.file.mimetype || '').toLowerCase()] || '.mp4';
      const safeExt = /^\.(mp4|webm|mov|m4v|3gp|3g2|mkv)$/i.test(ext) ? ext : fromMime;
      
      const prep = await prepareFeedVideoDiskPath(multerPath, safeExt, req.file);
      finalFileName = `${crypto.randomBytes(16).toString('hex')}${prep.safeExt || safeExt}`;
      storageFolder = '/tripoli-explorer/videos';

      const uploadResponse = await imagekit.upload({
        file: fs.createReadStream(prep.diskPath),
        fileName: finalFileName,
        folder: storageFolder,
        useUniqueFileName: false,
        customMetadata: { placeId: placeId.toString(), uploadedBy: req.user.userId }
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

      const uploadResponse = await imagekit.upload({
        file: prep.buffer,
        fileName: finalFileName,
        folder: storageFolder,
        useUniqueFileName: false,
        customMetadata: { placeId: placeId.toString(), uploadedBy: req.user.userId }
      });

      return res.json({ url: uploadResponse.url });
    }
  } catch (err) {
    console.error('ImageKit business upload error:', err);
    if (fs.existsSync(multerPath)) await fs.promises.unlink(multerPath).catch(() => {});
    res.status(500).json({ error: err?.message || 'Storage upload failed' });
  }
});

module.exports = router;
