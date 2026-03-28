import { getDeliveryImgProps } from '../utils/responsiveImages.js';

/**
 * Responsive <img>: Unsplash / Google Places srcset + lazy by default.
 * Parent should be `position: relative; overflow: hidden;` (see `.delivery-img-cover` in index.css).
 *
 * @param {string} url — resolved absolute URL (use getPlaceImageUrl first when needed)
 * @param {string} [preset] — key from responsiveImages PRESETS (e.g. gridCard, detailHero)
 */
export default function DeliveryImg({
  url,
  preset = 'gridCard',
  alt = '',
  className = '',
  style,
  loading = 'lazy',
  fetchPriority,
  decoding = 'async',
  ...rest
}) {
  if (!url) return null;
  const { src, srcSet, sizes } = getDeliveryImgProps(url, preset);
  const cls = ['delivery-img-cover', className].filter(Boolean).join(' ');
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      className={cls}
      style={style}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      {...rest}
    />
  );
}
