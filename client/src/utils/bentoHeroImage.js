/**
 * LCP-friendly props for the home bento hero <img>.
 * Unsplash: srcset with capped widths + slightly lower quality to cut bytes.
 * Other URLs: pass through with sizes hint for responsive layout.
 */
import { getDeliveryImgProps, getUnsplashPreloadSrc, BENTO_HERO_SIZES } from './responsiveImages.js';

export { BENTO_HERO_SIZES };

/**
 * @param {string} src — resolved hero URL (same-origin, Unsplash, or admin URL)
 * @returns {Record<string, string | undefined>} spread onto <img>
 */
export function getBentoHeroImgProps(src) {
  const { src: imgSrc, srcSet, sizes } = getDeliveryImgProps(src || '', 'bentoHero');
  return {
    src: imgSrc || '',
    srcSet,
    sizes,
    loading: 'eager',
    decoding: 'async',
    fetchPriority: 'high',
  };
}

/** URL to put in <link rel="preload"> (matches default img src, not full srcset). */
export function getBentoHeroPreloadHref(src) {
  return getUnsplashPreloadSrc(src, 'bentoHero');
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
