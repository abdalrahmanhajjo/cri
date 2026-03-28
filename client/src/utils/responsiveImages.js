/**
 * Responsive image delivery across the app:
 * - Unsplash: srcset + auto=format + fit=crop + quality (smaller bytes)
 * - Google Places photo API: srcset via maxwidth variants
 * - Everything else (uploads, Supabase, etc.): pass-through src only
 */

export const UNSPLASH_HOST = 'images.unsplash.com';

/** Matches home bento hero layout (shared with bentoHeroImage). */
export const BENTO_HERO_SIZES = '(max-width: 959px) 100vw, min(1200px, 67vw)';

const PRESETS = {
  bentoHero: {
    unsplashWidths: [480, 640, 960, 1280, 1600],
    defaultUnsplashW: 960,
    sizes: BENTO_HERO_SIZES,
    q: '76',
  },
  detailHero: {
    unsplashWidths: [480, 640, 960, 1280, 1920],
    defaultUnsplashW: 960,
    sizes: '(max-width: 900px) 100vw, min(1040px, 92vw)',
    q: '76',
  },
  topPicks: {
    unsplashWidths: [480, 640, 960, 1280, 1600],
    defaultUnsplashW: 960,
    sizes: '(max-width: 900px) 100vw, min(900px, 88vw)',
    q: '75',
  },
  gridCard: {
    unsplashWidths: [240, 320, 480, 640, 800],
    defaultUnsplashW: 480,
    sizes: '(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 380px',
    q: '72',
  },
  gridCardFeatured: {
    unsplashWidths: [400, 480, 640, 960, 1200],
    defaultUnsplashW: 640,
    sizes: '(max-width: 900px) 100vw, min(560px, 62vw)',
    q: '75',
  },
  discoverCard: {
    unsplashWidths: [320, 480, 640, 800],
    defaultUnsplashW: 640,
    sizes: '(max-width: 700px) 100vw, (max-width: 1200px) 45vw, 400px',
    q: '74',
  },
  planDiscover: {
    unsplashWidths: [320, 480, 640, 720],
    defaultUnsplashW: 640,
    sizes: '(max-width: 900px) 100vw, (max-width: 1200px) 33vw, 320px',
    q: '74',
  },
  thumb: {
    unsplashWidths: [96, 128, 192, 256],
    defaultUnsplashW: 192,
    sizes: '72px',
    q: '70',
  },
  similarStrip: {
    unsplashWidths: [160, 240, 320, 480],
    defaultUnsplashW: 320,
    sizes: '160px',
    q: '72',
  },
  planSquare: {
    unsplashWidths: [96, 128, 192],
    defaultUnsplashW: 144,
    sizes: '72px',
    q: '70',
  },
  tripStop: {
    unsplashWidths: [96, 144, 192, 256],
    defaultUnsplashW: 192,
    sizes: '(max-width: 520px) 56px, 72px',
    q: '70',
  },
  seoDb: {
    unsplashWidths: [240, 360, 480, 640],
    defaultUnsplashW: 480,
    sizes: '(max-width: 940px) 50vw, 25vw',
    q: '74',
  },
  backlinkDb: {
    unsplashWidths: [240, 400, 560, 720],
    defaultUnsplashW: 560,
    sizes: '(max-width: 900px) 100vw, 50vw',
    q: '74',
  },
  galleryTile: {
    unsplashWidths: [200, 320, 480, 640],
    defaultUnsplashW: 400,
    sizes: '(max-width: 600px) 45vw, 200px',
    q: '72',
  },
  venueThumb: {
    unsplashWidths: [128, 192, 256],
    defaultUnsplashW: 192,
    sizes: '96px',
    q: '70',
  },
};

/**
 * @param {string} src
 * @returns {{ base: string, q: string } | null}
 */
export function parseUnsplash(src) {
  if (!src || typeof src !== 'string') return null;
  try {
    const u = new URL(src, 'https://local.invalid');
    if (u.hostname !== UNSPLASH_HOST) return null;
    const base = `${u.origin}${u.pathname}`;
    const q = u.searchParams.get('q') || '78';
    return { base, q };
  } catch {
    return null;
  }
}

export function buildUnsplashUrl(base, w, q) {
  return `${base}?auto=format&fit=crop&w=${w}&q=${q}`;
}

/**
 * @param {string} url
 * @returns {{ src: string, srcSet: string, sizes: string } | null}
 */
function googlePlacePhotoProps(url) {
  try {
    const u = new URL(url, 'https://example.com');
    if (!u.pathname.includes('/maps/api/place/photo')) return null;
    const ref = u.searchParams.get('photo_reference');
    const key = u.searchParams.get('key');
    if (!ref || !key) return null;
    const base = 'https://maps.googleapis.com/maps/api/place/photo';
    const widths = [200, 320, 480, 640];
    const build = (w) =>
      `${base}?maxwidth=${w}&photo_reference=${encodeURIComponent(ref)}&key=${encodeURIComponent(key)}`;
    const srcSet = widths.map((w) => `${build(w)} ${w}w`).join(', ');
    return {
      src: build(480),
      srcSet,
      sizes: '(max-width: 600px) 100vw, 360px',
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} absUrl — already resolved (e.g. getPlaceImageUrl)
 * @param {keyof typeof PRESETS} [presetKey]
 * @returns {{ src: string, srcSet?: string, sizes?: string }}
 */
export function getDeliveryImgProps(absUrl, presetKey = 'gridCard') {
  if (!absUrl || typeof absUrl !== 'string') return { src: '' };
  const url = absUrl.trim();
  const preset = PRESETS[presetKey] || PRESETS.gridCard;

  const g = googlePlacePhotoProps(url);
  if (g) {
    return { src: g.src, srcSet: g.srcSet, sizes: preset.sizes };
  }

  const parsed = parseUnsplash(url);
  if (parsed) {
    const q = parsed.q || preset.q;
    const { base } = parsed;
    const sw = preset.unsplashWidths;
    const srcSet = sw.map((w) => `${buildUnsplashUrl(base, w, q)} ${w}w`).join(', ');
    const src = buildUnsplashUrl(base, preset.defaultUnsplashW, q);
    return { src, srcSet, sizes: preset.sizes };
  }

  return { src: url };
}

/**
 * Default `<img src>` for link preload when hero is Unsplash (matches srcset default width intent).
 */
export function getUnsplashPreloadSrc(src, presetKey = 'bentoHero') {
  if (!src || typeof src !== 'string') return '';
  const preset = PRESETS[presetKey] || PRESETS.bentoHero;
  const parsed = parseUnsplash(src.trim());
  if (!parsed) return src.trim();
  return buildUnsplashUrl(parsed.base, preset.defaultUnsplashW, parsed.q || preset.q);
}
