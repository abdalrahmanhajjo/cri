'use strict';

const fs = require('fs');
const { faststartFeedVideoIfApplicable, transcodeReelVideoFromPath } = require('./reelVideoTranscode');

/**
 * Containers often produced by phones (MOV/3GP/MKV) usually hold HEVC or non–web-safe
 * codecs: Chrome/Firefox play audio but show a black picture. Transcode those to H.264 MP4.
 * MP4/WebM stay passthrough (+ faststart for mp4/m4v/mov when copy is enough).
 */
const TRANSCODE_TO_WEB_MP4 = new Set(['.mov', '.mkv', '.3gp', '.3g2']);

/**
 * After multer saves a feed video, transcode phone containers or remux for faststart.
 * @returns {Promise<{ diskPath: string, cleanupPath: string | null, transcoderCleanup: (() => Promise<void>) | null, safeExt: string | null, contentType: string | null }>}
 */
async function prepareFeedVideoDiskPath(multerPath, safeExt, file) {
  const ext = (safeExt || '').toLowerCase();

  if (TRANSCODE_TO_WEB_MP4.has(ext) && process.env.DISABLE_REEL_TRANSCODE !== '1') {
    try {
      const out = await transcodeReelVideoFromPath(
        multerPath,
        file?.originalname,
        file?.mimetype,
        null
      );
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
  }

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

module.exports = { prepareFeedVideoDiskPath };
