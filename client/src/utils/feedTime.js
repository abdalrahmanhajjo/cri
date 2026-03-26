/**
 * Short relative time for feed posts (uses Intl when available).
 * @param {string | Date | null | undefined} iso
 * @param {string} lang 'en' | 'ar' | 'fr'
 */
export function formatFeedTime(iso, lang = 'en') {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';

  const locale = lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-FR' : 'en-GB';
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 50) {
    if (lang === 'ar') return 'الآن';
    if (lang === 'fr') return 'À l’instant';
    return 'Just now';
  }
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-m, 'minute');
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-h, 'hour');
  }
  if (diffSec < 86400 * 7) {
    const days = Math.floor(diffSec / 86400);
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day');
  }
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}
