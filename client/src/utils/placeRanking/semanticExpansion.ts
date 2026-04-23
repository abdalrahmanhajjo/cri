/**
 * Performs semantic expansion of queries to help fallback traditional search.
 * Expands concepts like "romantic" to ["dim lighting", "couples", "intimate", "quiet"]
 */
export function expandQuerySemantically(query: string): string[] {
  const expanded = new Set<string>();
  const lowerQuery = query.toLowerCase();

  const mappings: Record<string, string[]> = {
    'romantic': ['couples', 'intimate', 'quiet', 'dim', 'wine', 'view'],
    'family': ['kids', 'children', 'loud', 'spacious', 'activities', 'park'],
    'history': ['ancient', 'museum', 'ruins', 'culture', 'heritage', 'old'],
    'nature': ['outdoors', 'park', 'green', 'hike', 'trees', 'scenic'],
    'foodie': ['gourmet', 'tasting', 'authentic', 'chef', 'local cuisine', 'culinary'],
    'adventure': ['active', 'hike', 'thrill', 'explore', 'intense']
  };

  for (const [key, related] of Object.entries(mappings)) {
    if (lowerQuery.includes(key)) {
      expanded.add(key);
      related.forEach(r => expanded.add(r));
    }
  }

  // If we couldn't expand, just keep the raw query terms
  if (expanded.size === 0) {
    lowerQuery.split(' ').filter(w => w.length > 3).forEach(w => expanded.add(w));
  }

  return Array.from(expanded);
}
