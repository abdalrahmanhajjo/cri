/**
 * Rasterize public/tripoli-lebanon-icon.svg → favicon.ico, PWA icons, Apple touch icon.
 * Run from repo: npm run favicons --prefix client
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const svgPath = path.join(publicDir, 'tripoli-lebanon-icon.svg');

async function main() {
  if (!fs.existsSync(svgPath)) {
    console.error('Missing', svgPath);
    process.exit(1);
  }

  const icoSizes = [16, 32, 48];
  const icoBuffers = [];
  for (const s of icoSizes) {
    icoBuffers.push(await sharp(svgPath).resize(s, s).png().toBuffer());
  }
  const icoOut = await pngToIco(icoBuffers);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoOut);

  await sharp(svgPath).resize(48, 48).png().toFile(path.join(publicDir, 'favicon-48.png'));
  await sharp(svgPath).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(svgPath).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'));
  await sharp(svgPath).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'));

  console.log('Wrote favicon.ico, favicon-48.png, apple-touch-icon.png, icon-192.png, icon-512.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
