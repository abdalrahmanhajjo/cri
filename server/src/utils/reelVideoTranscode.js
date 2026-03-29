'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const REEL_TIMEOUT_MS = parseInt(process.env.REEL_TRANSCODE_TIMEOUT_MS || '300000', 10);
const FASTSTART_TIMEOUT_MS = parseInt(process.env.FEED_VIDEO_FASTSTART_TIMEOUT_MS || '120000', 10);

/** Reject transcoded output if larger than input × this (phone masters are often HEAVY compressed — allow a looser ratio so we still emit web-safe H.264). */
const OUTPUT_VS_INPUT_MAX =
  Number.parseFloat(process.env.REEL_TRANSCODE_MAX_OUTPUT_RATIO || '') || 2.5;

/** Prefer system ffmpeg (Docker/Alpine: /usr/bin/ffmpeg); npm installer binary often breaks on musl. */
function resolveFfmpegPath() {
  const explicit = process.env.FFMPEG_PATH?.trim();
  if (explicit && fs.existsSync(explicit)) return explicit;
  const distro = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
  for (const p of distro) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const p = require('@ffmpeg-installer/ffmpeg').path;
    if (p && fs.existsSync(p)) return p;
  } catch (_) {
    /* optional */
  }
  return null;
}

function spawnFfmpeg(ffmpegPath, args, timeoutMs = REEL_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let errBuf = '';
    child.stderr?.on('data', (c) => {
      errBuf += c.toString();
    });
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch (_) {}
      reject(new Error('Reel transcode timed out'));
    }, timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(errBuf.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

function parseDimEnv(name, fallback) {
  const n = parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) && n >= 320 && n <= 4096 ? n : fallback;
}

/**
 * Web feed video: H.264 + AAC, capped resolution, CRF + preset.
 * - force_divisible_by=2 + yuv420p: avoids black frames in browsers on odd dimensions.
 * - Do NOT force bt709/tv metadata: phone HDR / full-range clips often go black or crushed when tagged wrong.
 * - Lanczos scale in-filter only (omit global sws_flags — fewer edge cases across ffmpeg builds).
 * @param {'default' | 'low'} tier — `low` = smaller frame + stronger compression for slow networks (re-encoded from main MP4).
 */
function buildFfmpegArgs(inFile, outFile, withAudio, tier = 'default') {
  const isLow = tier === 'low';
  const maxW = parseDimEnv(isLow ? 'REEL_LOW_MAX_WIDTH' : 'REEL_MAX_WIDTH', isLow ? 540 : 1080);
  const maxH = parseDimEnv(isLow ? 'REEL_LOW_MAX_HEIGHT' : 'REEL_MAX_HEIGHT', isLow ? 960 : 1920);
  const scale = `scale=w='min(${maxW},iw)':h='min(${maxH},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos`;
  const vf = `${scale},setsar=1,format=yuv420p`;
  const crf = (isLow ? process.env.REEL_LOW_TRANSCODE_CRF : process.env.REEL_TRANSCODE_CRF) || (isLow ? '26' : '20');
  const preset =
    (isLow ? process.env.REEL_LOW_TRANSCODE_PRESET : process.env.REEL_TRANSCODE_PRESET) || (isLow ? 'fast' : 'medium');
  const audioK =
    (isLow ? process.env.REEL_LOW_AUDIO_BITRATE : process.env.REEL_AUDIO_BITRATE) || (isLow ? '64k' : '128k');
  const tune = (process.env.REEL_X264_TUNE || '').trim();
  const profile =
    (isLow ? process.env.REEL_LOW_X264_PROFILE : process.env.REEL_X264_PROFILE) || (isLow ? 'main' : 'high');
  const level =
    (isLow ? process.env.REEL_LOW_X264_LEVEL : process.env.REEL_X264_LEVEL) || (isLow ? '4.0' : '4.2');
  const maxrate = ((isLow ? process.env.REEL_LOW_X264_MAXRATE : process.env.REEL_X264_MAXRATE) || '').trim();
  const bufsize = ((isLow ? process.env.REEL_LOW_X264_BUFSIZE : process.env.REEL_X264_BUFSIZE) || '').trim();

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inFile,
    '-c:v',
    'libx264',
    '-profile:v',
    String(profile).trim() || (isLow ? 'main' : 'high'),
    '-level',
    String(level).trim() || (isLow ? '4.0' : '4.2'),
    '-pix_fmt',
    'yuv420p',
    '-preset',
    preset,
  ];
  if (tune) args.push('-tune', tune);
  args.push('-crf', crf, '-vf', vf, '-movflags', '+faststart');
  if (maxrate) {
    args.push('-maxrate', maxrate, '-bufsize', bufsize || '12M');
  }
  if (withAudio) {
    args.push('-c:a', 'aac', '-b:a', audioK, '-ar', '48000');
  } else {
    args.push('-an');
  }
  args.push(outFile);
  return args;
}

/**
 * Run shared web-reel encode (upload + batch). Throws on failure.
 * @param {'default' | 'low'} [tier]
 */
async function runFfmpegWebReelEncode(inputPath, outputPath, tier = 'default') {
  const ffmpegPath = resolveFfmpegPath();
  if (!ffmpegPath) throw new Error('ffmpeg not found');
  const run = async (withAudio) => {
    const args = buildFfmpegArgs(inputPath, outputPath, withAudio, tier);
    await spawnFfmpeg(ffmpegPath, args);
  };
  try {
    await run(true);
  } catch (e1) {
    await run(false);
  }
}

/** Second pass: smaller file for slow Wi‑Fi / Save-Data (encoded from main web MP4). */
async function encodeLowRenditionFromHighMp4(highPath, lowPath) {
  await fs.promises.unlink(lowPath).catch(() => {});
  await runFfmpegWebReelEncode(highPath, lowPath, 'low');
  const st = await fs.promises.stat(lowPath);
  if (!st.size) throw new Error('empty low rendition');
}

/**
 * Encode an on-disk video to optimized MP4. Returns size stats; caller decides whether to use output.
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {{ maxOutputVsInput?: number }} [opts] maxOutputVsInput default REEL_TRANSCODE_MAX_OUTPUT_RATIO / OUTPUT_VS_INPUT_MAX
 * @returns {Promise<{ ok: boolean, bytesIn: number, bytesOut: number, reason?: string }>}
 */
async function encodeFileToWebReelMp4(inputPath, outputPath, opts = {}) {
  const maxRatio = opts.maxOutputVsInput ?? OUTPUT_VS_INPUT_MAX;
  let bytesIn = 0;
  try {
    bytesIn = (await fs.promises.stat(inputPath)).size;
  } catch (_) {
    return { ok: false, bytesIn: 0, bytesOut: 0, reason: 'stat input failed' };
  }
  try {
    await fs.promises.unlink(outputPath).catch(() => {});
    await runFfmpegWebReelEncode(inputPath, outputPath);
  } catch (e) {
    return { ok: false, bytesIn, bytesOut: 0, reason: e.message || 'ffmpeg failed' };
  }
  let bytesOut = 0;
  try {
    bytesOut = (await fs.promises.stat(outputPath)).size;
  } catch (_) {
    return { ok: false, bytesIn, bytesOut: 0, reason: 'no output file' };
  }
  if (!bytesOut) return { ok: false, bytesIn, bytesOut: 0, reason: 'empty output' };
  if (bytesOut > bytesIn * maxRatio) {
    await fs.promises.unlink(outputPath).catch(() => {});
    return { ok: false, bytesIn, bytesOut, reason: `output larger than input (ratio ${(bytesOut / bytesIn).toFixed(2)} > ${maxRatio})` };
  }
  return { ok: true, bytesIn, bytesOut };
}

/**
 * Transcode any feed-bucket video upload to H.264/AAC MP4 (reels and "video" posts).
 * Caller must delete `inputPath` after success. Call `cleanup()` after reading/uploading `outputPath`.
 * When enabled, also writes `lowOutputPath` (companion `*-lb.mp4` for slow networks).
 * @returns {Promise<{ outputPath: string, lowOutputPath: string | null, contentType: string, extension: string, cleanup: () => Promise<void> } | null>}
 */
async function transcodeReelVideoFromPath(inputPath, originalname, mimetype, body) {
  if (process.env.DISABLE_REEL_TRANSCODE === '1') return null;
  if (!inputPath || !fs.existsSync(inputPath)) return null;

  const maxMb = parseInt(process.env.REEL_TRANSCODE_MAX_INPUT_MB || '0', 10);
  if (maxMb > 0) {
    try {
      const st = await fs.promises.stat(inputPath);
      if (st.size > maxMb * 1024 * 1024) {
        console.warn(
          `[reelTranscode] skipping transcode: ${(st.size / (1024 * 1024)).toFixed(1)}MB > REEL_TRANSCODE_MAX_INPUT_MB=${maxMb}`
        );
        return null;
      }
    } catch (_) {
      /* continue */
    }
  }

  const ffmpegPath = resolveFfmpegPath();
  if (!ffmpegPath) {
    console.warn('[reelTranscode] ffmpeg not found; set FFMPEG_PATH or keep @ffmpeg-installer/ffmpeg installed');
    return null;
  }

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'visit-reel-'));
  const outFile = path.join(tmpDir, 'out.mp4');

  const cleanup = async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  };

  try {
    const result = await encodeFileToWebReelMp4(inputPath, outFile, { maxOutputVsInput: OUTPUT_VS_INPUT_MAX });
    if (!result.ok) {
      console.warn('[reelTranscode]', result.reason || 'encode rejected');
      await cleanup();
      return null;
    }

    let lowOutputPath = null;
    if (process.env.REEL_ENABLE_LOW_RENDITION !== '0') {
      const outLow = path.join(tmpDir, 'out-lb.mp4');
      try {
        await encodeLowRenditionFromHighMp4(outFile, outLow);
        lowOutputPath = outLow;
      } catch (e) {
        console.warn('[reelTranscode] low rendition skipped:', e.message || e);
      }
    }

    return {
      outputPath: outFile,
      lowOutputPath,
      contentType: 'video/mp4',
      extension: '.mp4',
      cleanup,
    };
  } catch (e) {
    console.warn('[reelTranscode]', e.message);
    await cleanup();
    return null;
  }
}

/**
 * Normalize feed video buffer to H.264 MP4 (same pipeline as disk-path upload). Falls back to null on failure.
 * @returns {Promise<{ buffer: Buffer, contentType: string, extension: string } | null>}
 */
async function transcodeReelVideoIfNeeded(buffer, originalname, mimetype, body) {
  if (process.env.DISABLE_REEL_TRANSCODE === '1') return null;
  if (!buffer || buffer.length < 1) return null;

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'visit-reel-in-'));
  const inExt = path.extname(originalname || '') || '.mp4';
  const inFile = path.join(tmpDir, `src${inExt}`);

  try {
    await fs.promises.writeFile(inFile, buffer);
    const out = await transcodeReelVideoFromPath(inFile, originalname, mimetype, body);
    if (!out) return null;
    try {
      const outBuf = await fs.promises.readFile(out.outputPath);
      return {
        buffer: outBuf,
        contentType: out.contentType,
        extension: out.extension,
      };
    } finally {
      await out.cleanup();
    }
  } catch (e) {
    console.warn('[reelTranscode]', e.message);
    return null;
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Remux MP4/MOV for progressive playback: move moov to file start (-c copy, no re-encode or resize).
 * Browser "takes forever to start" is often moov-at-end phone exports; this fixes that.
 * @param {string} inputPath
 * @param {string} safeExt extension with dot, e.g. ".mp4"
 * @returns {Promise<string | null>} new temp path, or null to keep inputPath
 */
async function faststartFeedVideoIfApplicable(inputPath, safeExt) {
  if (process.env.FEED_VIDEO_FASTSTART === '0') return null;
  const ext = (safeExt || '').toLowerCase();
  if (!['.mp4', '.m4v', '.mov'].includes(ext)) return null;

  const ffmpegPath = resolveFfmpegPath();
  if (!ffmpegPath) return null;

  const maxMb = parseInt(process.env.FEED_VIDEO_FASTSTART_MAX_INPUT_MB || '0', 10);
  if (maxMb > 0) {
    try {
      const st = await fs.promises.stat(inputPath);
      if (st.size > maxMb * 1024 * 1024) {
        console.warn(`[feedVideoFaststart] skip: larger than FEED_VIDEO_FASTSTART_MAX_INPUT_MB=${maxMb}`);
        return null;
      }
    } catch (_) {
      return null;
    }
  }

  const outPath = path.join(
    os.tmpdir(),
    `visit-faststart-${crypto.randomBytes(12).toString('hex')}${ext}`
  );
  try {
    await spawnFfmpeg(
      ffmpegPath,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        inputPath,
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        outPath,
      ],
      FASTSTART_TIMEOUT_MS
    );
    const stOut = await fs.promises.stat(outPath);
    if (stOut.size < 256) {
      await fs.promises.unlink(outPath).catch(() => {});
      return null;
    }
    return outPath;
  } catch (e) {
    console.warn('[feedVideoFaststart]', e.message);
    await fs.promises.unlink(outPath).catch(() => {});
    return null;
  }
}

module.exports = {
  resolveFfmpegPath,
  buildFfmpegArgs,
  runFfmpegWebReelEncode,
  encodeFileToWebReelMp4,
  encodeLowRenditionFromHighMp4,
  transcodeReelVideoFromPath,
  transcodeReelVideoIfNeeded,
  faststartFeedVideoIfApplicable,
};
