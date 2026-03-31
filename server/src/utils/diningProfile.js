'use strict';

const LIMITS = {
  menuIntro: 4000,
  url: 2000,
  phone: 48,
  whatsapp: 32,
  dietaryNotes: 800,
  cuisineType: 80,
  maxCuisine: 16,
  sectionTitle: 160,
  maxSections: 14,
  maxItemsPerSection: 40,
  itemName: 200,
  itemDesc: 600,
  itemPrice: 80,
};

function clampStr(s, max) {
  if (typeof s !== 'string') return '';
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

/** Allow http(s) URLs and same-origin paths for PDF/menu assets. */
function sanitizeUrl(u) {
  if (typeof u !== 'string') return '';
  const t = u.trim();
  if (!t || t.length > LIMITS.url) return '';
  if (/^\s*(javascript|data|vbscript|file):/i.test(t)) return '';
  if (t.startsWith('https://') || t.startsWith('http://')) return t;
  if (t.startsWith('/') && !t.startsWith('//')) return t;
  return '';
}

function boolVal(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

/**
 * Normalize `dining_profile` JSON from DB or API body (defensive caps).
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
function normalizeDiningProfile(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  const menuIntro = clampStr(o.menuIntro != null ? String(o.menuIntro) : '', LIMITS.menuIntro);
  const menuUrl = sanitizeUrl(o.menuUrl != null ? String(o.menuUrl) : '');
  const menuPdfUrl = sanitizeUrl(o.menuPdfUrl != null ? String(o.menuPdfUrl) : '');
  const reservationsUrl = sanitizeUrl(o.reservationsUrl != null ? String(o.reservationsUrl) : '');
  const phone = clampStr(o.phone != null ? String(o.phone) : '', LIMITS.phone);
  const whatsapp = clampStr(o.whatsapp != null ? String(o.whatsapp) : '', LIMITS.whatsapp);
  const dietaryNotes = clampStr(o.dietaryNotes != null ? String(o.dietaryNotes) : '', LIMITS.dietaryNotes);

  let cuisineTypes = [];
  if (Array.isArray(o.cuisineTypes)) {
    cuisineTypes = o.cuisineTypes
      .map((x) => clampStr(String(x ?? ''), LIMITS.cuisineType))
      .filter(Boolean)
      .slice(0, LIMITS.maxCuisine);
  }

  const svcIn = o.service && typeof o.service === 'object' && !Array.isArray(o.service) ? o.service : {};
  const service = {
    dineIn: boolVal(svcIn.dineIn),
    takeaway: boolVal(svcIn.takeaway),
    delivery: boolVal(svcIn.delivery),
    outdoorSeating: boolVal(svcIn.outdoorSeating),
    reservations: boolVal(svcIn.reservations),
  };

  const menuSections = [];
  if (Array.isArray(o.menuSections)) {
    for (const sec of o.menuSections) {
      if (menuSections.length >= LIMITS.maxSections) break;
      if (!sec || typeof sec !== 'object') continue;
      const title = clampStr(sec.title != null ? String(sec.title) : '', LIMITS.sectionTitle);
      const items = [];
      if (Array.isArray(sec.items)) {
        for (const it of sec.items) {
          if (items.length >= LIMITS.maxItemsPerSection) break;
          if (!it || typeof it !== 'object') continue;
          const name = clampStr(it.name != null ? String(it.name) : '', LIMITS.itemName);
          if (!name) continue;
          items.push({
            name,
            description: clampStr(it.description != null ? String(it.description) : '', LIMITS.itemDesc),
            price: clampStr(it.price != null ? String(it.price) : '', LIMITS.itemPrice),
          });
        }
      }
      if (!title && items.length === 0) continue;
      menuSections.push({ title: title || '', items });
    }
  }

  const out = {
    menuIntro,
    menuUrl,
    menuPdfUrl,
    reservationsUrl,
    phone,
    whatsapp,
    dietaryNotes,
    cuisineTypes,
    service,
    menuSections,
  };

  const emptyService = !Object.values(service).some(Boolean);
  const empty =
    !menuIntro &&
    !menuUrl &&
    !menuPdfUrl &&
    !reservationsUrl &&
    !phone &&
    !whatsapp &&
    !dietaryNotes &&
    cuisineTypes.length === 0 &&
    emptyService &&
    menuSections.length === 0;
  return { ...out, _isEmpty: empty };
}

/** Strip internal flags before JSON storage. */
function diningProfileForDb(profile) {
  const p = normalizeDiningProfile(profile);
  const { _isEmpty, ...rest } = p;
  void _isEmpty;
  return rest;
}

/**
 * Validate optional `diningProfile` on PUT bodies.
 * @returns {{ ok: true, value: object|undefined|null } | { ok: false, error: string }}
 */
function validateDiningProfileBody(raw) {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null) return { ok: true, value: diningProfileForDb({}) };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'diningProfile must be an object' };
  }
  return { ok: true, value: diningProfileForDb(raw) };
}

module.exports = {
  normalizeDiningProfile,
  diningProfileForDb,
  validateDiningProfileBody,
  DINING_PROFILE_LIMITS: LIMITS,
};
