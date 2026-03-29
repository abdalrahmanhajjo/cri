'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const REEL_TIMEOUT_MS = parseInt(process.env.REEL_TRANSCODE_TIMEOUT_MS || '300000', 10);

function isReelUploadPurpose(body) {
  if (!body || typeof body !== 'object') return false;
  const p = String(body.purpose || body.uploadPurpose || '').toLowerCase().trim();
  return p === 'reel';
}

function resolveFfmpegPath() {
  const explicit = process.env.FFMPEG_PATH?.trim();
  if (explicit && fs.existsSync(explicit)) return explicit;
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

function buildFfmpegArgs(inFile, outFile, withAudio) {
  const vf =
    "scale=w='min(1080,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease";
  const crf = process.env.REEL_TRANSCODE_CRF || '22';
  const preset = process.env.REEL_TRANSCODE_PRESET || 'medium';
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
    'high',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    crf,
    '-preset',
    preset,
    '-vf',
    vf,
    '-movflags',
    '+faststart',
  ];
  if (withAudio) {
    args.push('-c:a', 'aac', '-b:a', '128k');
  } else {
    args.push('-an');
  }
  args.push(outFile);
  return args;
}

/**
 * When `purpose=reel` on multipart upload: normalize to H.264 MP4, cap long edge for web reels,
 * AAC audio (or none), faststart for streaming. Falls back to original buffer on any failure.
 * @returns {Promise<{ buffer: Buffer, contentType: string, extension: string } | null>}
 */
async function transcodeReelVideoIfNeeded(buffer, originalname, mimetype, body) {
  if (process.env.DISABLE_REEL_TRANSCODE === '1') return null;
  if (!isReelUploadPurpose(body)) return null;
  if (!buffer || buffer.length < 1) return null;

  const ffmpegPath = resolveFfmpegPath();
  if (!ffmpegPath) {
    console.warn('[reelTranscode] ffmpeg not found; set FFMPEG_PATH or keep @ffmpeg-installer/ffmpeg installed');
    return null;
  }

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'visit-reel-'));
  const inExt = path.extname(originalname || '') || '.mp4';
  const inFile = path.join(tmpDir, `src${inExt}`);
  const outFile = path.join(tmpDir, 'out.mp4');

  try {
    await fs.promises.writeFile(inFile, buffer);

    const run = async (withAudio) => {
      const args = buildFfmpegArgs(inFile, outFile, withAudio);
      await spawnFfmpeg(ffmpegPath, args);
    };

    try {
      await run(true);
    } catch (e1) {
      await run(false);
    }

    const outBuf = await fs.promises.readFile(outFile);
    if (!outBuf.length) throw new Error('empty transcoder output');

    const ratio = outBuf.length / buffer.length;
    if (ratio > 1.2) {
      console.warn('[reelTranscode] output > 120% of input; keeping original');
      return null;
    }

    return {
      buffer: outBuf,
      contentType: 'video/mp4',
      extension: '.mp4',
    };
  } catch (e) {
    console.warn('[reelTranscode]', e.message);
    return null;
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  isReelUploadPurpose,
  transcodeReelVideoIfNeeded,
};
