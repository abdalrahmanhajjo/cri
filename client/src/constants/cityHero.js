/**
 * Responsive WebP variants for the default home hero (`public/city-*.webp`).
 * Regenerate: `npm run optimize:city --prefix client`
 *
 * `CITY_HERO_SIZES` must stay aligned with `BENTO_HERO_SIZES` in `utils/responsiveImages.js`.
 */
export const CITY_HERO_WEBP_WIDTHS = [480, 640, 960, 1024];

export const CITY_HERO_SIZES = '(max-width: 959px) 100vw, min(1200px, 67vw)';

export function cityHeroWebpSrcSet() {
  return CITY_HERO_WEBP_WIDTHS.map((w) => `/city-${w}.webp ${w}w`).join(', ');
}

/** For `<link rel="preload" as="image" imagesrcset="…" imagesizes="…">` */
export function cityHeroPreloadLinkAttrs() {
  return {
    imagesrcset: cityHeroWebpSrcSet(),
    imagesizes: CITY_HERO_SIZES,
  };
}
