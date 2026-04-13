const ImageKit = require('imagekit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const {
  IMAGEKIT_PUBLIC_KEY,
  IMAGEKIT_PRIVATE_KEY,
  IMAGEKIT_URL_ENDPOINT
} = process.env;

let imagekit = null;

function getImageKit() {
  if (imagekit) return imagekit;

  if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) {
    console.warn('Warning: ImageKit credentials not fully configured in .env');
    return null;
  }

  imagekit = new ImageKit({
    publicKey: IMAGEKIT_PUBLIC_KEY,
    privateKey: IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: IMAGEKIT_URL_ENDPOINT
  });

  return imagekit;
}

/**
 * ImageKit rejects uploads when `customMetadata` keys are not registered on the account.
 * Retry without metadata so uploads still succeed (same pattern as profile avatars).
 * @param {import('imagekit').ImageKit} imagekit
 * @param {Record<string, unknown>} uploadPayload
 */
async function uploadImageKitWithMetadataFallback(imagekit, uploadPayload) {
  try {
    return await imagekit.upload(uploadPayload);
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    if (!msg.includes('invalid custom metadata')) throw err;
    const { customMetadata: _omit, ...withoutCustomMetadata } = uploadPayload;
    return imagekit.upload(withoutCustomMetadata);
  }
}

module.exports = { getImageKit, uploadImageKitWithMetadataFallback };
