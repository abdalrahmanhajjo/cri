/**
 * Dining & hotels guides, sponsored placements, and home featured carousel stay
 * admin-only until public launch. Set VITE_PUBLIC_RELEASE_DINING_HOTELS_SPONSOR=true
 * in the client build env to show these surfaces to everyone.
 */
export function isGuidesSponsorFeaturedPublicReleased() {
  try {
    return (
      String(import.meta.env?.VITE_PUBLIC_RELEASE_DINING_HOTELS_SPONSOR || '').toLowerCase() === 'true'
    );
  } catch {
    return false;
  }
}

/** @param {{ isAdmin?: boolean } | null | undefined} user */
export function canSeeGuidesSponsorAndFeatured(user) {
  if (isGuidesSponsorFeaturedPublicReleased()) return true;
  return Boolean(user?.isAdmin);
}
