/**
 * Ranks places for the AI planner so the model sees strong candidates first
 * (interests, budget, user message, geographic hints) while keeping diversity.
 */

const BUDGET_LOW_HINTS = /\b(free|cheap|budget|low|econom|€?0|\$0|gratis|مجاني|رخيص|اقتصاد)/i;
const BUDGET_HIGH_HINTS = /\b(luxury|upscale|fine|splurge|treat|premium|فاخر|رفاه)/i;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function areaBucket(place) {
  const loc = norm(place?.location);
  const name = norm(place?.name);
  const blob = `${loc} ${name}`;
  if (/(mina|port|seafront|corniche|fish|ميناء|منارة)/.test(blob)) return 'mina';
  if (/(old city|souk|souq|khan|citadel|tell|مدينة قديمة|سوق|خان|قلعة)/.test(blob)) return 'old_city';
  return 'other';
}

function priceTier(place) {
  const p = norm(place?.price);
  if (!p) return 'unknown';
  if (/free|gratis|مجاني|0\.|€0|\$0|^0\b/.test(p)) return 'free';
  if (/low|cheap|\$|€{1,2}|1\b|2\b|affordable|رخيص/.test(p)) return 'low';
  if (/high|luxury|premium|€{3,}|\$\$\$|expensive|فاخر/.test(p)) return 'high';
  if (/moderate|mid|\$\$/i.test(p)) return 'moderate';
  return 'unknown';
}

function tagsTokens(place) {
  const t = place?.tags;
  if (!Array.isArray(t)) return [];
  return t.map((x) => norm(x)).filter(Boolean);
}

/**
 * @param {string} userMessage
 * @param {string[]} interestNames
 * @param {'low'|'moderate'|'luxury'} budget
 */
export function extractPlannerKeywords(userMessage, interestNames, budget) {
  const parts = [];
  for (const n of interestNames || []) {
    if (n) parts.push(norm(n));
  }
  if (userMessage) parts.push(norm(userMessage));
  const blob = parts.join(' ');
  const tokens = new Set();
  for (const w of blob.split(/[^a-zA-Z0-9\u0600-\u06FF]+/).filter((x) => x.length > 2)) {
    tokens.add(w);
  }
  for (const phrase of [
    'museum',
    'mosque',
    'church',
    'citadel',
    'souk',
    'sweet',
    'dessert',
    'knefe',
    'knafah',
    'coffee',
    'seafood',
    'fish',
    'family',
    'history',
    'shopping',
    'craft',
    'soap',
    'beach',
    'view',
    'restaurant',
    'dining',
    'breakfast',
    'lunch',
    'dinner',
    'brunch',
    'cuisine',
    'akra',
    'baytna',
    'rawand',
    'hallab',
  ]) {
    if (blob.includes(phrase)) tokens.add(phrase);
  }
  for (const phrase of ['مطعم', 'مأكولات', 'طعام', 'حلويات', 'فطور', 'غداء', 'عشاء', 'كنافة']) {
    if (blob.includes(phrase)) tokens.add(phrase);
  }
  return { blob, tokens, budget };
}

function foodIntent(blob) {
  return /\b(food|eat|dining|restaurant|cuisine|lunch|breakfast|dinner|brunch|sweet|dessert|knefe|knafah|konafa|coffee|hungry|meal|فطور|غداء|عشاء|مطعم|أكل|طعام|حلويات|كنافة)\b/i.test(
    blob
  );
}

function scorePlace(place, { blob, tokens, budget }) {
  let score = 0;
  const name = norm(place?.name);
  const cat = norm(place?.category);
  const loc = norm(place?.location);
  const desc = norm(place?.description?.slice?.(0, 200));
  const hay = `${name} ${cat} ${loc} ${desc}`;
  const tagStr = tagsTokens(place).join(' ');
  const idNorm = norm(place?.id);

  for (const tok of tokens) {
    if (tok.length < 3) continue;
    if (hay.includes(tok) || tagStr.includes(tok)) score += 3;
  }
  if (blob.length > 4) {
    for (const phrase of [
      'museum',
      'mosque',
      'citadel',
      'souk',
      'sweet',
      'hallab',
      'rahall',
      'khan',
      'mina',
      'fish',
      'akra',
      'baytna',
      'rawand',
      'restaurant',
      'lunch',
      'dinner',
      'cuisine',
      'knefe',
      'knafah',
    ]) {
      if (blob.includes(phrase) && hay.includes(phrase)) score += 2;
    }
  }

  if (foodIntent(blob)) {
    if (/(restaurant|cuisine|food|sweet|sweets|dining|مطعم|مأكولات|حلو|coffee|cafe)/.test(cat))
      score += 4;
    if (/(hallab|akra|baytna|rawand|rahall|knefe)/.test(name) || /(hallab|akra|baytna|rawand|rahall)/.test(idNorm))
      score += 5;
  }

  const tier = priceTier(place);
  if (budget === 'low') {
    if (tier === 'free' || tier === 'low') score += 2;
    if (tier === 'high') score -= 1;
  } else if (budget === 'luxury') {
    if (tier === 'high' || tier === 'moderate') score += 1;
  }

  if (place?.rating != null && place.rating >= 4.2) score += 1;
  if (place?.reviewCount != null && place.reviewCount > 30) score += 0.5;

  return score;
}

/**
 * Stratified sample: ensure mix of areas and categories in the head of the list.
 */
export function rankPlacesForPlanner(places, options = {}) {
  const {
    userMessage = '',
    interestNames = [],
    budget = 'moderate',
    maxForPrompt = 52,
    learnedCategoryHints = [],
  } = options;

  const list = Array.isArray(places) ? [...places] : [];
  if (list.length === 0) return { ordered: [], hintLines: [] };

  const learnedSet = new Set(
    (Array.isArray(learnedCategoryHints) ? learnedCategoryHints : [])
      .map((c) => norm(c))
      .filter(Boolean)
  );

  const kw = extractPlannerKeywords(userMessage, interestNames, budget);
  const scored = list.map((p) => {
    let s = scorePlace(p, kw);
    const catn = norm(p.category);
    if (learnedSet.size > 0 && catn && learnedSet.has(catn)) s += 3;
    return { p, s };
  });
  scored.sort((a, b) => b.s - a.s);

  const taken = new Set();
  const ordered = [];

  const pick = (predicate) => {
    for (const row of scored) {
      const id = String(row.p.id);
      if (taken.has(id)) continue;
      if (predicate(row.p)) {
        taken.add(id);
        ordered.push(row.p);
        return true;
      }
    }
    return false;
  };

  // 1) Top-scoring unique places (model sees relevance first)
  for (const row of scored) {
    const id = String(row.p.id);
    if (taken.has(id)) continue;
    if (row.s > 0) {
      taken.add(id);
      ordered.push(row.p);
    }
    if (ordered.length >= Math.min(14, maxForPrompt)) break;
  }

  // 2) Geographic spread: at least one from mina + old city if available
  pick((p) => areaBucket(p) === 'mina');
  pick((p) => areaBucket(p) === 'old_city');

  // 3) Category diversity: one per distinct category among remaining high scorers
  const seenCat = new Set(ordered.map((p) => norm(p.category)));
  for (const row of scored) {
    const id = String(row.p.id);
    if (taken.has(id)) continue;
    const c = norm(row.p.category);
    if (c && !seenCat.has(c)) {
      taken.add(id);
      seenCat.add(c);
      ordered.push(row.p);
    }
    if (ordered.length >= 22) break;
  }

  // 4) Fill by score order
  for (const row of scored) {
    const id = String(row.p.id);
    if (taken.has(id)) continue;
    taken.add(id);
    ordered.push(row.p);
    if (ordered.length >= maxForPrompt) break;
  }

  const hintLines = [];
  if (kw.budget === 'low' || BUDGET_LOW_HINTS.test(kw.blob)) {
    hintLines.push('User budget is modest: prefer free/low-cost venues where possible; still vary the day.');
  }
  if (kw.budget === 'luxury' || BUDGET_HIGH_HINTS.test(kw.blob)) {
    hintLines.push('User is comfortable spending: include standout food/experience stops where tags/price suggest quality.');
  }
  if (ordered.length >= 2) {
    const buckets = new Set(ordered.slice(0, 24).map((p) => areaBucket(p)));
    if (buckets.size >= 2) {
      hintLines.push(
        'Places are tagged by area hints in the list (location). When possible, cluster consecutive stops to reduce walking—Old City/souks vs Al-Mina/waterfront.'
      );
    }
  }
  if (interestNames?.length) {
    hintLines.push(`User selected themes: ${interestNames.join(', ')} — weight those heavily in choices and reasons.`);
  }
  if (learnedCategoryHints.length) {
    hintLines.push(
      `From earlier AI plans on this device they often saw these listing categories: ${learnedCategoryHints.slice(0, 6).join(', ')} — when it fits the request, lean on that taste but still add variety.`
    );
  }
  if (foodIntent(kw.blob)) {
    hintLines.push(
      'User asked for food/dining/sweets: prioritize Restaurants & cuisine and sweet-shop listings from the catalog when routing (e.g. flagship sweets and sit-down meals), mixed with heritage if they want a full day.'
    );
  }

  return { ordered, hintLines };
}

/**
 * Compact, model-friendly place rows (keep tokens small).
 */
export function compactPlaceRowForModel(p) {
  const tags = Array.isArray(p.tags) ? p.tags.slice(0, 4).map((t) => String(t).trim()).filter(Boolean) : [];
  const loc = p.location != null ? String(p.location).trim() : '';
  const locShort = loc.length > 42 ? `${loc.slice(0, 40)}…` : loc;
  const dur = p.duration != null ? String(p.duration).trim() : '';
  const price = p.price != null ? String(p.price).trim() : '';
  const bt = p.bestTime != null ? String(p.bestTime).trim().toLowerCase() : '';
  const area = areaBucket(p);
  return {
    id: String(p.id),
    name: p.name != null ? String(p.name) : '',
    category: p.category != null ? String(p.category) : '',
    area,
    location: locShort,
    bestTime: bt || undefined,
    duration: dur || undefined,
    price: price || undefined,
    tags: tags.length ? tags : undefined,
  };
}
