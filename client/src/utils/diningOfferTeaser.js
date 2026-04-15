import { normalizeMenuSectionsForPlaceDisplay } from './diningProfileForm';

const OFFER_SPLIT = /[\n\r•·;]+/;

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function offerishText(txt) {
  return /(offer|deal|special|promo|happy|set menu|menu du jour|ladies|night|%|discount|free)/i.test(
    String(txt)
  );
}

function sectionTitleIsOfferish(title) {
  return /(special|deal|offer|promo|happy|set|combo|lunch|dinner|chef|seasonal|limited)/i.test(
    String(title || '')
  );
}

function linesFromMenu(place, push) {
  const dp = place?.diningProfile && typeof place.diningProfile === 'object' ? place.diningProfile : {};
  for (const dish of safeArray(dp.signatureDishes)) {
    const name = String(dish?.name || '').trim();
    if (!name) continue;
    const badge = String(dish?.badge || '').trim();
    const price = String(dish?.price || '').trim();
    if (badge && offerishText(badge)) {
      push(`${name}${price ? ` — ${price}` : ''} · ${badge}`);
    }
  }
  for (const section of normalizeMenuSectionsForPlaceDisplay(dp)) {
    const st = String(section?.title || '').trim();
    const inOfferSection = sectionTitleIsOfferish(st);
    for (const item of safeArray(section?.items)) {
      const name = String(item?.name || '').trim();
      if (!name) continue;
      const badge = String(item?.badge || '').trim();
      const price = String(item?.price || '').trim();
      if (badge && offerishText(badge)) {
        push(`${name}${price ? ` — ${price}` : ''} · ${badge}`);
      } else if (inOfferSection) {
        push(`${st ? `${st}: ` : ''}${name}${price ? ` — ${price}` : ''}`);
      }
    }
  }
}

/**
 * Distinct offer lines for a place (tags, menu notes, menu “specials”, badges). Used for Deals & specials.
 * @returns {string[]}
 */
export function diningOfferLines(place) {
  const dp = place?.diningProfile && typeof place.diningProfile === 'object' ? place.diningProfile : {};
  const note = String(dp.menuNote || '').trim();
  const tagBits = Array.isArray(place.tags) ? place.tags.map((x) => String(x)) : [];
  const out = [];
  const push = (s) => {
    const t = String(s || '').trim();
    if (!t || t.length < 3) return;
    const low = t.toLowerCase();
    if (out.some((x) => x.toLowerCase() === low)) return;
    out.push(t.length > 140 ? `${t.slice(0, 137)}…` : t);
  };

  if (note) {
    const parts = note
      .split(OFFER_SPLIT)
      .map((x) => x.trim())
      .filter(Boolean);
    for (const p of parts) {
      if (offerishText(p) || parts.length === 1) push(p);
    }
  }
  for (const tag of tagBits) {
    if (offerishText(tag)) push(tag);
  }

  linesFromMenu(place, push);

  if (!out.length) {
    const one = diningOfferTeaser(place);
    if (one) push(one);
  }
  return out.slice(0, 12);
}

export function diningOfferTeaser(place) {
  const dp = place?.diningProfile && typeof place.diningProfile === 'object' ? place.diningProfile : {};
  const note = String(dp.menuNote || '').trim();
  const tagBits = Array.isArray(place.tags) ? place.tags.map((x) => String(x)) : [];
  if (note && offerishText(note)) {
    return note.length > 160 ? `${note.slice(0, 157)}…` : note;
  }
  const fromTags = tagBits.filter((t) => offerishText(t));
  if (fromTags.length) return fromTags.slice(0, 3).join(' · ');
  if (note) return note.length > 160 ? `${note.slice(0, 157)}…` : note;
  return '';
}
