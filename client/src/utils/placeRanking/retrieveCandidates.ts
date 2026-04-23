import { getEmbedding, cosineSimilarity } from './embeddingProvider';
import { expandQuerySemantically } from './semanticExpansion';
import { semanticMatch } from './semanticMatch';

/**
 * Retrieves candidates based on semantic similarity of the user intent
 * to the embeddingText or semanticSummary of the ai_profile.
 */
export async function retrieveCandidates(places: any[], userIntent: string, limit: number = 30): Promise<any[]> {
  if (!places || places.length === 0) return [];
  if (!userIntent) return places.slice(0, limit);

  // Fallback: Use existing text matching combined with semantic expansion
  // if actual embeddings are not pre-calculated / stored.
  const expandedTerms = expandQuerySemantically(userIntent);

  const scoredPlaces = places.map(place => {
    let score = 0;
    
    // Leverage the existing semanticMatch score if available
    const stringScore = semanticMatch(place.name + ' ' + (place.description || ''), userIntent).score;
    
    // Check AI Profile
    if (place.ai_profile) {
      const summary = (place.ai_profile.semanticSummary || '').toLowerCase();
      const tags = [...(place.ai_profile.vibeTags || []), ...(place.ai_profile.interestTags || [])];
      
      expandedTerms.forEach(term => {
        if (summary.includes(term)) score += 0.5;
        if (tags.some(t => t.toLowerCase().includes(term))) score += 0.8;
      });
      
      // Bonus if it matches exact signals from user intent
      // e.g. "culture"
      if (userIntent.includes('culture') && place.ai_profile.plannerSignals?.culturalScore > 7) {
         score += place.ai_profile.plannerSignals.culturalScore * 0.2;
      }
    } else {
      score += stringScore; // Fallback to simple matching
    }

    return { place, score };
  });

  scoredPlaces.sort((a, b) => b.score - a.score);
  return scoredPlaces.slice(0, limit).map(sp => sp.place);
}
