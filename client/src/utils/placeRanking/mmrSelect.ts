import type { RankedPlace } from './rankPlaces.ts';

export type MmrOptions<T> = {
  k: number;
  lambda?: number;
  relevance?: (item: T) => number;
  similarity?: (a: T, b: T) => number;
};

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

function tokensForRanked(p: RankedPlace): Set<string> {
  return new Set((Array.isArray(p.tokens) ? p.tokens : []).slice(0, 32));
}

function defaultSimilarity(a: RankedPlace, b: RankedPlace): number {
  const tokenScore = jaccard(tokensForRanked(a), tokensForRanked(b));
  const categoryScore = a.category && b.category && a.category === b.category ? 1 : 0;
  return Math.max(0, Math.min(1, 0.75 * tokenScore + 0.25 * categoryScore));
}

export function mmrSelect<T>(items: T[], options: MmrOptions<T>): T[] {
  const k = Math.max(0, Math.floor(options.k));
  if (!Array.isArray(items) || items.length === 0 || k === 0) return [];

  const lambda = Math.max(0, Math.min(1, options.lambda ?? 0.65));
  const relevance = options.relevance || ((x: any) => Number(x?.breakdown?.total) || 0);
  const similarity =
    options.similarity || ((a: any, b: any) => defaultSimilarity(a as RankedPlace, b as RankedPlace));

  const remaining = items.slice();
  const selected: T[] = [];

  remaining.sort((a, b) => relevance(b) - relevance(a));
  selected.push(remaining.shift() as T);

  while (selected.length < k && remaining.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const rel = relevance(candidate);
      let maxSimilarity = 0;
      for (const chosen of selected) {
        const sim = similarity(candidate, chosen);
        if (sim > maxSimilarity) maxSimilarity = sim;
      }
      const mmr = lambda * rel - (1 - lambda) * maxSimilarity;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIndex = i;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}
