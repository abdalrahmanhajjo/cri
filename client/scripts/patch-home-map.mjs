import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const fym = path.join(root, 'src', 'components', 'FindYourWayMap.jsx');
let s = fs.readFileSync(fym, 'utf8');
s = s.replace(
  'export default function FindYourWayMap({ places = [], t }) {',
  'export default function FindYourWayMap({ places = [], t, loadEager = false }) {'
);
const oldIo = `  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: '280px 0px', threshold: 0 }
    );
    obs.observe(el);
    // Mobile reliability fallback: force lazy section visible even if observer misses.
    const fallbackTimer = window.setTimeout(() => setVisible(true), 1400);
    return () => {
      obs.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, []);`;
const newIo = `  useEffect(() => {
    if (loadEager) {
      setVisible(true);
      return undefined;
    }
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: '280px 0px', threshold: 0 }
    );
    obs.observe(el);
    // Mobile reliability fallback: force lazy section visible even if observer misses.
    const fallbackTimer = window.setTimeout(() => setVisible(true), 1400);
    return () => {
      obs.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, [loadEager]);`;
if (!s.includes(oldIo)) {
  console.error('FindYourWayMap: expected block not found');
  process.exit(1);
}
s = s.replace(oldIo, newIo);
fs.writeFileSync(fym, s);
console.log('Updated FindYourWayMap.jsx');

const explore = path.join(root, 'src', 'pages', 'Explore.jsx');
let ex = fs.readFileSync(explore, 'utf8');
ex = ex.replace(
  '<FindYourWayMap places={places} t={t} />',
  '<FindYourWayMap places={places} t={t} loadEager />'
);
if (!ex.includes('loadEager')) {
  console.error('Explore.jsx: FindYourWayMap line not found');
  process.exit(1);
}
fs.writeFileSync(explore, ex);
console.log('Updated Explore.jsx');

const css = path.join(root, 'src', 'pages', 'Explore.css');
let c = fs.readFileSync(css, 'utf8');
const oldCss = `/* Wider content rail for the home areas map only (desktop / laptop) */
@media (min-width: 1024px) {
  .vd-home .vd-find-your-way--practical .vd-container {
    max-width: min(1920px, calc(100% - 2 * var(--page-padding)));
  }

  .vd-home .vd-find-your-way--practical .fym-map-wrap {
    max-width: 100%;
    aspect-ratio: 2 / 1;
    min-height: min(520px, 52vh);
  }
}`;
const newCss = `/* Home: compact map card; loadEager matches /map (script on mount, not scroll-gated) */
@media (min-width: 1024px) {
  .vd-home .vd-find-your-way--practical .fym-map-wrap {
    max-width: min(640px, 100%);
    margin-inline: auto;
    aspect-ratio: 4 / 3;
    min-height: 0;
  }
}`;
if (!c.includes(oldCss)) {
  console.error('Explore.css: expected block not found');
  process.exit(1);
}
c = c.replace(oldCss, newCss);
fs.writeFileSync(css, c);
console.log('Updated Explore.css');
