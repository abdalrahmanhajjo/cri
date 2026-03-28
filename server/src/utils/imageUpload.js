const path = require('path');

const VIDEO_MIME_TO_EXT = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-m4v': '.m4v',
};

function isImageMime(m) {
  return /^image\/(jpeg|png|gif|webp|heic|heif)(-sequence)?$/i.test(m || '');
}

function isVideoMime(m) {
  return /^video\/(mp4|webm|quicktime|x-m4v)$/i.test(m || '');
}

function isHeicByFilename(name) {
  const n = (name || '').toLowerCase();
  return n.endsWith('.heic') || n.endsWith('.heif');
}

/** Multer fileFilter: images (incl. HEIC) + short videos. */
function multerFileAllowed(file) {
  if (isVideoMime(file.mimetype)) return true;
  if (isImageMime(file.mimetype)) return true;
  const m = (file.mimetype || '').toLowerCase();
  if (isHeicByFilename(file.originalname) && (m === 'application/octet-stream' || m === '')) return true;
  return false;
}

/**
 * HEIC/HEIF → JPEG when sharp/libvips supports it (typical on Linux/macOS Windows prebuilds).
 * On failure, returns original buffer so upload still succeeds (some clients may not display .heic URLs).
 */
async function prepareUploadedImage(buffer, mimetype, originalname) {
  const ext = path.extname(originalname || '').toLowerCase();
  const m = (mimetype || '').toLowerCase();
  const looksHeic =
    /^image\/(heic|heif)(-sequence)?$/i.test(m) ||
    (m === 'application/octet-stream' && isHeicByFilename(originalname)) ||
    ext === '.heic' ||
    ext === '.heif';

  if (!looksHeic) {
    return { buffer, contentType: mimetype, useExtension: null };
  }

  try {
    const sharp = require('sharp');
    const out = await sharp(buffer, { failOn: 'none' }).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return { buffer: out, contentType: 'image/jpeg', useExtension: '.jpg' };
  } catch (e) {
    console.warn('[imageUpload] HEIC→JPEG conversion failed, storing original:', e.message);
    return {
      buffer,
      contentType: /^image\//i.test(mimetype || '') ? mimetype : 'image/heic',
      useExtension: ext === '.heif' ? '.heif' : '.heic',
    };
  }
}

function pickImageExtension(contentType, rawOriginalName, useExtension) {
  if (useExtension) return useExtension;
  const rawExt = path.extname(rawOriginalName || '') || '';
  const ext = (rawExt.startsWith('.') ? rawExt : rawExt ? `.${rawExt}` : '').toLowerCase();
  if (/^\.(jpe?g|png|gif|webp|heic|heif)$/i.test(ext)) return ext;
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  if (ct.includes('png')) return '.png';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('heif')) return '.heif';
  if (ct.includes('heic')) return '.heic';
  return '.jpg';
}

module.exports = {
  isImageMime,
  isVideoMime,
  multerFileAllowed,
  prepareUploadedImage,
  pickImageExtension,
  VIDEO_MIME_TO_EXT,
};
