/**
 * Default home bento imagery — hero/mosaic fallbacks; avatar circles prefer **live directory** photos (see `resolveBentoAvatarSlots`).
 * Override per field from Site settings (Admin → Features) with full HTTPS URLs or `/…` public paths.
 *
 * Hero: `client/public/city.png`. Stock avatars below are unused when enough places in the API have images.
 * Unsplash (side/mosaic): https://unsplash.com/license
 */
const U = 'https://images.unsplash.com';
const q = 'auto=format&fit=crop&w=1800&q=82';
const HB = '/home-bento';

export const homeBentoDefaults = {
  /** Main hero — Citadel of Tripoli (local file) */
  hero: '/city.png',
  /** Discover card — golden hour waterfront */
  side: `${U}/photo-1507525428034-b723cf961d3e?${q}`,
  /** Middle tile — Tripoli / Mediterranean coast (local file) */
  why: `${HB}/hero-tripoli-coast.jpg`,
  /** Mosaic — Mediterranean rooftops / sea */
  mosaic: `${U}/photo-1523906834658-6e24ef2386f9?${q}`,
  /** Tripoli-area vibes: harbour / corniche, coast, north Lebanon hills */
  avatars: [
    `${HB}/avatar-mediterranean-port.jpg`,
    `${HB}/avatar-coastal-lebanon.jpg`,
    `${HB}/avatar-lebanon-hills.jpg`,
  ],
};

function pick(settings, key, fallback) {
  if (!settings || typeof settings !== 'object') return fallback;
  const v = settings[key];
  if (typeof v === 'string' && v.trim()) return v.trim();
  return fallback;
}

/** Safe `url("...")` for CSS custom properties. */
export function bentoCssUrl(href) {
  return `url(${JSON.stringify(href)})`;
}

/**
 * @param {Record<string, unknown>} settings — merged site settings from API
 * @returns {{ hero: string, side: string, why: string, mosaic: string, avatars: string[] }}
 */
export function resolveHomeBentoVisuals(settings) {
  const d = homeBentoDefaults;
  const hero = pick(settings, 'homeBentoHeroImage', d.hero);
  const side = pick(settings, 'homeBentoSideImage', d.side);
  const why = pick(settings, 'homeBentoWhyImage', d.why);
  const mosaic = pick(settings, 'homeBentoMosaicImage', d.mosaic);
  const a1 = pick(settings, 'homeBentoAvatar1', d.avatars[0]);
  const a2 = pick(settings, 'homeBentoAvatar2', d.avatars[1]);
  const a3 = pick(settings, 'homeBentoAvatar3', d.avatars[2]);
  const avatars = [a1, a2, a3].filter(Boolean);
  return { hero, side, why, mosaic, avatars };
}

const AVATAR_SETTING_KEYS = ['homeBentoAvatar1', 'homeBentoAvatar2', 'homeBentoAvatar3'];

/**
 * Three hero avatar slots: Admin URL per slot wins; otherwise top-rated **directory** places with photos.
 * @param {Record<string, unknown>} settings
 * @param {unknown[]} places
 * @param {(place: Record<string, unknown>) => string | null | undefined} imageUrlForPlace
 * @returns {{ href: string | null, placeId: string | null }[]}
 */
export function resolveBentoAvatarSlots(settings, places, imageUrlForPlace) {
  const src = typeof imageUrlForPlace === 'function' ? imageUrlForPlace : () => null;
  const list = Array.isArray(places) ? places : [];
  const sorted = [...list].sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0));
  const withImages = sorted.filter((p) => {
    const u = src(p);
    return typeof u === 'string' && u.trim().length > 0;
  });
  let poolIdx = 0;
  const usedIds = new Set();
  /** @type {{ href: string | null, placeId: string | null }[]} */
  const slots = [];

  for (let i = 0; i < 3; i++) {
    const override = pick(settings, AVATAR_SETTING_KEYS[i], '');
    if (override) {
      slots.push({ href: override, placeId: null });
      continue;
    }
    let found = null;
    while (poolIdx < withImages.length) {
      const p = withImages[poolIdx++];
      const id = p?.id != null ? String(p.id) : '';
      if (!id || usedIds.has(id)) continue;
      const hrefRaw = src(p);
      const href = typeof hrefRaw === 'string' && hrefRaw.trim() ? hrefRaw.trim() : null;
      if (!href) continue;
      usedIds.add(id);
      found = { href, placeId: id };
      break;
    }
    slots.push(found || { href: null, placeId: null });
  }

  let sortedIdx = 0;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].href || slots[i].placeId) continue;
    while (sortedIdx < sorted.length) {
      const p = sorted[sortedIdx++];
      const id = p?.id != null ? String(p.id) : '';
      if (!id || usedIds.has(id)) continue;
      usedIds.add(id);
      const hrefRaw = src(p);
      const href = typeof hrefRaw === 'string' && hrefRaw.trim() ? hrefRaw.trim() : null;
      slots[i] = { href, placeId: id };
      break;
    }
  }

  return slots;
}
