/**
 * Few-shot and quality rules for the AI planner (ported from VisitTripoliApp lib/data/ai_planner_training_data.dart).
 */

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
- Optionally add one short factual Tripoli tip before PLAN_JSON (heat, prayer times, Friday) when helpful — keep it brief.
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

export function buildFewShotPrompt(userMessage, maxExamples = 12) {
  const lower = userMessage.toLowerCase();
  const examples = [];

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
  return `**Trained on these message patterns:**\n${lines.join('\n')}\n**Typo corrections:**\n${typos}`;
}
