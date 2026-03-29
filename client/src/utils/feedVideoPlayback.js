/**
 * Native <video src> vs external embed host. Prefer resolved URL (after getImageUrl) so paths
 * stored without a leading slash (e.g. uploads/...) still render inline.
 */
export function isLikelyDirectStreamableVideo(resolvedUrl, rawUrl) {
  if (!resolvedUrl || typeof resolvedUrl !== 'string') return false;
  const resolved = resolvedUrl.trim();
  if (!resolved) return false;

  const raw = rawUrl && typeof rawUrl === 'string' ? rawUrl.trim().toLowerCase() : '';
  const resolvedLower = resolved.toLowerCase();
  const hosts = ['youtube.com', 'youtu.be', 'vimeo.com'];
  for (const h of hosts) {
    if (raw.includes(h) || resolvedLower.includes(h)) return false;
  }

  return (
    /^https?:\/\//i.test(resolved) ||
    resolved.startsWith('/') ||
    resolved.startsWith('blob:')
  );
}
