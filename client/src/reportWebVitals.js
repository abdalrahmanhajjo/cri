import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

function getVitalsEndpoint() {
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (typeof window === 'undefined') return '/api/metrics/vitals';
  if (!base) return `${window.location.origin}/api/metrics/vitals`;
  return `${base}/api/metrics/vitals`;
}

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
    rating: metric.rating,
  });
  const url = getVitalsEndpoint();
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    /* fall through */
  }
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'same-origin',
  }).catch(() => {});
}

export function reportWebVitals() {
  try {
    onCLS(sendToAnalytics);
    onINP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onFCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
  } catch {
    /* optional dependency / old browsers */
  }
}
