import { normalizeMenuSectionsForPlaceDisplay } from './diningProfileForm';
import { diningProfileFromPlace } from './diningProfileMergeClient';

function uniqStrings(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((item) => String(item || '').trim()).filter(Boolean))];
}

function titleizeToken(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function diningSignals(place) {
  const dp = diningProfileFromPlace(place);
  const cuisines = uniqStrings(dp.cuisines).map(titleizeToken);
  const bestFor = uniqStrings(dp.bestFor).map(titleizeToken);
  const serviceModes = uniqStrings([
    ...(Array.isArray(dp.serviceModes) ? dp.serviceModes : []),
    ...(dp.delivery ? ['delivery'] : []),
    ...(dp.takeaway ? ['takeaway'] : []),
    ...(dp.reservations ? ['reservations'] : []),
    ...(dp.outdoorSeating ? ['outdoor seating'] : []),
  ]).map(titleizeToken);
  const menuSections = normalizeMenuSectionsForPlaceDisplay(dp);
  const plainHint =
    Boolean(String(dp.menuNote || '').trim()) ||
    Boolean(String(dp.menuPlain || dp.menu_plain || dp.menu || '').trim());
  return {
    cuisines,
    bestFor,
    serviceModes,
    menuSections,
    hasMenu: menuSections.length > 0 || plainHint,
    hasHours: Boolean(String(place?.hours || '').trim()),
    hasContact:
      Boolean(String(dp.contactPhone || '').trim()) ||
      Boolean(String(dp.contactEmail || '').trim()) ||
      Boolean(String(dp.contactAddress || '').trim()),
    menuDepth: menuSections.reduce((sum, section) => sum + (Array.isArray(section?.items) ? section.items.length : 0), 0),
  };
}
