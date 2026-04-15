import { menuSectionsToPlainText, parseMenuSectionsPlainText } from './diningMenuPlainText';

/** Dish line object: accept legacy keys from older imports / admin data. */
function dishNameFromItem(it) {
  if (typeof it === 'string') return it.trim();
  if (!it || typeof it !== 'object') return '';
  const n = it.name;
  if (n && typeof n === 'object') {
    return String(n.en || n.ar || n.fr || Object.values(n).find((v) => typeof v === 'string') || '').trim();
  }
  const names = it.names;
  if (typeof names === 'string' && names.trim()) return names.trim();
  return String(
    it.name ||
      it.title ||
      it.dish ||
      it.dishName ||
      it.label ||
      it.name_ar ||
      it.nameAr ||
      it.item ||
      it.productName ||
      it.product_name ||
      it.foodName ||
      it.food_name ||
      ''
  ).trim();
}

function dishImageFromItem(it) {
  if (!it || typeof it !== 'object') return '';
  return String(it.image || it.imageUrl || it.image_url || it.photo || it.picture || it.thumbnail || '').trim();
}

/**
 * Collect menu sections from dining profile objects as stored in Mongo/API:
 * prefers `menuSections`, falls back to `menu_sections`, optional JSON string,
 * object map, alternate per-section keys (`dishes`, etc.),
 * then plain-text fields `menuPlain` / `menu_plain` / `menuText` / `menu`.
 */
function sectionItemsFromRaw(s) {
  if (!s || typeof s !== 'object') return [];
  const keys = ['items', 'dishes', 'menuItems', 'entries', 'lines', 'products', 'foods'];
  for (const k of keys) {
    if (Array.isArray(s[k]) && s[k].length) return s[k];
  }
  for (const k of keys) {
    if (Array.isArray(s[k])) return s[k];
  }
  return Array.isArray(s.items) ? s.items : [];
}

function normalizeSectionsShape(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map((s) => {
    if (!s || typeof s !== 'object') return s;
    const items = sectionItemsFromRaw(s);
    return { ...s, items };
  });
}


/** When `menu` is a flat array of dish rows (not wrapped in sections), wrap as one section. */
function flatMenuArrayToSingleSection(menuArr) {
  if (!Array.isArray(menuArr) || menuArr.length < 1) return null;
  const sample = menuArr[0];
  if (sample && typeof sample === 'object' && !Array.isArray(sample)) {
    if (Array.isArray(sample.items) || Array.isArray(sample.dishes)) return null;
  }
  const items = [];
  for (const el of menuArr) {
    if (el == null) continue;
    if (typeof el === 'string') {
      const n = el.trim();
      if (n) items.push(el);
      continue;
    }
    if (typeof el === 'object' && !Array.isArray(el)) items.push(el);
  }
  if (!items.length) return null;
  return [{ title: 'Menu', note: '', items }];
}

function menuObjectToSections(menuObj) {
  if (!menuObj || typeof menuObj !== 'object' || Array.isArray(menuObj)) return [];
  return Object.entries(menuObj)
    .map(([title, val]) => {
      const t = String(title || '').trim();
      if (Array.isArray(val)) return { title: t || 'Menu', items: val };
      if (val && typeof val === 'object' && Array.isArray(val.items)) return { title: t || 'Menu', items: val.items };
      return null;
    })
    .filter(Boolean);
}

export function coalesceMenuSectionsInput(dp) {
  if (!dp || typeof dp !== 'object' || Array.isArray(dp)) return [];

  const parseMaybeArray = (val) => {
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'string') {
      const t = val.trim();
      if (!t) return [];
      try {
        const p = JSON.parse(t);
        return Array.isArray(p) ? p.filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  let sections = parseMaybeArray(dp.menuSections);
  if (!sections.length) sections = parseMaybeArray(dp.menu_sections);
  if (!sections.length) sections = parseMaybeArray(dp.menu);
  if (!sections.length) sections = parseMaybeArray(dp.diningMenuJson);
  if (!sections.length && dp.menu && typeof dp.menu === 'object' && !Array.isArray(dp.menu)) {
    sections = menuObjectToSections(dp.menu);
  }

  sections = normalizeSectionsShape(sections);

  const menuPlainSource =
    dp.menuPlain ||
    dp.menu_plain ||
    dp.menuText ||
    dp.menu_text ||
    dp.diningMenuPlain ||
    dp.dining_menu_plain ||
    (Array.isArray(dp.menu) ? '' : dp.menu);
  const plain = String(menuPlainSource || '').trim();
  const plainSections = plain ? parseMenuSectionsPlainText(plain) : [];

  const countItems = (secs) =>
    (Array.isArray(secs) ? secs : []).reduce((n, s) => n + sectionItemsFromRaw(s).length, 0);

  if (!sections.length) return plainSections;

  /** Structured rows exist but every item was empty / lost — fall back to plain-text menu. */
  if (countItems(sections) === 0 && countItems(plainSections) > 0) return plainSections;

  /** Top-level `menu: [ {...}, {...} ]` dish rows without section wrappers (common in imports). */
  if (countItems(sections) === 0 && Array.isArray(dp.menu) && dp.menu.length) {
    const flat = flatMenuArrayToSingleSection(dp.menu);
    if (flat) return flat;
  }

  return sections;
}

export function splitCommaList(value) {
  return String(value || '')
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseSignatureDishLines(value) {
  return String(value || '')
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = '', price = '', description = '', badge = ''] = line.split('|').map((part) => part.trim());
      return {
        name,
        ...(price ? { price } : {}),
        ...(description ? { description } : {}),
        ...(badge ? { badge } : {}),
      };
    })
    .filter((item) => item.name);
}

const emptyMenuItem = () => ({
  name: '',
  price: '',
  description: '',
  badge: '',
  image: '',
});

/** Shape used by the business dining menu builder (step-by-step, no JSON). */
export function normalizeMenuSectionsForEditor(raw) {
  const safe = Array.isArray(raw) ? raw : [];
  const mapped = safe.map((s) => {
    const title = String(s?.title || s?.heading || s?.sectionTitle || s?.section || '').trim();
    const note = String(s?.note || s?.notes || '').trim();
    const items = sectionItemsFromRaw(s)
      .map((it) => {
        if (typeof it === 'string') {
          const n = it.trim();
          return n ? { ...emptyMenuItem(), name: n } : null;
        }
        if (!it || typeof it !== 'object') return null;
        const name = dishNameFromItem(it);
        return {
          name,
          price: String(it.price || it.cost || '').trim(),
          description: String(it.description || it.desc || '').trim(),
          badge: String(it.badge || '').trim(),
          image: dishImageFromItem(it),
        };
      })
      .filter((it) => it && it.name);
    return {
      title: title || 'Menu',
      note,
      items,
    };
  });
  const nonempty = mapped.filter((s) => s.title || s.items.length || s.note);
  return nonempty.length ? nonempty : [{ title: 'Menu', note: '', items: [] }];
}

/** Strips empty rows; omits empty optional fields on items for smaller payloads. */
export function sanitizeMenuSectionsForSave(sections) {
  if (!Array.isArray(sections)) return [];
  const out = [];
  for (const s of sections) {
    const title = String(s?.title || '').trim() || 'Menu';
    const note = String(s?.note || '').trim();
    const items = (Array.isArray(s?.items) ? s.items : [])
      .map((it) => {
        if (typeof it === 'string') {
          const n = String(it).trim();
          if (!n) return null;
          return { name: n };
        }
        if (!it || typeof it !== 'object') return null;
        const name = dishNameFromItem(it);
        if (!name) return null;
        const o = { name };
        const price = String(it.price || it.cost || '').trim();
        const description = String(it.description || it.desc || '').trim();
        const badge = String(it.badge || '').trim();
        const image = dishImageFromItem(it);
        if (price) o.price = price;
        if (description) o.description = description;
        if (badge) o.badge = badge;
        if (image) o.image = image;
        return o;
      })
      .filter(Boolean);
    if (items.length || note) out.push({ title, ...(note ? { note } : {}), items });
  }
  return out;
}

/**
 * Menu sections for public place UI — coalesces storage variants and legacy keys.
 * Returns [] when there is nothing to show.
 */
export function normalizeMenuSectionsForPlaceDisplay(dp) {
  const sections = coalesceMenuSectionsInput(dp);
  const safe = Array.isArray(sections) ? sections : [];
  const mapped = safe.map((s) => {
    const title = String(s?.title || s?.heading || s?.sectionTitle || s?.section || '').trim();
    const note = String(s?.note || s?.notes || '').trim();
    const items = sectionItemsFromRaw(s)
      .map((it) => {
        if (typeof it === 'string') {
          const n = it.trim();
          if (!n) return null;
          return { name: n, price: '', description: '', badge: '', image: '' };
        }
        if (!it || typeof it !== 'object') return null;
        const name = dishNameFromItem(it);
        if (!name) return null;
        return {
          name,
          price: String(it.price || it.cost || '').trim(),
          description: String(it.description || it.desc || '').trim(),
          badge: String(it.badge || '').trim(),
          image: dishImageFromItem(it),
        };
      })
      .filter(Boolean);
    return {
      title: title || 'Menu',
      note,
      items,
    };
  });
  return mapped.filter((section) => section.title || section.items.length > 0 || section.note);
}

/** Maps API `diningProfile` to flat form fields used by business + admin editors. */
export function diningProfileToFormFields(dp) {
  const profile = dp && typeof dp === 'object' && !Array.isArray(dp) ? dp : {};
  const signatureLines = Array.isArray(profile.signatureDishes)
    ? profile.signatureDishes
        .map((item) => {
          if (typeof item === 'string') return item;
          if (!item || typeof item !== 'object') return '';
          return [item.name || '', item.price || '', item.description || '', item.badge || '']
            .map((part) => String(part || '').trim())
            .join(' | ')
            .replace(/(\s\|\s)+$/, '');
        })
        .filter(Boolean)
        .join('\n')
    : '';

  const sectionsForEditor = normalizeMenuSectionsForEditor(coalesceMenuSectionsInput(profile));
  const menuPlain = menuSectionsToPlainText(sectionsForEditor);

  return {
    diningCuisines: Array.isArray(profile.cuisines) ? profile.cuisines.join(', ') : '',
    diningBestFor: Array.isArray(profile.bestFor) ? profile.bestFor.join(', ') : '',
    diningDietary: Array.isArray(profile.dietaryOptions) ? profile.dietaryOptions.join(', ') : '',
    diningServices: Array.isArray(profile.serviceModes) ? profile.serviceModes.join(', ') : '',
    diningAtmosphere: profile.atmosphere || '',
    diningReservationNotes: profile.reservationNotes || '',
    diningContactAddress: profile.contactAddress || profile.address || '',
    diningContactPhone: profile.contactPhone || profile.phone || '',
    diningContactEmail: profile.contactEmail || profile.email || '',
    diningContactNote: profile.contactNote || '',
    diningMenuNote: profile.menuNote || '',
    diningSignatureDishes: signatureLines,
    diningMenuPlain: menuPlain,
    diningMenuSections: sectionsForEditor,
  };
}

/** Builds the API payload object from flat dining form fields. */
export function buildDiningProfilePayload(form) {
  const fromStructured = sanitizeMenuSectionsForSave(form.diningMenuSections || []);
  const fromPlain = parseMenuSectionsPlainText(form.diningMenuPlain);
  const menuSections = fromStructured.length > 0 ? fromStructured : fromPlain;
  return {
    cuisines: splitCommaList(form.diningCuisines),
    bestFor: splitCommaList(form.diningBestFor),
    dietaryOptions: splitCommaList(form.diningDietary),
    serviceModes: splitCommaList(form.diningServices),
    atmosphere: String(form.diningAtmosphere || '').trim(),
    reservationNotes: String(form.diningReservationNotes || '').trim(),
    contactAddress: String(form.diningContactAddress || '').trim(),
    contactPhone: String(form.diningContactPhone || '').trim(),
    contactEmail: String(form.diningContactEmail || '').trim(),
    contactNote: String(form.diningContactNote || '').trim(),
    menuNote: String(form.diningMenuNote || '').trim(),
    signatureDishes: parseSignatureDishLines(form.diningSignatureDishes),
    menuSections,
  };
}
