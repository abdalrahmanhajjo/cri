/**
 * Default site settings (merged with DB row on load).
 * Admin saves the full object to PostgreSQL; web + mobile app read GET /api/admin/site-settings (no auth).
 */
export const siteSettingsDefaults = {
  siteName: 'Visit Tripoli',
  siteTagline:
    "Discover Tripoli's best spots, local experiences, and ready-made plans — all in one place.",
  defaultLanguage: 'en',
  showMap: true,
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
  },
  /** Self-serve paid sponsorship (Stripe). Requires server env + migration 029. */
  sponsorshipEnabled: false,
  sponsorshipDurationDays: 30,
  sponsorshipAmountCents: 4999,
  sponsorshipCurrency: 'usd',
};
