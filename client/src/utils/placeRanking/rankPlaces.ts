import {
  scorePlace,
  DEFAULT_SCORE_WEIGHTS,
  type PlaceLike,
  type PlaceScoreBreakdown,
  type ScoreContext,
  type ScoreWeights,
} from './scorePlace.ts';

export type RankedPlace = {
  place: PlaceLike;
  breakdown: PlaceScoreBreakdown;
  category: string;
  tokens: string[];
};

export type RankPlacesOptions = {
  weights?: Partial<ScoreWeights>;
  selectedPlaces?: PlaceLike[];
  previousPlace?: PlaceLike | null;
  preferredArea?: string | null;
  slotIndex?: number;
  weather?: ScoreContext['weather'];
  pace?: ScoreContext['pace'];
  budget?: ScoreContext['budget'];
  interestNames?: string[];
};

function mergeWeights(base: ScoreWeights, patch?: Partial<ScoreWeights>): ScoreWeights {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    penalties: {
      ...base.penalties,
      ...(patch.penalties || {}),
    },
  };
}

function stablePlaceId(p: PlaceLike): string {
  return String(p?.id ?? '');
}

export function rankPlaces(
  candidates: PlaceLike[],
  intentText: string,
  options: RankPlacesOptions = {}
): RankedPlace[] {
  const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  if (!list.length) return [];

  const weights = mergeWeights(DEFAULT_SCORE_WEIGHTS, options.weights);
  const selectedPlaces = Array.isArray(options.selectedPlaces) ? options.selectedPlaces : [];

  const ranked = list.map((place) => {
    const ctx: ScoreContext = {
      intentText,
      interestNames: options.interestNames,
      budget: options.budget,
      pace: options.pace,
      selectedPlaces,
      previousPlace: options.previousPlace ?? null,
      preferredArea: options.preferredArea ?? null,
      slotIndex: options.slotIndex,
      weather: options.weather ?? null,
    };
    const { breakdown, semantic, category } = scorePlace(place, ctx, weights);
    return {
      place,
      breakdown,
      category,
      tokens: semantic.placeTokens,
    };
  });

  ranked.sort((a, b) => {
    const diff = b.breakdown.total - a.breakdown.total;
    if (diff !== 0) return diff;
    return stablePlaceId(a.place).localeCompare(stablePlaceId(b.place));
  });

  return ranked;
}
