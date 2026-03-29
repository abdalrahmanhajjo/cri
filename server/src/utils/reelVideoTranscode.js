'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const REEL_TIMEOUT_MS = parseInt(process.env.REEL_TRANSCODE_TIMEOUT_MS || '300000', 10);

/** Reject transcoded output if larger than input × this (saves CPU when source is already efficient). */
const OUTPUT_VS_INPUT_MAX =
  Number.parseFloat(process.env.REEL_TRANSCODE_MAX_OUTPUT_RATIO || '') || 1.25;

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

function spawnFfmpeg(ffmpegPath, args) {
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
    }, REEL_TIMEOUT_MS);
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
 * Web-optimized reel: H.264 + AAC, capped resolution, CRF + fast preset.
 * force_divisible_by=2 + format=yuv420p: odd sizes with yuv420p often decode as black in browsers.
 * main@L4.1 + bt709 tagging: broad mobile/Desktop compatibility (phone HDR/HEVC sources).
 */
function buildFfmpegArgs(inFile, outFile, withAudio) {
  const maxW = parseDimEnv('REEL_MAX_WIDTH', 720);
  const maxH = parseDimEnv('REEL_MAX_HEIGHT', 1280);
  const scale = `scale=w='min(${maxW},iw)':h='min(${maxH},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`;
  const vf = `${scale},setsar=1,format=yuv420p`;
  const crf = process.env.REEL_TRANSCODE_CRF || '24';
  const preset = process.env.REEL_TRANSCODE_PRESET || 'fast';
  const audioK = process.env.REEL_AUDIO_BITRATE || '96k';
  const tune = (process.env.REEL_X264_TUNE || '').trim();

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inFile,
    '-sws_flags',
    'lanczos+accurate_rnd+full_chroma_int',
    '-c:v',
    'libx264',
    '-profile:v',
    'main',
    '-level',
    '4.1',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    crf,
    '-preset',
    preset,
    '-vf',
    vf,
    '-color_range',
    'tv',
    '-colorspace',
    'bt709',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-movflags',
    '+faststart',
  ];
  if (tune) {
    const vfIdx = args.indexOf('-vf');
    if (vfIdx !== -1) args.splice(vfIdx, 0, '-tune', tune);
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
 */
async function runFfmpegWebReelEncode(inputPath, outputPath) {
  const ffmpegPath = resolveFfmpegPath();
  if (!ffmpegPath) throw new Error('ffmpeg not found');
  const run = async (withAudio) => {
    const args = buildFfmpegArgs(inputPath, outputPath, withAudio);
    await spawnFfmpeg(ffmpegPath, args);
  };
  try {
    await run(true);
  } catch (e1) {
    await run(false);
  }
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
 * @returns {Promise<{ outputPath: string, contentType: string, extension: string, cleanup: () => Promise<void> } | null>}
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

    return {
      outputPath: outFile,
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

module.exports = {
  resolveFfmpegPath,
  buildFfmpegArgs,
  runFfmpegWebReelEncode,
  encodeFileToWebReelMp4,
  transcodeReelVideoFromPath,
  transcodeReelVideoIfNeeded,
};
