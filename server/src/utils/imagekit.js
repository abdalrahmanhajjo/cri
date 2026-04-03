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

module.exports = { getImageKit };
