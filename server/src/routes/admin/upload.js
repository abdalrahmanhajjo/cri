const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { getImageKit } = require('../../utils/imagekit');

// ... (Multer config remains the same) ...

/** POST /api/admin/upload - Use ImageKit for cloud storage */
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const imagekit = getImageKit();
  if (!imagekit) {
    return res.status(500).json({ error: 'ImageKit is not configured. Please set credentials in .env' });
  }

  const multerPath = req.file.path;
  let uploadBuffer = null;
  let uploadStream = null;
  let storageFolder = '/tripoli-explorer/admin';
  let finalFileName;

  try {
    if (isLikelyVideoUpload(req.file)) {
      const rawExt = path.extname(req.file.originalname) || '';
      const ext = (rawExt.startsWith('.') ? rawExt : rawExt ? `.${rawExt}` : '').toLowerCase();
      const fromMime = VIDEO_MIME_TO_EXT[(req.file.mimetype || '').toLowerCase()] || '.mp4';
      const safeExt = /^\.(mp4|webm|mov|m4v|3gp|3g2|mkv)$/i.test(ext) ? ext : fromMime;
      
      const prep = await prepareFeedVideoDiskPath(multerPath, safeExt, req.file);
      uploadStream = fs.createReadStream(prep.diskPath);
      storageFolder = '/tripoli-explorer/videos';
      finalFileName = `${crypto.randomBytes(16).toString('hex')}${prep.safeExt || safeExt}`;
      
      // Cleanup logic for videos
      const originalCleanup = async () => {
        if (prep.cleanupPath) await fs.promises.unlink(prep.cleanupPath).catch(() => {});
        if (prep.transcoderCleanup) await prep.transcoderCleanup().catch(() => {});
      };
      
      const uploadResponse = await imagekit.upload({
        file: uploadStream,
        fileName: finalFileName,
        folder: storageFolder,
        useUniqueFileName: false
      });

      await originalCleanup();
      return res.json({ url: uploadResponse.url });

    } else {
      uploadBuffer = await fs.promises.readFile(multerPath);
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
    console.error('ImageKit upload error:', err);
    // Best-effort cleanup
    if (fs.existsSync(multerPath)) await fs.promises.unlink(multerPath).catch(() => {});
    res.status(500).json({ error: err?.message || 'Production storage upload failed' });
  }
});

module.exports = router;
