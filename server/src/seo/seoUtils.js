const path = require('path');
const fs = require('fs');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function clampText(s, max = 180) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
}

function getBaseUrl(req) {
  const proto = (req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http')).split(',')[0].trim();
  const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  return `${proto}://${host}`.replace(/\/$/, '');
}

function safeUrlJoin(base, pathname) {
  const b = String(base || '').replace(/\/$/, '');
  const p = String(pathname || '').startsWith('/') ? String(pathname) : `/${pathname || ''}`;
  return b + p;
}

function resolveOgImage(baseUrl, imageUrl) {
  if (!imageUrl) return null;
  const u = String(imageUrl).trim();
  if (!u) return null;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return safeUrlJoin(baseUrl, u);
  return u;
}

let cachedIndex = null;
let cachedIndexMtimeMs = 0;

function loadClientIndexHtml(clientDistPath) {
  const indexPath = path.join(clientDistPath, 'index.html');
  const stat = fs.statSync(indexPath);
  if (!cachedIndex || stat.mtimeMs !== cachedIndexMtimeMs) {
    cachedIndex = fs.readFileSync(indexPath, 'utf8');
    cachedIndexMtimeMs = stat.mtimeMs;
  }
  return cachedIndex;
}

function injectSeoIntoIndexHtml(indexHtml, seo) {
  const title = seo?.title ? String(seo.title) : 'Visit Tripoli';
  const description = seo?.description ? String(seo.description) : '';
  const canonical = seo?.canonical ? String(seo.canonical) : '';
  const ogImage = seo?.ogImage ? String(seo.ogImage) : '';
  const robots = seo?.robots ? String(seo.robots) : 'index,follow';
  const lang = seo?.lang ? String(seo.lang) : null;
  const jsonLd = seo?.jsonLd ? String(seo.jsonLd) : '';
  const alternates = Array.isArray(seo?.alternates) ? seo.alternates : [];

  let html = indexHtml;

  if (lang) {
    html = html.replace(/<html\b([^>]*)>/i, (m, attrs) => {
      if (/\blang\s*=/.test(attrs)) return `<html${attrs}>`;
      return `<html lang="${escapeAttr(lang)}"${attrs}>`;
    });
  }

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  const meta = [];
  meta.push(`<meta name="robots" content="${escapeAttr(robots)}" />`);
  // Optional: set GOOGLE_SITE_VERIFICATION in server env (value from Google Search Console → HTML tag).
  const googleSiteVerification = (process.env.GOOGLE_SITE_VERIFICATION || '').trim();
  if (googleSiteVerification) {
    meta.push(`<meta name="google-site-verification" content="${escapeAttr(googleSiteVerification)}" />`);
  }
  if (description) meta.push(`<meta name="description" content="${escapeAttr(clampText(description, 180))}" />`);
  if (canonical) meta.push(`<link rel="canonical" href="${escapeAttr(canonical)}" />`);

  // OpenGraph / Twitter
  meta.push(`<meta property="og:type" content="website" />`);
  meta.push(`<meta property="og:title" content="${escapeAttr(title)}" />`);
  if (description) meta.push(`<meta property="og:description" content="${escapeAttr(clampText(description, 240))}" />`);
  if (canonical) meta.push(`<meta property="og:url" content="${escapeAttr(canonical)}" />`);
  if (ogImage) meta.push(`<meta property="og:image" content="${escapeAttr(ogImage)}" />`);
  meta.push(`<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}" />`);
  meta.push(`<meta name="twitter:title" content="${escapeAttr(title)}" />`);
  if (description) meta.push(`<meta name="twitter:description" content="${escapeAttr(clampText(description, 200))}" />`);
  if (ogImage) meta.push(`<meta name="twitter:image" content="${escapeAttr(ogImage)}" />`);

  // hreflang alternates (EN/AR/FR + x-default)
  for (const a of alternates) {
    if (!a || typeof a !== 'object') continue;
    if (!a.href || !a.hreflang) continue;
    meta.push(`<link rel="alternate" hreflang="${escapeAttr(a.hreflang)}" href="${escapeAttr(a.href)}" />`);
  }

  if (jsonLd) {
    meta.push(`<script type="application/ld+json">${jsonLd}</script>`);
  }

  const marker = '<meta name="viewport"';
  const insert = `\n    ${meta.join('\n    ')}\n`;
  const idx = html.toLowerCase().indexOf(marker);
  if (idx !== -1) {
    // Insert right before viewport meta to keep it near the top.
    html = html.slice(0, idx) + insert + html.slice(idx);
  } else {
    html = html.replace(/<\/head>/i, `${insert}\n  </head>`);
  }

  return html;
}

module.exports = {
  clampText,
  getBaseUrl,
  safeUrlJoin,
  resolveOgImage,
  loadClientIndexHtml,
  injectSeoIntoIndexHtml,
};

