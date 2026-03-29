import { useEffect, useState } from 'react';

/**
 * Companion URL for feed videos: `name-lb.mp4` next to `name.mp4` (strip size / bitrate).
 * Returns empty string if `mainUrl` is not an `.mp4` path.
 */
export function reelLowBandwidthSrcFromMain(mainUrl) {
  if (mainUrl == null || typeof mainUrl !== 'string') return '';
  const t = mainUrl.trim();
  if (!t) return '';
  const q = t.indexOf('?');
  const pathPart = q >= 0 ? t.slice(0, q) : t;
  const query = q >= 0 ? t.slice(q) : '';
  if (!/\.mp4$/i.test(pathPart)) return '';
  return pathPart.replace(/\.mp4$/i, '-lb.mp4') + query;
}

function readNetworkPreferLow() {
  if (typeof navigator === 'undefined') return false;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return false;
  if (c.saveData === true) return true;
  const et = String(c.effectiveType || '');
  if (et === 'slow-2g' || et === '2g' || et === '3g') return true;
  const dl = typeof c.downlink === 'number' ? c.downlink : null;
  if (dl != null && dl > 0 && dl < 1.75) return true;
  return false;
}

/**
 * True when the browser reports slow / metered / Save-Data — pick `*-lb.mp4` when available.
 * Subscribes to `connection` `change` when supported.
 */
export function useReelPreferLowBandwidth() {
  const [preferLow, setPreferLow] = useState(() =>
    typeof navigator !== 'undefined' ? readNetworkPreferLow() : false
  );

  useEffect(() => {
    if (typeof navigator === 'undefined') return undefined;
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c || typeof c.addEventListener !== 'function') return undefined;
    const onChange = () => setPreferLow(readNetworkPreferLow());
    c.addEventListener('change', onChange);
    return () => c.removeEventListener('change', onChange);
  }, []);

  return preferLow;
}
