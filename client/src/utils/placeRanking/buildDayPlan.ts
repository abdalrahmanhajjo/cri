import type { PlaceLike } from './scorePlace.ts';
import { rankPlaces, type RankedPlace } from './rankPlaces.ts';
import { mmrSelect } from './mmrSelect.ts';

export type BuildDayPlanOptions = {
  placesPerDay: number;
  dayIndex?: number;
  preferredArea?: string | null;
  budget?: 'low' | 'moderate' | 'luxury';
  pace?: 'relaxed' | 'normal' | 'packed';
  interestNames?: string[];
  weather?: { poorOutdoor?: boolean; hot?: boolean } | null;
  debug?: boolean;
};

function stableId(p: PlaceLike): string {
  return String(p?.id ?? '');
}

function haversineKm(a: PlaceLike, b: PlaceLike): number | null {
  const lat1 = Number(a.latitude ?? a.lat ?? a.coordinates?.lat);
  const lon1 = Number(a.longitude ?? a.lng ?? a.coordinates?.lng);
  const lat2 = Number(b.latitude ?? b.lat ?? b.coordinates?.lat);
  const lon2 = Number(b.longitude ?? b.lng ?? b.coordinates?.lng);
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

function nearestNeighborOrder(selected: RankedPlace[]): RankedPlace[] {
  if (selected.length <= 2) return selected.slice();
  const remaining = selected.slice();
  remaining.sort((a, b) => b.breakdown.anchorValue - a.breakdown.anchorValue);
  const ordered: RankedPlace[] = [remaining.shift() as RankedPlace];

  while (remaining.length) {
    const last = ordered[ordered.length - 1].place;
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const km = haversineKm(last, remaining[i].place);
      const distance = km == null ? 999 : km;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    ordered.push(remaining.splice(bestIndex, 1)[0]);
  }

  return ordered;
}

export function buildDayPlan(
  places: PlaceLike[],
  intentText: string,
  options: BuildDayPlanOptions
): { selected: RankedPlace[]; ranked: RankedPlace[] } {
  const k = Math.max(1, Math.min(8, Math.floor(options.placesPerDay || 4)));
  const baseRanked = rankPlaces(places, intentText, {
    budget: options.budget,
    pace: options.pace,
    interestNames: options.interestNames,
    weather: options.weather ?? null,
  });
  if (!baseRanked.length) return { selected: [], ranked: [] };

  const anchorPool = baseRanked.slice(0, Math.min(24, baseRanked.length)).slice();
  anchorPool.sort((a, b) => (b.breakdown.anchorValue + b.breakdown.total) - (a.breakdown.anchorValue + a.breakdown.total));
  const anchorCount = k >= 4 ? 2 : 1;
  const anchors = mmrSelect(anchorPool, {
    k: anchorCount,
    lambda: 0.7,
    relevance: (x: RankedPlace) => x.breakdown.anchorValue + x.breakdown.total,
  }) as RankedPlace[];

  const selected: RankedPlace[] = [];
  const selectedIds = new Set<string>();
  for (const anchor of anchors) {
    const id = stableId(anchor.place);
    if (!id || selectedIds.has(id)) continue;
    selectedIds.add(id);
    selected.push(anchor);
  }

  while (selected.length < k) {
    const previousPlace = selected[selected.length - 1]?.place ?? null;
    const reranked = rankPlaces(places, intentText, {
      budget: options.budget,
      pace: options.pace,
      interestNames: options.interestNames,
      weather: options.weather ?? null,
      selectedPlaces: selected.map((row) => row.place),
      previousPlace,
      slotIndex: selected.length,
    });

    const candidates = reranked.filter((row) => {
      const id = stableId(row.place);
      return id && !selectedIds.has(id);
    });
    if (!candidates.length) break;

    const scored = candidates.map((row) => {
      let adjust = 0;
      if (previousPlace) {
        const km = haversineKm(previousPlace, row.place);
        if (km != null && km > 3.5) adjust -= Math.min(6, (km - 3.5) * 1.5);
      }
      return { row, score: row.breakdown.total + adjust };
    });
    scored.sort((a, b) => b.score - a.score);

    const pick = mmrSelect(scored.slice(0, 24).map((x) => x.row), {
      k: 1,
      lambda: 0.62,
      relevance: (x: RankedPlace) => x.breakdown.total,
    })[0] as RankedPlace;

    if (!pick) break;
    const id = stableId(pick.place);
    if (!id || selectedIds.has(id)) break;
    selectedIds.add(id);
    selected.push(pick);
  }

  const ordered = nearestNeighborOrder(selected);

  if (options.debug && typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('[planner] buildDayPlan selected', ordered.map((row) => ({
      id: stableId(row.place),
      name: row.place.name,
      total: Math.round(row.breakdown.total * 10) / 10,
      reasons: row.breakdown.reasons,
    })));
  }

  return { selected: ordered, ranked: baseRanked };
}
