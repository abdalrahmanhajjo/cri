/**
 * Few-shot and quality rules for the AI planner (ported from VisitTripoliApp lib/data/ai_planner_training_data.dart).
 */

/** Compact facts so the model disambiguates Tripoli, Lebanon from Tripoli, Libya and orients routing. */
export const tripoliLebanonContext = `
**Tripoli, Lebanon (mandatory grounding):**
- You serve **Tripoli in North Lebanon** on the Mediterranean — **not** Tripoli, Libya. If the user says "Tripoli" without a country, assume Lebanon.
- Core areas: **Old City / Medina** (souks, khans, mosques, dense heritage) and **Al-Mina** (port, fish market, seafront). Prefer clustering visits by area to reduce walking.
- Signature themes: **Mamluk architecture**, historic **citadel**, **Great Mosque** and other mosques, **soap khan**, **gold/spice souks**, **knefe & sweets** (e.g. Hallab, Rahal), **seafood** near the port.
- Practical: hot summers — suggest mornings for heavy outdoor sites; respect **prayer times** when recommending mosques; **Friday** can affect mosque visit timing.
`;

/** Users may type in any UI-related language; replies stay in the locale set by the app. */
export const multilingualInputRules = `
**Languages (input vs output):**
- Users may write in **English, Arabic (العربية), or French** — including short mixes. Parse intent in **any** of these; do not ask them to switch language.
- Your **reply language** is fixed by the instructions above (English OR Arabic OR French per UI). Never refuse a question just because it was asked in another language than the reply language.
- Common Arabic/French tourism words map to the same Tripoli intents as English (citadel, souk, mosque, museum, food, sea, knefe, etc.) — use the "Available places" list to fulfill them.
`;

export const plannerQualityRules = `
**Accuracy & JSON (mandatory):**
- Never invent a placeId. Copy each "id" exactly from the "Available places" list — character-for-character.
- Before emitting PLAN_JSON, count slots: they must match the trip (days × places per day) when that is set.
- suggestedTime must be plausible (e.g. 9:00–18:00 for most sites). When a place lists bestTime morning|afternoon|evening, bias suggestedTime into that band unless the user overrides.
- **Routing:** Prefer clustering stops with the same "area" (old_city vs mina) within a half-day block to limit walking. Alternate intense stops (citadel, long visits) with lighter ones (cafes, short viewpoints).
- **Meals:** For full-day plans, include at least one food-appropriate stop near midday (category/tags) unless the user asked for a non-food-only theme.
- **Budget:** Match price/tags to the user's budget tier when possible; for "luxury" pick standout experiences without repeating the same category.
- Spread variety: mix heritage, food, souks, waterfront when the user did not ask for one theme — avoid three similar stops in a row unless requested.
- Multi-day: set dayIndex on every slot; balance across days; never repeat the same placeId in one trip unless the user explicitly wants a return visit.
- If the user message is vague ("ok", "yes", "do it"), infer from trip context and interests — still only use listed placeIds.
- Short user typos (knefe, souk, citdel) — map intent to Tripoli places from the list, do not refuse.
- When you output PLAN_JSON, do **not** add any prose, greeting, or summary before it — only the label line and JSON (slot **reason** fields carry narrative).
- **Known visitor:** If the system prompt includes a "Known visitor" section, use it to personalize pacing, themes, and tone. Never invent preferences not listed there; do not read private notes aloud unless it helps the plan. Prefer subtle personalization over repeating their text verbatim.
`;

export const plannerReplyStyleRules = `
**How to write (quality):**
- If you output an itinerary, write **no** conversational paragraph before PLAN_JSON — go straight to \`PLAN_JSON:\` and the JSON array. The app only shows the structured itinerary card to the user.
- For **chat-only** turns (questions, clarifications, Tripoli facts with no plan yet), reply with normal short prose and **do not** include PLAN_JSON.
- Each slot **reason** must say **why this order makes sense**: link to the **previous** stop, **time of day**, or **user theme**. Avoid generic filler ("nice place").
- If the user already chose **interests** or **trip settings** in the app, **prefer shipping a full PLAN_JSON** on the first useful turn instead of asking redundant questions — unless they are clearly only chatting or asked a factual question.
`;

const planningExamples = [
  ['5 places for 2 people', 'Parse: 5 places, 2 people. Suggest 5 places matching user interests.'],
  ['4', 'Parse as place count. If no group size, ask or assume 1-2.'],
  ['6 places', 'Suggest 6 diverse places. Use routing logic.'],
  ['I want to see museums and history', 'Match: Citadel, Great Mosque, Taynal, museums, khans. Prioritize historical sites.'],
  ['food tour', 'Match: Hallab, Rahal, souks, fish market, traditional cafes, restaurants.'],
  ['knefe and sweets', 'Match: Hallab, Rahal Sweets, sweet shops. Typos: knefe, knfe, konafa.'],
  ['souk shopping', 'Match: Khan al-Khayyatin, Khan al-Saboun, Gold Souk, Spice Market.'],
  ['mosques and religious', 'Match: Great Mosque, Taynal, Burtasiyat, Muallaq.'],
  ['citadel and views', 'Match: Citadel of Raymond de Saint-Gilles. Include sea views.'],
  ['soap and crafts', 'Match: Khan al-Saboun (soap khan).'],
  ['fish and seafood', 'Match: Al-Mina Fish Market, Port Seafood, Furn al-Samak.'],
  ['culture day', 'Match: museums, citadel, mosques, khans. Morning at citadel.'],
  ['half day trip', 'Suggest 3-4 places. Compact routing.'],
  ['full day', 'Suggest 5-6 places. Include lunch spot.'],
  ['budget friendly', 'Prioritize free/low-cost: souks, citadel views, walking.'],
  ['with kids', 'Family-friendly: citadel, souks, sweets, shorter duration.'],
  ['add more places', 'Refinement: expand itinerary. Add 1-2 more.'],
  ['swap the mosque for something else', 'Refinement: replace mosque with alternative (khan, museum, cafe).'],
  ['make it shorter', 'Refinement: reduce to 3-4 places. Keep best.'],
  ['traditional lebanese food', 'Match: Hallab, Rahal, souks, fish market, local restaurants.'],
  ['morning only', 'Suggest 2-3 places. Morning slots. Citadel best early.'],
  ['free things', 'Prioritize: citadel views, souk walking, free entry spots.'],
  ['quick visit', '2-3 places. 2-3 hours total. Compact.'],
  ['change only one stop', 'Refinement: replace exactly one slot; keep all other placeIds and times unchanged.'],
  ['beach', 'Explain: Tripoli is port city. Suggest: Al-Mina, seafood, sea views. No sandy beach.'],
];

const typoExamples = [
  ['knfe', 'knefe'],
  ['citdel', 'citadel'],
  ['suk', 'souk'],
  ['mosk', 'mosque'],
  ['halab', 'Hallab'],
];

const chatExamples = [
  ['what is tripoli known for?', 'Brief, factual. Mention: citadel, souks, sweets, Mamluk architecture, history.'],
  ['best time to visit?', 'Spring/fall. Morning for citadel. Avoid midday heat.'],
  ['hello', 'Friendly greeting. Invite to plan or chat.'],
  ['help', 'Explain: can plan trips, suggest places, chat about Tripoli.'],
  ['surprise me', 'Pick 4-5 diverse places. Mix food, history, souks.'],
];

/** Arabic phrases → planning intent (user may use any script; match substrings). */
const arabicIntentHints = [
  ['قلعة', 'Citadel / fortress — match citadel and nearby heritage.'],
  ['القلعة', 'Citadel — morning visit; pair with Old City.'],
  ['سوق', 'Souks — khans, gold, spices, crafts.'],
  ['خان', 'Historic khans (soap, tailors, etc.).'],
  ['مسجد', 'Mosques — Great Mosque, Taynal, respect prayer times.'],
  ['متحف', 'Museums and culture — pair with Old City routes.'],
  ['كنافة', 'Sweets / knefe — Hallab, Rahal, dessert stops.'],
  ['حلويات', 'Sweets shops and traditional dessert.'],
  ['مأكولات', 'Food tour — restaurants, souks, fish.'],
  ['سمك', 'Seafood — Al-Mina, port, fish market.'],
  ['بحر', 'Seafront / port — Mina, views, seafood.'],
  ['ميناء', 'Port area — Al-Mina cluster.'],
  ['طرابلس', 'Tripoli Lebanon — confirm not Libya if confused; use directory places.'],
  ['يوم', 'Day plan — respect placesPerDay and duration.'],
  ['رحلة', 'Trip / itinerary — build PLAN_JSON from list.'],
  ['أماكن', 'Places to visit — suggest from directory by interests.'],
  ['زيارة', 'Visit planning — same as itinerary.'],
  ['صباح', 'Morning bias — citadel and outdoor first.'],
  ['ميزانية', 'Budget — honor low/moderate/luxury tier.'],
  ['عائلة', 'Family-friendly — shorter walks, sweets, scenic stops.'],
];

/** French phrases → planning intent. */
const frenchIntentHints = [
  ['citadelle', 'Citadel — Raymond de Saint-Gilles; morning visit.'],
  ['souk', 'Souks and khans — shopping and heritage walk.'],
  ['mosquée', 'Mosques — prayer-aware timing.'],
  ['musée', 'Museums — culture day mix.'],
  ['knefe', 'Sweets — knefe / patisseries from directory.'],
  ['poisson', 'Seafood — port / Mina.'],
  ['mer', 'Seafront — Mina, views.'],
  ['port', 'Port area — fish market cluster.'],
  ['visite', 'Sightseeing — build from places list.'],
  ['itinéraire', 'Itinerary — PLAN_JSON when enough context.'],
  ['jours', 'Multi-day — set dayIndex on every slot.'],
  ['famille', 'Family — softer pacing, kid-friendly stops.'],
  ['bonjour', 'Greet and offer planning help.'],
  ['aide', 'Explain planner capabilities in reply language.'],
  ['liban', 'Lebanon Tripoli — not Libya.'],
];

function containsArabicScript(text) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(String(text || ''));
}

function looksLikeFrench(text) {
  const s = String(text || '');
  if (/[àâäéèêëïîôùûçœæ]/i.test(s)) return true;
  const w = s.toLowerCase();
  return /\b(bonjour|merci|où|visite|jour|jours|itinéraire|mosquée|souk|citadelle|liban|aide)\b/i.test(w);
}

function matches(lower, pattern) {
  const p = pattern.toLowerCase().replace(/\?/g, '').replace(/\./g, '');
  const c = lower.replace(/\?/g, '').replace(/\./g, '');
  return c.includes(p) || p.includes(c);
}

function hasPossibleTypo(lower) {
  if (lower.length > 20) return false;
  const known = ['knfe', 'citdel', 'suk', 'mosk', 'halab'];
  return known.some((t) => lower.includes(t));
}

function pushMultilingualHints(rawText, examples, maxExamples) {
  const text = String(rawText || '');
  if (containsArabicScript(text)) {
    for (const [phrase, behavior] of arabicIntentHints) {
      if (examples.length >= maxExamples) break;
      if (text.includes(phrase)) {
        examples.push(`User (Arabic) contains "${phrase}" → ${behavior}`);
      }
    }
  }
  if (looksLikeFrench(text)) {
    const lower = text.toLowerCase();
    for (const [phrase, behavior] of frenchIntentHints) {
      if (examples.length >= maxExamples) break;
      if (lower.includes(phrase.toLowerCase())) {
        examples.push(`User (French) contains "${phrase}" → ${behavior}`);
      }
    }
  }
}

/**
 * @param {string} userMessage
 * @param {number} [maxExamples]
 * @param {{ recentUserText?: string }} [options] — optional combined recent user turns for multilingual matching
 */
export function buildFewShotPrompt(userMessage, maxExamples = 12, options = {}) {
  const combined = [options.recentUserText, userMessage].filter(Boolean).join('\n');
  const lower = userMessage.toLowerCase();
  const examples = [];

  pushMultilingualHints(combined, examples, maxExamples);

  for (const [user, behavior] of planningExamples) {
    if (examples.length >= maxExamples) break;
    if (matches(lower, user) || matches(lower, behavior)) {
      examples.push(`User: "${user}" → ${behavior}`);
    }
  }

  if (lower.length < 15 || hasPossibleTypo(lower)) {
    for (const [typo, correct] of typoExamples) {
      if (examples.length >= maxExamples) break;
      examples.push(`Typo: "${typo}" means "${correct}"`);
    }
  }

  for (const [user, style] of chatExamples) {
    if (examples.length >= maxExamples) break;
    if (matches(lower, user) || examples.length < 4) {
      examples.push(`User: "${user}" → ${style}`);
    }
  }

  for (const [user, behavior] of planningExamples.slice(-3)) {
    if (examples.length >= maxExamples) break;
    if (matches(lower, user)) {
      examples.push(`User: "${user}" → ${behavior}`);
    }
  }

  if (examples.length < 6) {
    for (let i = 0; i < planningExamples.length && examples.length < maxExamples; i += 1) {
      const [u, b] = planningExamples[i];
      if (!examples.some((x) => x.includes(u))) examples.push(`User: "${u}" → ${b}`);
    }
  }

  return examples.slice(0, maxExamples).join('\n');
}

export function getPlanningTrainingContext() {
  const lines = planningExamples.slice(0, 20).map(([u, b]) => `- "${u}" → ${b}`);
  const typos = typoExamples.map(([a, b]) => `- "${a}" → ${b}`).join('\n');
  const arSample = arabicIntentHints
    .slice(0, 8)
    .map(([p, b]) => `- AR "${p}" → ${b}`)
    .join('\n');
  const frSample = frenchIntentHints
    .slice(0, 8)
    .map(([p, b]) => `- FR "${p}" → ${b}`)
    .join('\n');
  return `**Trained on these message patterns:**\n${lines.join('\n')}\n**Typo corrections:**\n${typos}\n**Arabic intent hints (sample):**\n${arSample}\n**French intent hints (sample):**\n${frSample}`;
}
