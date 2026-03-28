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

function toJpegBuffer(buf) {
  if (Buffer.isBuffer(buf)) return buf;
  if (buf instanceof Uint8Array) return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  return Buffer.from(buf);
}

async function heicBufferToJpeg(buffer) {
  let sharpErr;
  try {
    const sharp = require('sharp');
    const out = await sharp(buffer, { failOn: 'none', sequentialRead: true })
      .rotate()
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    return out;
  } catch (e) {
    sharpErr = e;
  }

  try {
    const convert = require('heic-convert');
    const out = await convert({
      buffer,
      format: 'JPEG',
      quality: 0.88,
    });
    return toJpegBuffer(out);
  } catch (e) {
    console.error('[imageUpload] HEIC→JPEG failed (sharp):', sharpErr?.message || sharpErr);
    console.error('[imageUpload] HEIC→JPEG failed (heic-convert):', e?.message || e);
    const err = new Error(
      'Could not convert HEIC/HEIF to JPEG. Export the photo as JPEG from your device, or try PNG.'
    );
    err.code = 'HEIC_CONVERT_FAILED';
    err.status = 422;
    throw err;
  }
}

/**
 * HEIC/HEIF is always converted to JPEG before storage. Other image types pass through unchanged.
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

  const out = await heicBufferToJpeg(buffer);
  return { buffer: out, contentType: 'image/jpeg', useExtension: '.jpg' };
}

function pickImageExtension(contentType, rawOriginalName, useExtension) {
  if (useExtension) return useExtension;
  const rawExt = path.extname(rawOriginalName || '') || '';
  const ext = (rawExt.startsWith('.') ? rawExt : rawExt ? `.${rawExt}` : '').toLowerCase();
  if (/^\.(jpe?g|png|gif|webp)$/i.test(ext)) return ext;
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  if (ct.includes('png')) return '.png';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('webp')) return '.webp';
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
