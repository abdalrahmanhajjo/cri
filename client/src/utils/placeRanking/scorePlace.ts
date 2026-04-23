import { semanticMatch, type SemanticMatchResult } from './semanticMatch.ts';

export type PlaceScoreBreakdown = {
  total: number;
  aiRelevance: number;
  intentMatch: number;
  semanticMatch: number;
  distanceScore: number;
  timeFit: number;
  weatherFit: number;
  paceFit: number;
  diversityGain: number;
  anchorValue: number;
  penalties: {
    travel: number;
    redundancy: number;
    heat: number;
  };
  reasons: string[];
};

export type ScoreWeights = {
  aiRelevance: number;
  intentMatch: number;
  semanticMatch: number;
  distanceScore: number;
  timeFit: number;
  weatherFit: number;
  paceFit: number;
  diversityGain: number;
  anchorValue: number;
  penalties: {
    travel: number;
    redundancy: number;
    heat: number;
  };
};

export type PlaceLike = {
  id?: string | number;
  name?: string;
  description?: string;
  location?: string;
  category?: string;
  categoryId?: string;
  tags?: unknown;
  bestTime?: string;
  duration?: string;
  price?: string;
  rating?: number;
  reviewCount?: number;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  coordinates?: { lat?: number; lng?: number } | null;
  ai_rerank_score?: number;
  ai_reasons?: string[];
  ai_profile?: any;
};

export type ScoreContext = {
  intentText: string;
  interestNames?: string[];
  budget?: 'low' | 'moderate' | 'luxury';
  pace?: 'relaxed' | 'normal' | 'packed';
  selectedPlaces?: PlaceLike[];
  previousPlace?: PlaceLike | null;
  preferredArea?: string | null;
  slotIndex?: number;
  weather?: { poorOutdoor?: boolean; hot?: boolean } | null;
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  aiRelevance: 30, // Priority
  intentMatch: 10,
  semanticMatch: 16,
  distanceScore: 6,
  timeFit: 4,
  weatherFit: 3,
  paceFit: 2,
  diversityGain: 5,
  anchorValue: 7,
  penalties: {
    travel: 6,
    redundancy: 6,
    heat: 2,
  },
};

function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function asTagList(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map((t) => String(t || '').trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(/[,;|]+/g).map((x) => x.trim()).filter(Boolean);
  return [];
}

function placeTextForMatching(place: PlaceLike): string {
  return [
    place.name,
    place.category,
    place.categoryId,
    place.location,
    place.description,
    ...asTagList(place.tags),
  ]
    .filter(Boolean)
    .join(' ');
}

function isOutdoorish(place: PlaceLike): boolean {
  const blob = norm(placeTextForMatching(place));
  return /(park|promenade|corniche|seafront|waterfront|beach|view|outdoor|old city|souk|souq|citadel|mina|port)/.test(blob);
}

function anchorHeuristic(place: PlaceLike): number {
  const blob = norm(placeTextForMatching(place));
  const anchors = ['citadel', 'souk', 'souq', 'khan', 'hallab', 'clock', 'mosque', 'mina', 'corniche'];
  let s = 0;
  for (const k of anchors) if (blob.includes(k)) s += 1;
  if (place.rating != null && place.rating >= 4.5) s += 1;
  if (place.reviewCount != null && place.reviewCount >= 50) s += 1;
  return Math.min(4, s);
}

function bestTimeBucket(raw?: string): 'morning' | 'afternoon' | 'evening' | 'any' {
  const bt = norm(raw || '');
  if (!bt) return 'any';
  if (bt.includes('morning')) return 'morning';
  if (bt.includes('afternoon') || bt.includes('midday') || bt.includes('noon')) return 'afternoon';
  if (bt.includes('evening') || bt.includes('sunset') || bt.includes('night')) return 'evening';
  return 'any';
}

function getCoord(place: PlaceLike, key: 'lat' | 'lng'): number {
  if (key === 'lat') return Number(place.latitude ?? place.lat ?? place.coordinates?.lat);
  return Number(place.longitude ?? place.lng ?? place.coordinates?.lng);
}

function haversineKm(a: PlaceLike, b: PlaceLike): number | null {
  const lat1 = getCoord(a, 'lat');
  const lon1 = getCoord(a, 'lng');
  const lat2 = getCoord(b, 'lat');
  const lon2 = getCoord(b, 'lng');
  if (![lat1, lon1, lat2, lon2].every((n) => Number.isFinite(n))) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const sa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
  return R * c;
}

function categoryKey(place: PlaceLike): string {
  return norm(place.category || place.categoryId || 'other') || 'other';
}

export function scorePlace(
  place: PlaceLike,
  ctx: ScoreContext,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): { breakdown: PlaceScoreBreakdown; semantic: SemanticMatchResult; category: string } {
  const reasons: string[] = [];
  const selected = Array.isArray(ctx.selectedPlaces) ? ctx.selectedPlaces : [];
  const category = categoryKey(place);
  const placeText = placeTextForMatching(place);
  const intent = ctx.intentText || '';
  const semantic = semanticMatch(intent, placeText);

  let intentRaw = 0;
  const interests = Array.isArray(ctx.interestNames) ? ctx.interestNames : [];
  if (interests.length) {
    const blob = norm(placeText);
    for (const interest of interests) {
      const token = norm(interest);
      if (token && blob.includes(token)) intentRaw += 1;
    }
  }
  const intentMatch = weights.intentMatch * Math.min(1, intentRaw / 2);
  if (intentMatch > 0) reasons.push('Matches your selected themes');

  const aiRelevance = weights.aiRelevance * (Math.min(place.ai_rerank_score || 0, 2) / 2); // Normalized max ~2
  if (aiRelevance > 0 && place.ai_reasons) {
    place.ai_reasons.forEach(r => reasons.push(r));
  }

  const semanticMatchScore = weights.semanticMatch * semantic.score;
  if (semantic.reasons.length) reasons.push(...semantic.reasons.slice(0, 2));

  let distanceScore = 0;
  let travelPenalty = 0;
  if (ctx.previousPlace) {
    const km = haversineKm(ctx.previousPlace, place);
    if (km != null) {
      const close = Math.max(0, 1 - km / 5);
      distanceScore = weights.distanceScore * close;
      if (km <= 1.2) reasons.push('Close to previous stop');
      if (km >= 3.5) travelPenalty = weights.penalties.travel * Math.min(1, (km - 3.5) / 3);
    }
  }

  let timeFit = 0;
  const slotIndex = Number.isFinite(Number(ctx.slotIndex)) ? Number(ctx.slotIndex) : null;
  if (slotIndex != null) {
    const desired = slotIndex <= 0 ? 'morning' : slotIndex === 1 ? 'afternoon' : 'evening';
    const bt = bestTimeBucket(place.bestTime);
    const ok = bt === 'any' || bt === desired;
    timeFit = weights.timeFit * (ok ? 1 : 0.25);
    if (ok && bt !== 'any') reasons.push(`Better visited in the ${desired}`);
  }

  let weatherFit = 0;
  let heatPenalty = 0;
  const weather = ctx.weather || null;
  if (weather?.poorOutdoor && isOutdoorish(place)) {
    weatherFit = -weights.weatherFit * 0.8;
  } else if (weather?.poorOutdoor === false && isOutdoorish(place)) {
    weatherFit = weights.weatherFit * 0.25;
  }
  if (weather?.hot && isOutdoorish(place)) {
    heatPenalty = weights.penalties.heat * 0.8;
  }

  let paceFit = 0;
  const pace = ctx.pace || 'normal';
  const dur = norm(place.duration || '');
  if (pace === 'relaxed') {
    if (/2\s*h|3\s*h|half day|long|extended/.test(dur)) paceFit = weights.paceFit * 0.6;
  } else if (pace === 'packed') {
    if (/30\s*m|45\s*m|1\s*h|short|quick/.test(dur)) paceFit = weights.paceFit * 0.6;
  } else {
    paceFit = weights.paceFit * 0.2;
  }

  let diversityGain = 0;
  if (selected.length) {
    const seen = new Set(selected.map(categoryKey));
    diversityGain = weights.diversityGain * (seen.has(category) ? 0 : 1);
    if (!seen.has(category)) reasons.push('Adds variety to your plan');
  }

  let redundancyPenalty = 0;
  if (selected.length) {
    const seen = selected.map(categoryKey);
    const count = seen.filter((x) => x === category).length;
    if (count >= 2) redundancyPenalty = weights.penalties.redundancy * Math.min(1, (count - 1) / 2);
  }

  const anchorValue = weights.anchorValue * (anchorHeuristic(place) / 4);
  if (anchorValue >= weights.anchorValue * 0.6) reasons.push('Strong anchor stop');

  const penalties = {
    travel: travelPenalty,
    redundancy: redundancyPenalty,
    heat: heatPenalty,
  };

  const total =
    aiRelevance +
    intentMatch +
    semanticMatchScore +
    distanceScore +
    timeFit +
    weatherFit +
    paceFit +
    diversityGain +
    anchorValue -
    penalties.travel -
    penalties.redundancy -
    penalties.heat;

  return {
    breakdown: {
      total,
      aiRelevance,
      intentMatch,
      semanticMatch: semanticMatchScore,
      distanceScore,
      timeFit,
      weatherFit,
      paceFit,
      diversityGain,
      anchorValue,
      penalties,
      reasons: reasons.filter(Boolean).slice(0, 6),
    },
    semantic,
    category,
  };
}
