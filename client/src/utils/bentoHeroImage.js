/**
 * LCP-friendly props for the home bento hero <img>.
 * Unsplash: srcset with capped widths + slightly lower quality to cut bytes.
 * Other URLs: pass through with sizes hint for responsive layout.
 */
const UNSPLASH_HOST = 'images.unsplash.com';
const HERO_WIDTHS = [640, 960, 1280, 1600];
const DEFAULT_Q = '78';

/** Matches grid: full width phone; ~8/12 of container on desktop (max ~1200px content). */
export const BENTO_HERO_SIZES = '(max-width: 959px) 100vw, min(1200px, 67vw)';

function unsplashBaseAndQuery(src) {
  try {
    const u = new URL(src, 'https://local.invalid');
    if (u.hostname !== UNSPLASH_HOST) return null;
    const base = `${u.origin}${u.pathname}`;
    const params = u.searchParams;
    const q = params.get('q') || DEFAULT_Q;
    return { base, q };
  } catch {
    return null;
  }
}

function unsplashUrl(base, w, q) {
  return `${base}?auto=format&fit=crop&w=${w}&q=${q}`;
}

/**
 * @param {string} src — resolved hero URL (same-origin, Unsplash, or admin URL)
 * @returns {Record<string, string | undefined>} spread onto <img>
 */
export function getBentoHeroImgProps(src) {
  if (!src || typeof src !== 'string') {
    return {
      src: '',
      sizes: BENTO_HERO_SIZES,
      loading: 'eager',
      decoding: 'async',
      fetchPriority: 'high',
    };
  }

  const parsed = unsplashBaseAndQuery(src.trim());
  if (!parsed) {
    return {
      src: src.trim(),
      sizes: BENTO_HERO_SIZES,
      loading: 'eager',
      decoding: 'async',
      fetchPriority: 'high',
    };
  }

  const { base, q } = parsed;
  const srcSet = HERO_WIDTHS.map((w) => `${unsplashUrl(base, w, q)} ${w}w`).join(', ');
  const imgSrc = unsplashUrl(base, 1280, q);

  return {
    src: imgSrc,
    srcSet,
    sizes: BENTO_HERO_SIZES,
    loading: 'eager',
    decoding: 'async',
    fetchPriority: 'high',
  };
}

/** URL to put in <link rel="preload"> (matches default img src, not full srcset). */
export function getBentoHeroPreloadHref(src) {
  if (!src || typeof src !== 'string') return '';
  const parsed = unsplashBaseAndQuery(src.trim());
  if (parsed) return unsplashUrl(parsed.base, 1280, parsed.q);
  return src.trim();
}

/**
 * Absolute http(s) URL safe for <link rel="preload" as="image"> (avoids empty/invalid href console warnings).
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizePreloadImageHref(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || /^data:/i.test(s) || /^blob:/i.test(s) || /^\s*javascript:/i.test(s)) return null;
  if (typeof window === 'undefined' || !window.location?.origin) return null;
  try {
    const abs = new URL(s, window.location.origin);
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
    return abs.href;
  } catch {
    return null;
  }
}
