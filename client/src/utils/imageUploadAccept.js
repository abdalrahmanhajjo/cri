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
