/**
 * Generates tiny looping Lottie JSON files (rounded-rect “pulse”) per visual family.
 * These are placeholders so every icon is animated; replace with Flaticon animated
 * exports (Lottie JSON) in src/assets/flaticon-overrides/{materialName}.json when licensed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function hexToRgb01(hex) {
  const n = hex.replace('#', '');
  return [parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255];
}

function makePulse(hex) {
  const [r, g, b] = hexToRgb01(hex);
  return {
    v: '5.7.4',
    fr: 60,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    nm: 'pulse-placeholder',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'mark',
        sr: 1,
        ks: {
          o: { a: 0, k: 100, ix: 11 },
          r: { a: 0, k: 0, ix: 10 },
          p: { a: 0, k: [256, 256, 0], ix: 2 },
          a: { a: 0, k: [0, 0, 0], ix: 1 },
          s: {
            a: 1,
            k: [
              {
                i: { x: [0.42, 0.42, 0.667], y: [1, 1, 1] },
                o: { x: [0.58, 0.58, 0.333], y: [0, 0, 0] },
                t: 0,
                s: [72, 72, 100],
              },
              {
                i: { x: [0.42, 0.42, 0.667], y: [1, 1, 1] },
                o: { x: [0.58, 0.58, 0.333], y: [0, 0, 0] },
                t: 30,
                s: [100, 100, 100],
              },
              { t: 60, s: [72, 72, 100] },
            ],
            ix: 6,
          },
        },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            it: [
              {
                ty: 'rc',
                d: 1,
                s: { a: 0, k: [140, 140], ix: 2 },
                p: { a: 0, k: [0, 0], ix: 3 },
                r: { a: 0, k: 28, ix: 4 },
                nm: 'Rect',
                mn: 'ADBE Vector Shape - Rect',
                hd: false,
              },
              {
                ty: 'fl',
                c: { a: 0, k: [r, g, b, 1], ix: 4 },
                o: { a: 0, k: 100, ix: 5 },
                r: 1,
                bm: 0,
                nm: 'Fill',
                mn: 'ADBE Vector Graphic - Fill',
                hd: false,
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0], ix: 2 },
                a: { a: 0, k: [0, 0], ix: 1 },
                s: { a: 0, k: [100, 100], ix: 3 },
                r: { a: 0, k: 0, ix: 6 },
                o: { a: 0, k: 100, ix: 7 },
                sk: { a: 0, k: 0, ix: 4 },
                sa: { a: 0, k: 0, ix: 5 },
                nm: 'Transform',
              },
            ],
            nm: 'Group',
            np: 3,
            cix: 2,
            bm: 0,
            ix: 1,
            mn: 'ADBE Vector Group',
            hd: false,
          },
        ],
        ip: 0,
        op: 60,
        st: 0,
        bm: 0,
      },
    ],
    markers: [],
  };
}

const VARIANT_HEX = {
  nav: '#0f766e',
  favorite: '#be123c',
  location: '#0d9488',
  time: '#57534e',
  action: '#0f766e',
  status: '#16a34a',
  warning: '#dc2626',
  media: '#6366f1',
  social: '#0f766e',
  tool: '#57534e',
  transport: '#334155',
  ui: '#44403c',
  communication: '#0284c7',
  security: '#ca8a04',
  ai: '#7c3aed',
  brand: '#18181b',
  commerce: '#c2410c',
  discover: '#0369a1',
  nature: '#15803d',
};

const outDir = path.join(__dirname, '../src/assets/lottie-by-variant');
fs.mkdirSync(outDir, { recursive: true });
for (const [name, hex] of Object.entries(VARIANT_HEX)) {
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(makePulse(hex)));
}
console.log(`Wrote ${Object.keys(VARIANT_HEX).length} variant files to ${outDir}`);
