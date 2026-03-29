import {
  SITE_BRAND_NAME,
  SITE_DEFAULT_DESCRIPTION,
  SITE_DEFAULT_TITLE,
  SITE_OG_IMAGE_PATH,
  SITE_TITLE_SUFFIX,
} from '../config/siteSeo.js';

export function upsertMetaName(name, content) {
  if (!content) return;
  let meta = [...document.head.querySelectorAll('meta[name]')].find((m) => m.getAttribute('name') === name);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

export function upsertMetaProperty(property, content) {
  if (!content) return;
  let meta = [...document.head.querySelectorAll('meta[property]')].find((m) => m.getAttribute('property') === property);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

/**
 * Public origin for absolute OG URLs in the browser (`VITE_PUBLIC_SITE_URL` or `window.location.origin`).
 */
export function getPublicSiteOrigin() {
  const v = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (v != null && String(v).trim() !== '') {
    return String(v).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function absolutePublicUrl(path) {
  const origin = getPublicSiteOrigin();
  const p = path.startsWith('/') ? path : `/${path}`;
  return origin ? `${origin}${p}` : p;
}

/**
 * Sync home page meta when `/api/.../site-settings` loads (description override + titles).
 */
export function applyHomeSeoFromSettings(settings = {}) {
  const desc = (settings.metaDescription && String(settings.metaDescription).trim()) || SITE_DEFAULT_DESCRIPTION;
  const siteName = settings.siteName && String(settings.siteName).trim();
  const title = siteName ? `${siteName} – ${SITE_TITLE_SUFFIX}` : SITE_DEFAULT_TITLE;

  document.title = title;
  upsertMetaName('description', desc);
  upsertMetaProperty('og:type', 'website');
  upsertMetaProperty('og:title', title);
  upsertMetaProperty('og:description', desc);
  upsertMetaProperty('og:site_name', siteName || SITE_BRAND_NAME);
  upsertMetaName('twitter:card', 'summary');
  upsertMetaName('twitter:title', title);
  upsertMetaName('twitter:description', desc);

  const ogImage = absolutePublicUrl(SITE_OG_IMAGE_PATH);
  if (ogImage.startsWith('http')) {
    upsertMetaProperty('og:image', ogImage);
    upsertMetaName('twitter:image', ogImage);
  }
}
