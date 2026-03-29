'use strict';

const fs = require('fs');
const { faststartFeedVideoIfApplicable } = require('./reelVideoTranscode');

/**
 * After multer saves a feed video, optionally remux for web streaming (faststart, stream copy only).
 * @returns {Promise<{ diskPath: string, cleanupPath: string }>}
 */
async function prepareFeedVideoDiskPath(multerPath, safeExt) {
  let fastPath = null;
  try {
    fastPath = await faststartFeedVideoIfApplicable(multerPath, safeExt);
  } catch (e) {
    console.warn('[prepareFeedVideoDiskPath]', e.message);
  }
  if (!fastPath) {
    return { diskPath: multerPath, cleanupPath: multerPath };
  }
  await fs.promises.unlink(multerPath).catch(() => {});
  return { diskPath: fastPath, cleanupPath: fastPath };
}

module.exports = { prepareFeedVideoDiskPath };
