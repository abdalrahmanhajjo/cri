import { useState, useEffect } from 'react';
import { getIconDoc } from '../config/iconRegistry';
import { getFeatherSlug } from '../config/featherIconMap';

const svgTextCache = new Map();

function featherAssetUrl(slug) {
  const base = import.meta.env.BASE_URL || '/';
  const root = base === '/' ? '' : base.replace(/\/$/, '');
  return `${root}/feather/${slug}.svg`;
}

/** @param {string} raw */
function normalizeFeatherSvg(raw) {
  return raw
    .replace(/\s+width="[^"]*"/i, '')
    .replace(/\s+height="[^"]*"/i, '');
}

/**
 * @param {string} slug
 * @param {AbortSignal} [signal]
 */
async function loadFeatherSvg(slug, signal) {
  if (svgTextCache.has(slug)) return svgTextCache.get(slug);
  const res = await fetch(featherAssetUrl(slug), { signal });
  if (!res.ok) throw new Error(String(res.status));
  const text = normalizeFeatherSvg(await res.text());
  svgTextCache.set(slug, text);
  return text;
}

/**
 * Icons from `/public/feather` (Feather Icons, MIT).
 * Keep using Material-style `name` keys across the app; see `featherIconMap.js`.
 */
export default function Icon({
  name,
  className = '',
  size = 24,
  ariaHidden = true,
  title,
  ...props
}) {
  const doc = getIconDoc(name);
  const slug = getFeatherSlug(name);
  const [svgHtml, setSvgHtml] = useState(() => (svgTextCache.has(slug) ? svgTextCache.get(slug) : null));

  const { style: propStyle, 'aria-hidden': ariaHiddenDash, ...restProps } = props;
  let hidden = ariaHidden;
  if (ariaHiddenDash === true || ariaHiddenDash === 'true') hidden = true;
  if (ariaHiddenDash === false || ariaHiddenDash === 'false') hidden = false;
  const label = title ?? (hidden ? undefined : doc.description);

  useEffect(() => {
    const ac = new AbortController();
    const s = getFeatherSlug(name);
    if (svgTextCache.has(s)) {
      setSvgHtml(svgTextCache.get(s));
      return () => ac.abort();
    }
    loadFeatherSvg(s, ac.signal)
      .then((html) => {
        if (!ac.signal.aborted) setSvgHtml(html);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        loadFeatherSvg('help-circle', ac.signal)
          .then((html) => {
            if (!ac.signal.aborted) setSvgHtml(html);
          })
          .catch(() => {});
      });
    return () => ac.abort();
  }, [name]);

  return (
    <span
      className={`icon icon--feather ${className}`.trim()}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        flexShrink: 0,
        lineHeight: 0,
        color: 'inherit',
        ...(propStyle || {}),
      }}
      aria-hidden={hidden ? true : undefined}
      aria-label={label}
      role={hidden ? undefined : 'img'}
      title={hidden ? undefined : doc.description}
      {...restProps}
      {...(svgHtml ? { dangerouslySetInnerHTML: { __html: svgHtml } } : {})}
    />
  );
}
