export async function aiRerankPlaces(candidates: any[], userIntent: string): Promise<any[]> {
  if (!candidates || candidates.length === 0) return [];

  try {
    const res = await fetch('/api/ai/rerank-places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: userIntent,
        candidates: candidates.map(c => ({ id: c.id, name: c.name }))
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      const rerankMap = new Map();
      (data.ranked || []).forEach((item: any) => {
        rerankMap.set(item.id, item);
      });
      
      const reranked = candidates.map(place => {
         const apiItem = rerankMap.get(place.id);
         return {
           ...place,
           ai_rerank_score: apiItem?.aiRelevance || 0,
           ai_reasons: apiItem?.reason ? [apiItem.reason] : []
         };
      });
      return reranked.sort((a, b) => b.ai_rerank_score - a.ai_rerank_score);
    }
  } catch (e) {
    console.error('Rerank API failed, falling back to local simulation', e);
  }
  
  // Simulated fallback
  const rerankedFallback = candidates.map(place => {
    let aiRelevance = 0;
    const reasons: string[] = [];
    
    if (place.ai_profile) {
      // Simulate intent matching
      const p = place.ai_profile;
      aiRelevance += 0.5; // base score for having enrichment
      
      const userIntentLower = userIntent.toLowerCase();

      if (userIntentLower.includes('food') && p.plannerSignals?.foodScore > 7) {
        aiRelevance += 1.0;
        reasons.push("Perfect match for your culinary interests.");
      }
      if (userIntentLower.includes('culture') && p.plannerSignals?.culturalScore > 7) {
        aiRelevance += 1.0;
        reasons.push("Highly rated cultural significance.");
      }
      if (userIntentLower.includes('nature') && p.plannerSignals?.scenicScore > 7) {
        aiRelevance += 1.0;
        reasons.push("Offers great scenic views suited for nature lovers.");
      }
      if (p.plannerSignals?.anchorValue > 8) {
        reasons.push("An unmissable anchor location for any trip.");
      }
    } else {
      reasons.push("Standard recommendation based on text similarity.");
    }

    return { 
      ...place, 
      ai_rerank_score: aiRelevance,
      ai_reasons: reasons
    };
  });

  return rerankedFallback.sort((a, b) => b.ai_rerank_score - a.ai_rerank_score);
}
