/** File input `accept` including Apple HEIC/HEIF (API always stores them as JPEG). */
export const ACCEPT_IMAGES_WITH_HEIC =
  'image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif';

/** Treat as image for validation (iOS often uses image/heic or octet-stream + .heic). */
export function isLikelyImageFile(file) {
  if (!file) return false;
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  const n = (file.name || '').toLowerCase();
  return n.endsWith('.heic') || n.endsWith('.heif');
}

/** Treat as video (many phones send empty type or application/octet-stream + .mov). */
export function isLikelyVideoFile(file) {
  if (!file) return false;
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('video/')) return true;
  if (t === 'application/octet-stream' || t === '') {
    const n = (file.name || '').toLowerCase();
    return /\.(mp4|webm|mov|m4v|3gp|3g2|mkv)$/i.test(n);
  }
  return false;
}
