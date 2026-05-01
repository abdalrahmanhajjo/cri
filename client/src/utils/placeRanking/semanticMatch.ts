export type SemanticMatchResult = {
  score: number;
  matchedTokens: string[];
  reasons: string[];
  intentTokens: string[];
  placeTokens: string[];
};

export type SemanticMatchOptions = {
  // TODO(embeddings): replace fallback token expansion with embedding similarity.
  synonyms?: Record<string, string[]>;
  stopwords?: Set<string>;
};

const DEFAULT_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
  'i', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'with',
  'we', 'you', 'your', 'et', 'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une',
  'pour', 'avec',
]);

const DEFAULT_SYNONYMS: Record<string, string[]> = {
  history: ['heritage', 'historic', 'old', 'mamluk', 'ottoman', 'traditional'],
  heritage: ['history', 'culture', 'historic', 'old'],
  museum: ['gallery', 'exhibit', 'cultural', 'heritage'],
  culture: ['heritage', 'museum', 'historic', 'art', 'craft'],
  old_city: ['old', 'city', 'souk', 'souq', 'khan', 'citadel'],
  souk: ['souq', 'market', 'bazaar', 'shopping'],
  food: ['restaurant', 'cafe', 'coffee', 'dessert', 'breakfast', 'lunch', 'dinner'],
  foodie: ['restaurant', 'cafe', 'coffee', 'dessert', 'breakfast', 'lunch', 'dinner', 'food'],
  sweets: ['dessert', 'sweet', 'baklava', 'knafeh', 'hallab'],
  seafood: ['fish', 'mina', 'port', 'harbor', 'harbour'],
  scenic: ['view', 'panorama', 'sunset', 'seafront', 'corniche', 'waterfront'],
  nature: ['park', 'garden', 'outdoor', 'walk'],
  family: ['kids', 'children', 'family-friendly', 'easy'],
  shopping: ['market', 'souk', 'souq', 'bazaar', 'craft'],
  faith: ['mosque', 'church', 'spiritual', 'religious'],
  church: ['churches', 'faith', 'religious', 'cathedral', 'shrine'],
  mosque: ['mosques', 'faith', 'religious', 'masjid', 'jami'],
};

function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenize(raw: string, stopwords: Set<string>): string[] {
  const parts = norm(raw).split(/[^a-z0-9\u0600-\u06ff]+/g).filter(Boolean);
  return parts.filter((p) => p.length >= 3 && !stopwords.has(p));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

function expandIntentTokens(tokens: string[], synonyms: Record<string, string[]>): string[] {
  const out = new Set(tokens);
  for (const token of tokens) {
    const syns = synonyms[token];
    if (syns) {
      for (const syn of syns) out.add(norm(syn));
    }
    // Basic auto-pluralization & singularization
    if (token.endsWith('s') && token.length > 3) out.add(token.slice(0, -1));
    if (token.endsWith('es') && token.length > 4) out.add(token.slice(0, -2));
    if (token.endsWith('ies') && token.length > 4) out.add(token.slice(0, -3) + 'y');
    out.add(token + 's');
    if (!token.endsWith('e')) out.add(token + 'es');
  }
  if (out.has('history') || out.has('heritage') || out.has('historic')) {
    ['citadel', 'khan', 'souk', 'souq', 'old', 'mamluk', 'ottoman'].forEach((x) => out.add(x));
  }
  if (out.has('museum') || out.has('culture') || out.has('cultural')) {
    ['gallery', 'heritage', 'old', 'art', 'craft'].forEach((x) => out.add(x));
  }
  if (out.has('sea') || out.has('scenic') || out.has('waterfront') || out.has('seafront')) {
    ['mina', 'port', 'corniche', 'sunset', 'view'].forEach((x) => out.add(x));
  }
  if (out.has('food') || out.has('dessert')) {
    ['restaurant', 'cafe', 'seafood', 'sweet', 'breakfast'].forEach((x) => out.add(x));
  }
  return Array.from(out);
}

export function semanticMatch(
  intentText: string,
  placeText: string,
  options: SemanticMatchOptions = {}
): SemanticMatchResult {
  const stopwords = options.stopwords || DEFAULT_STOPWORDS;
  const synonyms = options.synonyms || DEFAULT_SYNONYMS;
  const intentBase = tokenize(intentText, stopwords);
  const intentTokens = expandIntentTokens(intentBase, synonyms);
  const placeTokens = tokenize(placeText, stopwords);

  const intentSet = new Set(intentTokens);
  const placeSet = new Set(placeTokens);
  const score = Math.max(0, Math.min(1, jaccard(intentSet, placeSet)));
  const matchedTokens = Array.from(intentSet).filter((t) => placeSet.has(t)).slice(0, 10);
  const reasons: string[] = [];
  if (matchedTokens.length) {
    reasons.push(`Matches themes: ${matchedTokens.slice(0, 4).join(', ')}`);
  } else if (score >= 0.2) {
    reasons.push('Semantically aligned with your intent');
  }

  return {
    score,
    matchedTokens,
    reasons,
    intentTokens,
    placeTokens,
  };
}
