'use strict';

const fs = require('fs');
const { faststartFeedVideoIfApplicable, transcodeReelVideoFromPath } = require('./reelVideoTranscode');

/**
 * All feed video extensions we accept — normalize to one output: H.264/AAC MP4 (web-safe, small, fast encode).
 * Passthrough is only used when ffmpeg is missing or transcode is disabled / fails.
 */
const FEED_VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.3gp', '.3g2']);

async function faststartOrOriginal(multerPath, safeExt) {
  let fastPath = null;
  try {
    fastPath = await faststartFeedVideoIfApplicable(multerPath, safeExt);
  } catch (e) {
    console.warn('[prepareFeedVideoDiskPath] faststart:', e.message);
  }
  if (!fastPath) {
    return {
      diskPath: multerPath,
      cleanupPath: multerPath,
      transcoderCleanup: null,
      safeExt: null,
      contentType: null,
    };
  }
  await fs.promises.unlink(multerPath).catch(() => {});
  return {
    diskPath: fastPath,
    cleanupPath: fastPath,
    transcoderCleanup: null,
    safeExt: null,
    contentType: null,
  };
}

/**
 * After multer saves a feed video: transcode to a single fast, compact H.264 MP4 when possible.
 * @returns {Promise<{ diskPath: string, cleanupPath: string | null, transcoderCleanup: (() => Promise<void>) | null, safeExt: string | null, contentType: string | null }>}
 */
async function prepareFeedVideoDiskPath(multerPath, safeExt, file) {
  const ext = (safeExt || '').toLowerCase();

  if (process.env.DISABLE_REEL_TRANSCODE === '1' || !FEED_VIDEO_EXTENSIONS.has(ext)) {
    return faststartOrOriginal(multerPath, safeExt);
  }

  try {
    const out = await transcodeReelVideoFromPath(multerPath, file?.originalname, file?.mimetype, null);
    if (out) {
      await fs.promises.unlink(multerPath).catch(() => {});
      return {
        diskPath: out.outputPath,
        cleanupPath: null,
        transcoderCleanup: out.cleanup,
        safeExt: out.extension,
        contentType: out.contentType,
      };
    }
  } catch (e) {
    console.warn('[prepareFeedVideoDiskPath] transcode:', e.message);
  }

  return faststartOrOriginal(multerPath, safeExt);
}

module.exports = { prepareFeedVideoDiskPath };
