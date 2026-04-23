/**
 * @param {Object} place 
 * @returns {string} The prompt for the LLM
 */
function buildEnrichmentPrompt(place) {
  return `You are an expert AI Travel Planner and local guide. Your task is to process the raw data for a place and generate an AI enriched profile for our semantic search system.
  
Raw Place Data:
Name: ${place.name || ''}
Description: ${place.description || ''}
Category: ${place.category || ''}
Location: ${place.location || ''}
Rating: ${place.rating || ''}

You must return a raw JSON object containing the exact structure below, no markdown formatting, no comments, just valid JSON.
{
  "semanticSummary": "A concise summary of why one would visit this place.",
  "vibeTags": ["tag1", "tag2"],
  "tripStyleTags": ["tag1", "tag2"],
  "interestTags": ["tag1", "tag2"],
  "idealVisitTimes": ["Morning", "Afternoon", "Evening"],
  "suitableFor": {
    "families": true|false,
    "couples": true|false,
    "solo": true|false,
    "groups": true|false
  },
  "physicalProfile": {
    "walkingEffort": "low|medium|high",
    "indoorOutdoor": "indoor|outdoor|mixed",
    "heatSuitability": 0-10,
    "rainSuitability": 0-10
  },
  "plannerSignals": {
    "culturalScore": 0-10,
    "foodScore": 0-10,
    "scenicScore": 0-10,
    "photoScore": 0-10,
    "hiddenGemScore": 0-10,
    "anchorValue": 0-10,
    "familyFriendlyScore": 0-10,
    "relaxationScore": 0-10
  },
  "visitProfile": {
    "recommendedDurationMinutes": number,
    "bestTimeOfDay": "string",
    "pairingTags": ["tag1", "tag2"]
  },
  "areaContext": {
    "neighborhoodCharacter": "string"
  },
  "explanationFragments": ["fragment1", "fragment2"],
  "embeddingText": "A rich, dense paragraph combining the semantic flavor, location vibe, and type of experience for dense embedding retrieval."
}
`;
}

module.exports = { buildEnrichmentPrompt };
