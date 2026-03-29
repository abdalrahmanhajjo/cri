#!/usr/bin/env node
/**
 * Re-encode existing feed_posts videos with the same pipeline as reel uploads (smaller H.264/AAC MP4).
 *
 * Requires: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY), local ffmpeg or FFMPEG_PATH
 *
 * Usage:
 *   node scripts/recompress-feed-reel-videos.js           # process all reel/video rows with video_url
 *   node scripts/recompress-feed-reel-videos.js --dry-run
 *   node scripts/recompress-feed-reel-videos.js --limit 10
 *
 * Only replaces files in Supabase Storage (URL contains /storage/v1/object/public/place-images/).
 * Skips rows if the optimized file is not smaller than the original (after ratio check).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const { encodeFileToWebReelMp4 } = require('../src/utils/reelVideoTranscode');

const BUCKET = 'place-images';

function parseArgs() {
  const out = { dryRun: false, limit: 0 };
  for (let i = 2; i < process.argv.length; i += 1) {
    const a = process.argv[i];
    if (a === '--dry-run') out.dryRun = true;
    if (a === '--limit' && process.argv[i + 1]) {
      out.limit = parseInt(process.argv[i + 1], 10) || 0;
      i += 1;
    }
  }
  return out;
}

function storageObjectFromPublicUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const u = urlStr.trim().split('?')[0];
  const marker = '/storage/v1/object/public/';
  const idx = u.indexOf(marker);
  if (idx === -1) return null;
  const rest = u.slice(idx + marker.length);
  const slash = rest.indexOf('/');
  if (slash === -1) return null;
  const bucket = rest.slice(0, slash);
  const objectPath = rest.slice(slash + 1);
  if (!objectPath || bucket !== BUCKET) return null;
  return { bucket, path: objectPath };
}

function downloadToFile(urlStr, destPath) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const f = fs.createWriteStream(destPath);
    const req = lib.get(urlStr, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        f.close();
        fs.unlinkSync(destPath);
        if (!loc) return reject(new Error('redirect without location'));
        return resolve(downloadToFile(loc, destPath));
      }
      if (res.statusCode !== 200) {
        f.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(f);
      f.on('finish', () => {
        f.close(() => resolve());
      });
    });
    req.on('error', (e) => {
      f.close();
      fs.unlink(destPath, () => reject(e));
    });
  });
}

async function main() {
  const { dryRun, limit } = parseArgs();
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const supUrl = process.env.SUPABASE_URL?.trim();
  const supKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
  if (!supUrl || !supKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Storage upload');
    process.exit(1);
  }

  const supabase = createClient(supUrl, supKey);
  let pgConn = dbUrl;
  if (pgConn.includes('supabase')) {
    try {
      const u = new URL(pgConn);
      u.searchParams.delete('sslmode');
      pgConn = u.toString();
    } catch (_) {
      /* keep */
    }
  }
  const pg = new Client({
    connectionString: pgConn,
    ssl: dbUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });
  await pg.connect();

  let sql = `
    SELECT id, video_url, type
    FROM feed_posts
    WHERE video_url IS NOT NULL
      AND trim(video_url) <> ''
    ORDER BY created_at ASC
  `;
  const params = [];
  if (limit > 0) {
    sql += ' LIMIT $1';
    params.push(limit);
  }
  const { rows } = await pg.query(sql, params);
  console.log(`Found ${rows.length} posts with video_url`);

  const tmpBase = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reel-recompress-'));
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const row of rows) {
      const url = String(row.video_url || '').trim();
      const obj = storageObjectFromPublicUrl(url);
      if (!obj) {
        console.log(`[skip] ${row.id} not a Supabase public URL in ${BUCKET}: ${url.slice(0, 80)}…`);
        skipped += 1;
        continue;
      }
      const inPath = path.join(tmpBase, `in-${row.id}.raw`);
      const outPath = path.join(tmpBase, `out-${row.id}.mp4`);
      try {
        await fs.promises.unlink(inPath).catch(() => {});
        await fs.promises.unlink(outPath).catch(() => {});
        console.log(`[fetch] ${row.id} ${url.slice(0, 60)}…`);
        await downloadToFile(url, inPath);
        const st = await fs.promises.stat(inPath);
        if (!st.size) throw new Error('empty download');

        const enc = await encodeFileToWebReelMp4(inPath, outPath, {});
        await fs.promises.unlink(inPath).catch(() => {});
        if (!enc.ok) {
          console.warn(`[skip] ${row.id} ${enc.reason}`);
          await fs.promises.unlink(outPath).catch(() => {});
          skipped += 1;
          continue;
        }
        const savings = (((enc.bytesIn - enc.bytesOut) / enc.bytesIn) * 100).toFixed(1);
        console.log(`[encode] ${row.id} ${enc.bytesIn} → ${enc.bytesOut} bytes (${savings}% smaller)`);

        if (dryRun) {
          await fs.promises.unlink(outPath).catch(() => {});
          ok += 1;
          continue;
        }

        const body = await fs.promises.readFile(outPath);
        await fs.promises.unlink(outPath).catch(() => {});

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(obj.path, body, {
          contentType: 'video/mp4',
          upsert: true,
        });
        if (upErr) {
          console.error(`[fail] ${row.id} upload:`, upErr.message);
          failed += 1;
          continue;
        }
        /* Public URL unchanged when path unchanged */
        ok += 1;
        console.log(`[ok] ${row.id} replaced ${obj.path}`);
      } catch (e) {
        console.error(`[fail] ${row.id}`, e.message || e);
        failed += 1;
        await fs.promises.unlink(inPath).catch(() => {});
        await fs.promises.unlink(outPath).catch(() => {});
      }
    }
  } finally {
    await fs.promises.rm(tmpBase, { recursive: true, force: true }).catch(() => {});
    await pg.end();
  }

  console.log(`Done. updated: ${ok}, skipped: ${skipped}, failed: ${failed}${dryRun ? ' (dry-run)' : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
