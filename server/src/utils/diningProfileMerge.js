'use strict';

function countMenuItemsInSections(sections) {
  if (!Array.isArray(sections)) return 0;
  let n = 0;
  for (const sec of sections) {
    if (!sec || typeof sec !== 'object') continue;
    const keys = ['items', 'dishes', 'menuItems', 'entries', 'lines', 'products', 'foods'];
    for (const k of keys) {
      if (Array.isArray(sec[k])) {
        n += sec[k].length;
        break;
      }
    }
  }
  return n;
}

function sectionsArrayFromProfile(o) {
  if (!o || typeof o !== 'object') return null;
  const ms = o.menuSections ?? o.menu_sections;
  return Array.isArray(ms) && ms.length ? ms : null;
}

function firstPlainMenuText(...objs) {
  for (const o of objs) {
    if (!o || typeof o !== 'object') continue;
    for (const k of ['menuPlain', 'menu_plain', 'menuText', 'menu_text', 'diningMenuPlain', 'dining_menu_plain']) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v;
    }
  }
  return '';
}

function mergeDiningProfileLayers(camel, snake) {
  const a = camel && typeof camel === 'object' && !Array.isArray(camel) ? camel : {};
  const b = snake && typeof snake === 'object' && !Array.isArray(snake) ? snake : {};
  const merged = { ...a, ...b };

  const ca = sectionsArrayFromProfile(a);
  const sb = sectionsArrayFromProfile(b);
  const cm = countMenuItemsInSections(ca);
  const sm = countMenuItemsInSections(sb);
  const mergedSecs = sectionsArrayFromProfile(merged);
  const mx = countMenuItemsInSections(mergedSecs);

  if (mx < Math.max(cm, sm)) {
    merged.menuSections = cm >= sm ? ca : sb;
  } else if (!mergedSecs || mx === 0) {
    if (cm) merged.menuSections = ca;
    else if (sm) merged.menuSections = sb;
  }

  if (!firstPlainMenuText(merged)) {
    const p = firstPlainMenuText(b, a);
    if (p) merged.menuPlain = p;
  }

  return merged;
}

module.exports = { mergeDiningProfileLayers, countMenuItemsInSections };
