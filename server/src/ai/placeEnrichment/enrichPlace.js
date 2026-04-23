const { buildEnrichmentPrompt } = require('./buildEnrichmentPrompt');
const { saveEnrichment, markEnrichmentFailed } = require('./saveEnrichment');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Enriches a place using the LLM and saves it to the database
 * @param {string} placeId 
 * @param {Object} rawPlaceData 
 */
async function enrichPlace(placeId, rawPlaceData) {
  try {
    const apiKey = (process.env.GROQ_API_KEY || '').trim();
    if (!apiKey) {
      console.warn(`[Enrichment] Skipped for ${placeId}: GROQ_API_KEY not set.`);
      return false;
    }

    console.log(`[Enrichment] Starting for place ${placeId}...`);
    const prompt = buildEnrichmentPrompt(rawPlaceData);

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Fast and reliable fallback or dynamic if we want
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2, // Low temp for more stable JSON
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(`Groq API error: ${res.statusText} - ${bodyText}`);
    }

    const json = JSON.parse(bodyText);
    const text = json?.choices?.[0]?.message?.content || '';
    
    // Attempt to parse out the JSON. LLMs sometimes wrap it in Markdown blocks or add prefix/suffix
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No valid JSON object found in response.');

    const aiProfile = JSON.parse(match[0]);
    aiProfile.enrichedAt = new Date().toISOString();
    aiProfile.enrichmentVersion = '1.0';

    await saveEnrichment(placeId, aiProfile);
    console.log(`[Enrichment] Successfully enriched ${placeId}`);
    return true;
  } catch (err) {
    console.error(`[Enrichment] Failed for ${placeId}:`, err.message);
    await markEnrichmentFailed(placeId, err.message);
    return false;
  }
}

/**
 * Wrap the actual call, no throwing error to avoid crashing routes
 */
function enrichPlaceBackground(placeId, rawPlaceData) {
  enrichPlace(placeId, rawPlaceData).catch(e => console.error(e));
}

module.exports = { enrichPlace, enrichPlaceBackground };
