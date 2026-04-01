'use strict';

const fs = require('fs');
const { faststartFeedVideoIfApplicable, transcodeReelVideoFromPath } = require('./reelVideoTranscode');

/**
 * Extensions we accept for feed uploads.
 * Full H.264 transcode is heavy and can hit reverse-proxy timeouts (e.g. ~100s) on large files.
 * • .mp4 / .m4v → stream-copy + faststart only (fast, avoids timeouts; use H.264 from the device when possible).
 * • .mov / .webm / .mkv / .3gp / .3g2 → full transcode to web MP4 (HEVC/VP9/QuickTime fix for Chrome).
 * Set FEED_VIDEO_ALWAYS_TRANSCODE=1 to force full transcode on .mp4/.m4v as well (slower).
 */
const FEED_VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.3gp', '.3g2']);
const NEEDS_FULL_TRANSCODE = new Set(['.mov', '.webm', '.mkv', '.3gp', '.3g2']);

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
 * After multer saves a feed video: full transcode when required, else faststart-only for MP4-class uploads.
 * @returns {Promise<{ diskPath: string, cleanupPath: string | null, transcoderCleanup: (() => Promise<void>) | null, safeExt: string | null, contentType: string | null }>}
 */
async function prepareFeedVideoDiskPath(multerPath, safeExt, file) {
  const ext = (safeExt || '').toLowerCase();

  if (process.env.DISABLE_REEL_TRANSCODE === '1' || !FEED_VIDEO_EXTENSIONS.has(ext)) {
    return faststartOrOriginal(multerPath, safeExt);
  }

  const forceFull =
    process.env.FEED_VIDEO_ALWAYS_TRANSCODE === '1' || NEEDS_FULL_TRANSCODE.has(ext);

  if (!forceFull) {
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
