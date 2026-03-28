/**
 * Build `public/city-{width}.webp` from `public/city.png` (PNG stays as `<img>` fallback).
 * Widths must match `src/constants/cityHero.js` → `CITY_HERO_WEBP_WIDTHS`.
 * Run: npm run optimize:city --prefix client
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const srcPath = join(publicDir, 'city.png');

/** @type {number[]} */
const TARGET_WIDTHS = [480, 640, 960, 1024];

const buf = await readFile(srcPath);
const meta = await sharp(buf).metadata();
const origW = meta.width || 1024;

const widths = [...new Set(TARGET_WIDTHS.filter((w) => w <= origW))].sort((a, b) => a - b);
if (widths.length === 0) {
  widths.push(Math.min(origW, TARGET_WIDTHS[TARGET_WIDTHS.length - 1]));
}

let totalWebp = 0;
for (const width of widths) {
  const webpBuf = await sharp(buf)
    .resize(width, null, { withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 78, effort: 6 })
    .toBuffer();
  await writeFile(join(publicDir, `city-${width}.webp`), webpBuf);
  totalWebp += webpBuf.length;
}

const kb = (n) => `${(n / 1024).toFixed(1)} KiB`;
console.log(
  `city hero: PNG source ${kb(buf.length)} → ${widths.length} WebP variants (${widths.join(', ')}px), total ${kb(totalWebp)}`
);
