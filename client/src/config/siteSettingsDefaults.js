/**
 * Default site settings (merged with DB row on load).
 * Admin saves the full object to PostgreSQL; web + mobile app read GET /api/site-settings (no auth).
 */

function emptyDiningHeroLocale() {
  return { kicker: '', title: '', subtitle: '' };
}

function emptyDiningSectionLabelsLocale() {
  return { topPicksTitle: '', sponsoredKicker: '', mainCollectionTitle: '' };
}

function emptyDiscoverGuide() {
  return { hiddenRestaurantPlaceIds: [] };
}

/** Normalize `diningGuide` from API or admin form (partial objects safe). */
export function mergeDiningGuide(raw) {
  const baseHero = {
    en: emptyDiningHeroLocale(),
    ar: emptyDiningHeroLocale(),
    fr: emptyDiningHeroLocale(),
  };
  const baseSl = {
    en: emptyDiningSectionLabelsLocale(),
    ar: emptyDiningSectionLabelsLocale(),
    fr: emptyDiningSectionLabelsLocale(),
  };
  if (!raw || typeof raw !== 'object') {
    return {
      enabled: true,
      heroImageUrl: '',
      hero: baseHero,
      featuredPlaceIds: [],
      hiddenPlaceIds: [],
      sectionLabels: baseSl,
    };
  }
  const hero = { ...baseHero };
  for (const k of ['en', 'ar', 'fr']) {
    const h = raw.hero?.[k];
    hero[k] =
      h && typeof h === 'object'
        ? {
            kicker: h.kicker != null ? String(h.kicker) : '',
            title: h.title != null ? String(h.title) : '',
            subtitle: h.subtitle != null ? String(h.subtitle) : '',
          }
        : emptyDiningHeroLocale();
  }
  const sectionLabels = { ...baseSl };
  for (const k of ['en', 'ar', 'fr']) {
    const sl = raw.sectionLabels?.[k];
    sectionLabels[k] =
      sl && typeof sl === 'object'
        ? {
            topPicksTitle: sl.topPicksTitle != null ? String(sl.topPicksTitle) : '',
            sponsoredKicker: sl.sponsoredKicker != null ? String(sl.sponsoredKicker) : '',
            mainCollectionTitle: sl.mainCollectionTitle != null ? String(sl.mainCollectionTitle) : '',
          }
        : emptyDiningSectionLabelsLocale();
  }
  const featured = Array.isArray(raw.featuredPlaceIds)
    ? raw.featuredPlaceIds.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const hidden = Array.isArray(raw.hiddenPlaceIds)
    ? raw.hiddenPlaceIds.map((x) => String(x).trim()).filter(Boolean)
    : [];
  return {
    enabled: raw.enabled !== false,
    heroImageUrl: typeof raw.heroImageUrl === 'string' ? raw.heroImageUrl.trim() : '',
    hero,
    featuredPlaceIds: featured,
    hiddenPlaceIds: hidden,
    sectionLabels,
  };
}

/** Same schema as `diningGuide` — editorial /hotels (stay-way) page. */
export function mergeHotelsGuide(raw) {
  return mergeDiningGuide(raw);
}

export function mergeDiscoverGuide(raw) {
  if (!raw || typeof raw !== 'object') return emptyDiscoverGuide();
  return {
    hiddenRestaurantPlaceIds: Array.isArray(raw.hiddenRestaurantPlaceIds)
      ? raw.hiddenRestaurantPlaceIds.map((x) => String(x).trim()).filter(Boolean)
      : [],
  };
}

/** Deep-merge nested keys that need defaults when loading from PostgreSQL. */
export function mergeWithSiteSettingsDefaults(serverSettings) {
  const s = serverSettings && typeof serverSettings === 'object' ? serverSettings : {};
  const diningGuide = mergeDiningGuide(s.diningGuide);
  const hotelsGuide = mergeHotelsGuide(s.hotelsGuide);
  const discoverGuide = mergeDiscoverGuide(s.discoverGuide);
  const sponsoredPlacesEnabled = {
    ...siteSettingsDefaultsBase.sponsoredPlacesEnabled,
    ...(typeof s.sponsoredPlacesEnabled === 'object' && s.sponsoredPlacesEnabled !== null
      ? s.sponsoredPlacesEnabled
      : {}),
  };
  return {
    ...siteSettingsDefaultsBase,
    ...s,
    diningGuide,
    hotelsGuide,
    discoverGuide,
    sponsoredPlacesEnabled,
  };
}

const siteSettingsDefaultsBase = {
  siteName: 'Visit Tripoli',
  siteTagline:
    "Discover Tripoli's best spots, local experiences, and ready-made plans — all in one place.",
  defaultLanguage: 'en',
  showMap: true,
  aiPlannerEnabled: true,
  contactEmail: '',
  contactPhone: '',
  socialFacebook: '',
  socialInstagram: '',
  socialTwitterX: '',
  analyticsId: '',
  supportUrl: '',
  announcementEnabled: false,
  announcementText: '',
  announcementUrl: '',
  maintenanceMode: false,
  /** SEO — applied to home page meta description when set */
  metaDescription: '',
  /** App Store / Play Store — used on home download section; fall back to generic store URLs if empty */
  appStoreUrl: '',
  playStoreUrl: '',
  /** Home bento (first section) — optional image URLs; empty = defaults in homeBentoVisuals.js */
  homeBentoHeroImage: '',
  homeBentoSideImage: '',
  homeBentoWhyImage: '',
  homeBentoMosaicImage: '',
  homeBentoAvatar1: '',
  homeBentoAvatar2: '',
  homeBentoAvatar3: '',
  sponsoredPlacesEnabled: {
    home: true,
    discover: true,
    feed: true,
    dining: true,
    hotels: true,
  },
  /** Editorial /dining page — hero copy, imagery, curated & hidden lists */
  diningGuide: mergeDiningGuide({}),
  /** Editorial /hotels page — same shape as diningGuide */
  hotelsGuide: mergeHotelsGuide({}),
  /** Discover page controls — currently used for hiding restaurant places from user-facing discover. */
  discoverGuide: mergeDiscoverGuide({}),
  /** Self-serve paid sponsorship (Stripe). Requires server env + migration 029. */
  sponsorshipEnabled: false,
  sponsorshipDurationDays: 30,
  sponsorshipAmountCents: 4999,
  sponsorshipCurrency: 'usd',
};

export const siteSettingsDefaults = siteSettingsDefaultsBase;
