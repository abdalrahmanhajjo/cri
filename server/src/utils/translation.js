const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Translates a set of fields for a place into the target language using Groq AI.
 * @param {Object} fields - e.g. { name: '...', description: '...' }
 * @param {string} targetLang - 'ar' or 'fr'
 * @returns {Object|null} - Translated fields or null on failure
 */
async function translatePlaceFields(fields, targetLang) {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) return null;

  const langName = targetLang === 'ar' ? 'Arabic' : targetLang === 'fr' ? 'French' : targetLang;
  
  const prompt = `
    You are a professional translator for "Tripoli Explorer", a tourism guide for Tripoli, Lebanon.
    Translate the following JSON object into ${langName}. 
    Keep the tone historical, professional, and inviting.
    Preserve all historical names and dates accurately.
    Return ONLY a valid JSON object with the same keys and translated values.
    JSON to translate: ${JSON.stringify(fields)}
  `;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(15000), // 15s timeout for direct translation
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (err) {
    console.error(`[Translation] Failed for ${targetLang}:`, err.message);
    return null;
  }
}

module.exports = { translatePlaceFields };
