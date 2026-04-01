/**
 * Supabase Storage public URLs → `/render/image` transforms (resize + WebP when supported).
 * **Opt-in only** (`VITE_SUPABASE_IMAGE_TRANSFORM=1`): many projects use tiers where transforms
 * are unavailable; rewriting URLs then 404s every image. Default leaves original `/object/public/` URLs.
 *
 * @see https://supabase.com/docs/guides/storage/serving/image-transformations
 */

const OBJECT_PUBLIC = '/storage/v1/object/public/';
const RENDER_PUBLIC = '/storage/v1/render/image/public/';

export function isSupabaseImageTransformDisabled() {
  const v = import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM;
  return v !== '1' && v !== 'true';
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isSupabaseStorageObjectPublicUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url, 'https://local.invalid');
    if (!u.hostname.endsWith('.supabase.co')) return false;
    return u.pathname.includes(OBJECT_PUBLIC) && !u.pathname.includes('/render/image/');
  } catch {
    return false;
  }
}

/**
 * @param {string} originalUrl — full https URL to object/public/...
 * @param {{ width?: number, quality?: number, resize?: string }} [opts]
 * @returns {string}
 */
export function supabaseRenderImageUrl(originalUrl, opts = {}) {
  if (isSupabaseImageTransformDisabled() || !originalUrl) return originalUrl;
  try {
    const u = new URL(originalUrl);
    if (!u.hostname.endsWith('.supabase.co')) return originalUrl;
    if (!u.pathname.includes(OBJECT_PUBLIC)) return originalUrl;
    if (u.pathname.includes('/storage/v1/render/')) return originalUrl;

    const newPath = u.pathname.replace(OBJECT_PUBLIC, RENDER_PUBLIC);
    const width = opts.width != null ? Number(opts.width) : 800;
    const quality = opts.quality != null ? Number(opts.quality) : 78;
    const resize = opts.resize || 'cover';

    const q = new URLSearchParams(u.search);
    q.set('width', String(Math.max(16, Math.min(4096, width))));
    q.set('quality', String(Math.max(20, Math.min(100, quality))));
    q.set('resize', resize);

    return `${u.origin}${newPath}?${q.toString()}`;
  } catch {
    return originalUrl;
  }
}

/**
 * Smaller URL for CSS background-image (bento avatars, etc.).
 * @param {string} url
 * @param {number} [cssMaxEdge] — display px × ~2 for retina
 * @returns {string}
 */
export function supabaseOptimizeForThumbnail(url, cssMaxEdge = 200) {
  if (!isSupabaseStorageObjectPublicUrl(url)) return url;
  return supabaseRenderImageUrl(url, {
    width: Math.min(512, Math.max(96, cssMaxEdge * 2)),
    quality: 76,
    resize: 'cover',
  });
}

/** Community / feed video poster: cap dimensions vs full-res upload. */
export function optimizeVideoPosterUrl(url) {
  if (!isSupabaseStorageObjectPublicUrl(url)) return url;
  return supabaseRenderImageUrl(url, { width: 720, quality: 78, resize: 'cover' });
}
