/**
 * AI planner client — calls POST /api/ai/complete with the same prompts as VisitTripoliApp
 * (lib/services/ai_planner_service.dart chatForTripPlan).
 */
import {
  buildFewShotPrompt,
  plannerQualityRules,
  plannerReplyStyleRules,
  getPlanningTrainingContext,
  tripoliLebanonContext,
  multilingualInputRules,
} from '../data/aiPlannerTrainingData';
import { formatYMD } from '../utils/tripPlannerHelpers';
import { loadSmartScheduleContext, sortAndAssignSmartSlotTimes } from '../utils/smartVisitTiming';
import {
  rankPlacesForPlanner,
  compactPlaceRowForModel,
} from '../utils/aiPlannerPlaceRanker';

function apiBase() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === '' || raw == null) {
    if (typeof window !== 'undefined') return '';
    return 'http://localhost:3095';
  }
  return String(raw).replace(/\/$/, '');
}

export function normalizeSuggestedTime(raw) {
  const s = String(raw || '').trim();
  const m = /^(\d{1,2})\s*:\s*(\d{1,2})$/.exec(s);
  if (m) {
    const h = Math.min(23, Math.max(0, parseInt(m[1], 10) || 9));
    const min = Math.min(59, Math.max(0, parseInt(m[2], 10) || 0));
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  return s || '09:00';
}

/** Minimum minutes between start times on the same day (UI + save validation). */
export const MIN_SLOT_GAP_MINUTES = 45;

export function suggestedTimeToMinutes(hm) {
  const norm = normalizeSuggestedTime(hm);
  const [hs, ms] = norm.split(':');
  const h = Math.min(23, Math.max(0, parseInt(hs, 10) || 0));
  const min = Math.min(59, Math.max(0, parseInt(ms, 10) || 0));
  return h * 60 + min;
}

/**
 * Indices that are too close in time to another stop on the same day (within gapMin minutes).
 * @returns {Set<number>}
 */
export function getSlotConflictIndices(slots, gapMin = MIN_SLOT_GAP_MINUTES) {
  const byDay = new Map();
  const n = slots.length;
  for (let i = 0; i < n; i += 1) {
    const s = slots[i];
    const d = s.dayIndex != null && Number.isFinite(s.dayIndex) ? s.dayIndex : 0;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push({ i, t: suggestedTimeToMinutes(s.suggestedTime) });
  }
  const bad = new Set();
  for (const [, arr] of byDay) {
    const sorted = [...arr].sort((a, b) => a.t - b.t);
    for (let k = 1; k < sorted.length; k += 1) {
      if (sorted[k].t - sorted[k - 1].t < gapMin) {
        bad.add(sorted[k].i);
        bad.add(sorted[k - 1].i);
      }
    }
  }
  return bad;
}

export class AIPlannerApiError extends Error {
  constructor(message, { status, detail } = {}) {
    super(message);
    this.name = 'AIPlannerApiError';
    this.status = status;
    this.detail = detail;
  }
}

const AI_FETCH_TIMEOUT_MS = 120000;

/**
 * @param {{ prompt?: string, system?: string, user?: string, temperature?: number, maxTokens?: number }} body
 * @param {{ timeoutMs?: number }} [options]
 */
export async function callAIComplete(body, options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : AI_FETCH_TIMEOUT_MS;
  const base = apiBase();
  const url = `${base}/api/ai/complete`;
  let res;
  try {
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(timeoutMs)
        : undefined;
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
  } catch (e) {
    const name = e && e.name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new AIPlannerApiError('The AI request took too long. Please try again.', { status: 0 });
    }
    throw new AIPlannerApiError(
      'Connection failed. Check your network and try again.',
      { status: 0 }
    );
  }

  const bodyText = await res.text();
  let json = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    json = null;
  }

  if (res.status === 503) {
    const msg = json?.error || 'AI not configured';
    throw new AIPlannerApiError(`AI is not available. ${msg}`, { status: 503, detail: json?.detail });
  }
  if (res.status === 400) {
    throw new AIPlannerApiError(json?.error || 'Invalid request', { status: 400, detail: json?.detail });
  }
  if (res.status === 429) {
    throw new AIPlannerApiError(json?.detail || json?.error || 'AI quota exceeded', {
      status: 429,
      detail: json?.detail,
    });
  }
  if (res.status >= 500) {
    throw new AIPlannerApiError(json?.error || 'AI service error. Please try again later.', {
      status: res.status,
      detail: json?.detail,
    });
  }
  if (!res.ok) {
    throw new AIPlannerApiError(
      json?.error || json?.detail || `Unexpected response (${res.status})`,
      { status: res.status, detail: json?.detail }
    );
  }

  const text = json?.text != null ? String(json.text).trim() : '';
  const errorDetail = json?.errorDetail;
  return { text: text || null, errorDetail };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Retries transient failures (network, 502/503/504) so mobile flaky links still get a response.
 */
export async function callAICompleteReliable(body) {
  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await callAIComplete(body);
    } catch (e) {
      lastErr = e;
      if (!(e instanceof AIPlannerApiError)) throw e;
      const retryable =
        e.status === 0 ||
        e.status === 502 ||
        e.status === 503 ||
        e.status === 504;
      if (!retryable || attempt === maxAttempts - 1) throw e;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

function parsePlanJson(rawText, placeIdSet) {
  const planLabel = /PLAN_JSON\s*:/i;
  const planIdx = rawText.search(planLabel);
  if (planIdx < 0) return { text: rawText.trim(), slots: null };

  const beforePlan = rawText.slice(0, planIdx).trim();
  const afterLabel = rawText.slice(planIdx).replace(/^\s*PLAN_JSON\s*:/i, '').trim();
  const arrStart = afterLabel.indexOf('[');
  if (arrStart < 0) return { text: beforePlan || rawText.trim(), slots: null };

  let depth = 0;
  let end = -1;
  for (let i = arrStart; i < afterLabel.length; i += 1) {
    const c = afterLabel[i];
    if (c === '[') depth += 1;
    else if (c === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return { text: beforePlan || rawText.trim(), slots: null };

  let slots = null;
  try {
    const list = JSON.parse(afterLabel.slice(arrStart, end + 1));
    if (!Array.isArray(list)) return { text: beforePlan, slots: null };
    slots = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const placeIdRaw = item.placeId ?? item.place_id;
      const placeId = placeIdRaw != null ? String(placeIdRaw) : null;
      if (!placeId || !placeIdSet.has(placeId)) continue;
      const dayRaw = item.dayIndex ?? item.day_index;
      const dayIndex =
        typeof dayRaw === 'number'
          ? dayRaw
          : typeof dayRaw === 'string' && dayRaw !== ''
            ? parseInt(dayRaw, 10)
            : null;
      const timeStr = item.suggestedTime ?? item.suggested_time;
      slots.push({
        placeId,
        suggestedTime: normalizeSuggestedTime(
          timeStr != null && String(timeStr) !== '' ? String(timeStr) : '9:00'
        ),
        reason: item.reason != null ? String(item.reason) : null,
        dayIndex: Number.isFinite(dayIndex) ? dayIndex : null,
      });
    }
    if (slots.length === 0) slots = null;
  } catch {
    slots = null;
  }

  return { text: beforePlan || 'Here’s a plan for you!', slots };
}

/** Optional block from the model: TRIP_SETTINGS_JSON: {"startDate":"YYYY-MM-DD",...} */
function normalizeTripSettingsPayload(raw) {
  if (raw == null || typeof raw !== 'object') return null;
  const out = {};
  if (raw.startDate != null) {
    const s = String(raw.startDate).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) out.startDate = s;
  }
  if (raw.durationDays != null) {
    const n = Number(raw.durationDays);
    if (Number.isFinite(n)) out.durationDays = Math.min(7, Math.max(1, Math.round(n)));
  }
  if (raw.placesPerDay != null) {
    const n = Number(raw.placesPerDay);
    if (Number.isFinite(n)) out.placesPerDay = Math.min(8, Math.max(2, Math.round(n)));
  }
  if (raw.budget != null) {
    const b = String(raw.budget).toLowerCase().trim();
    if (b === 'low' || b === 'moderate' || b === 'luxury') out.budget = b;
  }
  const interestSrc = Array.isArray(raw.interests)
    ? raw.interests
    : Array.isArray(raw.interestNames)
      ? raw.interestNames
      : null;
  if (interestSrc?.length) {
    out.interestNames = interestSrc.map((x) => String(x).trim()).filter(Boolean);
  }
  return Object.keys(out).length ? out : null;
}

function extractTripSettingsAndStrip(rawText) {
  if (rawText == null || typeof rawText !== 'string') return { cleaned: rawText, tripSettings: null };
  const label = /TRIP_SETTINGS_JSON\s*:/i;
  const m = label.exec(rawText);
  if (!m) return { cleaned: rawText, tripSettings: null };
  const idx = m.index;
  const before = rawText.slice(0, idx);
  const afterLabel = rawText.slice(idx + m[0].length).trimStart();
  const objStart = afterLabel.indexOf('{');
  if (objStart < 0) return { cleaned: rawText, tripSettings: null };
  let depth = 0;
  let end = -1;
  for (let i = objStart; i < afterLabel.length; i += 1) {
    const c = afterLabel[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return { cleaned: rawText, tripSettings: null };
  let tripSettings = null;
  try {
    tripSettings = normalizeTripSettingsPayload(JSON.parse(afterLabel.slice(objStart, end + 1)));
  } catch {
    tripSettings = null;
  }
  const rest = (afterLabel.slice(end + 1) || '').trim();
  const cleaned = `${before.trimEnd()}${rest ? `\n${rest}` : ''}`.trim();
  return { cleaned, tripSettings };
}

/** Parse PLAN_JSON array without validating placeIds (for single-slot merge). */
function extractPlanJsonArray(rawText) {
  const planLabel = /PLAN_JSON\s*:/i;
  const planIdx = rawText.search(planLabel);
  if (planIdx < 0) return null;
  const afterLabel = rawText.slice(planIdx).replace(/^\s*PLAN_JSON\s*:/i, '').trim();
  const arrStart = afterLabel.indexOf('[');
  if (arrStart < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = arrStart; i < afterLabel.length; i += 1) {
    const c = afterLabel[i];
    if (c === '[') depth += 1;
    else if (c === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  try {
    const list = JSON.parse(afterLabel.slice(arrStart, end + 1));
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

function freezeSlotFromPrevious(s) {
  return {
    placeId: String(s.placeId),
    suggestedTime: normalizeSuggestedTime(s.suggestedTime),
    dayIndex: s.dayIndex ?? 0,
    reason: s.reason != null ? String(s.reason) : null,
  };
}

function plannerDateYmdForDayIndex(selectedDate, dayIndex) {
  const start = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  d.setDate(d.getDate() + (Number(dayIndex) || 0));
  return formatYMD(d);
}

/**
 * Reorder each day's stops and assign start/end times using Tripoli weather + prayer windows
 * (same logic as Plan "Smart schedule"). Falls back to original slots on error.
 */
export async function applySmartScheduleToAiSlots(slots, durationDays, selectedDate, places) {
  try {
    if (!Array.isArray(slots) || slots.length === 0) return slots;
    const startCheck = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    if (Number.isNaN(startCheck.getTime())) return slots;
    const placeMap = Object.fromEntries((places || []).map((p) => [String(p.id), p]));
    const maxD =
      Number.isFinite(Number(durationDays)) && Number(durationDays) >= 1
        ? Number(durationDays) - 1
        : 0;
    const byDay = new Map();
    for (const s of slots) {
      const d = Math.min(maxD, Math.max(0, s.dayIndex ?? 0));
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(s);
    }
    const dayIndices = [...byDay.keys()].sort((a, b) => a - b);
    const contexts = await Promise.all(
      dayIndices.map((d) => loadSmartScheduleContext(plannerDateYmdForDayIndex(selectedDate, d)))
    );
    const out = [];
    dayIndices.forEach((d, idx) => {
      const ctx = contexts[idx];
      const daySlots = byDay.get(d);
      const apiShape = daySlots.map((s) => ({
        placeId: String(s.placeId),
        startTime: null,
        endTime: null,
        notes: s.reason != null ? String(s.reason) : null,
      }));
      const timed = sortAndAssignSmartSlotTimes(apiShape, placeMap, ctx);
      timed.forEach((row) => {
        const hm = row.startTime ? String(row.startTime).slice(0, 5) : '09:00';
        out.push({
          placeId: row.placeId,
          suggestedTime: normalizeSuggestedTime(hm),
          dayIndex: d,
          reason: row.notes != null ? String(row.notes) : null,
        });
      });
    });
    return normalizeSlotsForDuration(out, durationDays);
  } catch {
    return slots;
  }
}

/** Same place only once per trip (keeps first occurrence in list order). */
export function dedupeSlotsByPlacePreserveOrder(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return slots;
  const seen = new Set();
  const out = [];
  for (const s of slots) {
    const id = String(s.placeId);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(s);
  }
  return out;
}

/** Clamp each slot's dayIndex to 0..durationDays-1 (required for multi-day trips and saving). */
export function normalizeSlotsForDuration(slots, durationDays) {
  if (!Array.isArray(slots) || slots.length === 0) return slots;
  const d = Number(durationDays);
  const max = Number.isFinite(d) && d >= 1 ? d - 1 : 0;
  return slots.map((s) => ({
    ...s,
    placeId: String(s.placeId),
    suggestedTime: normalizeSuggestedTime(s.suggestedTime),
    dayIndex: Math.min(max, Math.max(0, s.dayIndex ?? 0)),
    reason: s.reason != null ? String(s.reason) : null,
  }));
}

/**
 * At most `placesPerDay` stops per calendar day. Redistributes in global time order:
 * earliest times fill day 0 up to the cap, then day 1, etc. Drops overflow beyond trip capacity.
 */
export function enforcePlacesPerDay(slots, durationDays, placesPerDay) {
  const ppd = Number(placesPerDay);
  const dd = Number(durationDays);
  if (!Array.isArray(slots) || slots.length === 0 || !Number.isFinite(ppd) || ppd < 1 || !Number.isFinite(dd) || dd < 1) {
    return slots;
  }

  const normalized = normalizeSlotsForDuration(
    slots.map((s) => ({ ...s })),
    dd
  );
  normalized.sort((a, b) => {
    const ta = suggestedTimeToMinutes(a.suggestedTime);
    const tb = suggestedTimeToMinutes(b.suggestedTime);
    if (ta !== tb) return ta - tb;
    return String(a.placeId).localeCompare(String(b.placeId));
  });

  const buckets = Array.from({ length: dd }, () => []);
  for (const s of normalized) {
    let placed = false;
    for (let d = 0; d < dd; d += 1) {
      if (buckets[d].length < ppd) {
        buckets[d].push({
          ...s,
          dayIndex: d,
        });
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }

  return buckets.flat();
}

/**
 * After AI single-slot replace: keep all rows from previousSlots except replaceIndex
 * (placeId + reason taken from model output when valid).
 */
export function mergeSingleReplaceFromRawPlan(rawText, previousSlots, replaceIndex, placeIdSet) {
  if (
    !Array.isArray(previousSlots) ||
    previousSlots.length === 0 ||
    replaceIndex < 0 ||
    replaceIndex >= previousSlots.length
  ) {
    return { ok: false, slots: previousSlots };
  }
  const rawList = extractPlanJsonArray(rawText);
  if (!rawList || rawList.length !== previousSlots.length) {
    return { ok: false, slots: previousSlots.map(freezeSlotFromPrevious) };
  }
  const item = rawList[replaceIndex];
  const placeIdRaw = item?.placeId ?? item?.place_id;
  const newPid = placeIdRaw != null ? String(placeIdRaw) : '';
  if (!placeIdSet.has(newPid)) {
    return { ok: false, slots: previousSlots.map(freezeSlotFromPrevious) };
  }
  const slots = previousSlots.map((s, i) => {
    if (i !== replaceIndex) return freezeSlotFromPrevious(s);
    return {
      placeId: newPid,
      suggestedTime: normalizeSuggestedTime(previousSlots[replaceIndex].suggestedTime),
      dayIndex: previousSlots[replaceIndex].dayIndex ?? 0,
      reason: item?.reason != null ? String(item.reason) : previousSlots[replaceIndex].reason,
    };
  });
  return { ok: true, slots };
}

/**
 * @param {object} params
 * @returns {Promise<{ text: string, slots: object[]|null }>}
 */
/**
 * Build ordered place list + JSON rows for the model. Refinements use the full catalog for IDs
 * but still surface ranked, enriched rows first (plus any places already on the draft).
 */
function buildPlacesPromptPayload(places, ctx) {
  const {
    userMessage,
    userInterests,
    budget,
    previousSlots,
    singleReplaceSlotIndex,
    learnedCategoryHints,
  } = ctx;
  const placeById = Object.fromEntries((places || []).map((p) => [String(p.id), p]));
  const fullIdSet = new Set((places || []).map((p) => String(p.id)));
  const rankOpts = {
    userMessage,
    interestNames: userInterests,
    budget,
    maxForPrompt: 56,
    learnedCategoryHints: Array.isArray(learnedCategoryHints) ? learnedCategoryHints : [],
  };

  const isRefinement =
    (Array.isArray(previousSlots) && previousSlots.length > 0) ||
    singleReplaceSlotIndex != null;

  const pinnedIds = new Set();
  if (Array.isArray(previousSlots)) {
    for (const s of previousSlots) {
      if (s?.placeId != null) pinnedIds.add(String(s.placeId));
    }
  }

  const { ordered: ranked, hintLines } = rankPlacesForPlanner(places || [], rankOpts);

  if (!isRefinement) {
    const placeIdSet = new Set(ranked.map((p) => String(p.id)));
    return {
      placeIdSet,
      placesContext: ranked.map(compactPlaceRowForModel),
      rankingHints: hintLines,
      fallbackPlaceIds: ranked.map((p) => String(p.id)),
    };
  }

  const merged = [];
  const seen = new Set();
  const push = (p) => {
    if (!p?.id) return;
    const id = String(p.id);
    if (seen.has(id)) return;
    seen.add(id);
    merged.push(p);
  };
  for (const id of pinnedIds) {
    const p = placeById[id];
    if (p) push(p);
  }
  for (const p of ranked) push(p);
  for (const p of places || []) push(p);
  const ordered = merged.slice(0, 64);
  return {
    placeIdSet: fullIdSet,
    placesContext: ordered.map(compactPlaceRowForModel),
    rankingHints: hintLines,
    fallbackPlaceIds: ordered.map((p) => String(p.id)),
  };
}

export async function chatForTripPlan(params) {
  const {
    conversationHistory = [],
    userMessage,
    places = [],
    durationDays = 1,
    placesPerDay,
    budget = 'moderate',
    selectedDate,
    userInterests = [],
    activityContext = '',
    responseLanguage = 'en',
    previousSlots = null,
    singleReplaceSlotIndex = null,
    userFamiliarityBlock = '',
    learnedCategoryHints = [],
  } = params;

  const { placeIdSet, placesContext, rankingHints, fallbackPlaceIds } = buildPlacesPromptPayload(places, {
    userMessage,
    userInterests,
    budget,
    previousSlots,
    singleReplaceSlotIndex,
    learnedCategoryHints,
  });

  const lang = ['en', 'ar', 'fr'].includes(responseLanguage) ? responseLanguage : 'en';
  const languageInstruction =
    lang === 'ar'
      ? 'You must reply ONLY in Arabic (العربية). Write all your messages in Arabic.'
      : lang === 'fr'
        ? 'You must reply ONLY in French (Français). Write all your messages in French.'
        : 'You must reply ONLY in English. Write all your messages in English.';

  const dbLocaleNote =
    lang === 'ar'
      ? "The place names and categories in the list below come from the app database in Arabic—use those exact names in your explanations and in each slot's \"reason\" field."
      : lang === 'fr'
        ? 'Les noms des lieux et les catégories viennent de la base en français : utilisez exactement ces libellés dans le texte et dans chaque "reason".'
        : 'Place names and categories in the list are in English from the database—use those exact names in your text and in each slot\'s "reason" field.';

  const recentUserText = conversationHistory
    .filter((e) => e && e.role === 'user' && e.content)
    .slice(-4)
    .map((e) => String(e.content))
    .join('\n');

  const fewShot = buildFewShotPrompt(userMessage, 12, { recentUserText });
  const trainingBlock = getPlanningTrainingContext();

  const historyStr =
    conversationHistory.length === 0
      ? ''
      : conversationHistory
          .slice(-30)
          .map((e) => `${e.role === 'user' ? 'User' : 'Assistant'}: ${e.content ?? ''}`)
          .join('\n');

  const exactCountNote =
    placesPerDay != null && placesPerDay > 0 && durationDays >= 1
      ? `
CRITICAL — STOPS PER DAY IS FIXED: The user chose ${placesPerDay} stop(s) per day for ${durationDays} day(s). That means EXACTLY ${placesPerDay} JSON object(s) with each dayIndex value — never 4 on dayIndex 0 when ${placesPerDay} is 2.
- Total slots in PLAN_JSON: exactly ${durationDays * placesPerDay}.
${Array.from({ length: durationDays }, (_, d) => `- Exactly ${placesPerDay} objects must have "dayIndex": ${d} (calendar day ${d + 1})`).join('\n')}
- ${
        durationDays > 1
          ? `Spread across days 0..${durationDays - 1}: never put more than ${placesPerDay} stops on a single dayIndex.`
          : `Single day only: every object uses "dayIndex":0 and you output exactly ${placesPerDay} objects.`
      }
- Count objects per dayIndex before sending; if any day has more than ${placesPerDay}, fix it before outputting.`
      : '';

  const planInstruction = `
When you have enough information (e.g. days, interests, or the user asks for a plan), you MAY propose an itinerary. To do that, end your reply with a single newline then exactly: PLAN_JSON:
Then a JSON array of objects with placeId, suggestedTime, reason; add dayIndex (0,1,...) if multiple days. Use ONLY placeIds from the "Available places" list (copy ids exactly). Example: [{"placeId":"id1","suggestedTime":"9:00","reason":"...","dayIndex":0}]
Each "reason" should be one short sentence: why this stop fits the day, how it connects to the previous stop or user request, or a timing note (use the place's bestTime when relevant).
Within each dayIndex, use suggestedTime values in **chronological order** from first stop to last (earlier starts first); the app requires spacing between starts on the same day.
If the user wants 2 or more days, you MUST set dayIndex on every slot: 0 = first day, 1 = second day, etc. Spread places evenly across days.${exactCountNote}
If you are just chatting or asking for more details, do NOT include PLAN_JSON.

When the user asks to change trip settings (start date, trip length / number of days, stops per day, budget, or themes/interests), you MUST reflect that in the UI by adding at the very END of your reply (after PLAN_JSON if any):
TRIP_SETTINGS_JSON:
{"startDate":"YYYY-MM-DD","durationDays":3,"placesPerDay":4,"budget":"moderate","interests":["Culture","Food"]}
Include ONLY fields that actually change. budget must be one of: low, moderate, luxury. interests is optional — short labels in the user's language that match themes they asked for. If they only change one field, output a one-key JSON object.`;

  const daySchedulingNote =
    durationDays <= 1
      ? '\n\nIMPORTANT — CALENDAR DAYS: This trip is ONE day. Every slot in PLAN_JSON MUST use "dayIndex": 0.'
      : `\n\nIMPORTANT — CALENDAR DAYS: This trip spans ${durationDays} days. EVERY slot MUST set "dayIndex" to an integer from 0 through ${durationDays - 1} only (0 = first day, ${durationDays - 1} = last day). Spread stops across those days — do not put every stop on day 0 unless the user asked for that. Never omit dayIndex.`;

  const tripoliOnly = `
You ONLY help with Tripoli, Lebanon. Answer only about Tripoli—trip planning, its places, food, culture, history, and visiting Tripoli. If the user asks about anything unrelated to Tripoli (other cities, general knowledge, etc.), politely say you can only help with Tripoli and ask how you can help with their Tripoli visit. Never discuss other destinations.`;

  const familiarity =
    typeof userFamiliarityBlock === 'string' && userFamiliarityBlock.trim().length > 0
      ? `

**Known visitor (this browser + optional account hints — treat as private, personalize subtly):**
${userFamiliarityBlock.trim()}
`
      : '';

  let currentPlanBlock = '';
  if (previousSlots?.length) {
    const idToName = Object.fromEntries(
      places.map((p) => [String(p.id), p.name != null ? String(p.name) : String(p.id)])
    );
    const normalizedPrev = normalizeSlotsForDuration(previousSlots, durationDays);
    const lines = [];
    for (let i = 0; i < normalizedPrev.length; i += 1) {
      const s = normalizedPrev[i];
      const d = s.dayIndex ?? 0;
      const name = idToName[s.placeId] ?? s.placeId;
      const dayPart =
        durationDays >= 2 ? `dayIndex=${d} (calendar day ${d + 1})` : 'dayIndex=0';
      lines.push(`slot ${i}: ${dayPart} ${normalizeSuggestedTime(s.suggestedTime)} ${name}`);
    }
    let replaceOneStopNote = `
When the user asks to add a place, remove one, reorder, or "do the plan again", output an updated PLAN_JSON that applies their requested change and adjusts times/order as needed. Keep as much of the current plan as they did not ask to change.
If the user asks to change or replace ONLY ONE stop, output a full PLAN_JSON array where every slot is identical to the current plan except that single slot: only that slot's placeId (and reason) may change. Keep the same suggestedTime and dayIndex for all slots unless they explicitly asked to change a time.`;

    if (
      singleReplaceSlotIndex != null &&
      singleReplaceSlotIndex >= 0 &&
      singleReplaceSlotIndex < previousSlots.length
    ) {
      replaceOneStopNote = `

MANDATORY — SINGLE SLOT REPLACE (app-enforced):
- The user is replacing ONLY the stop at slot index ${singleReplaceSlotIndex} (0-based). Slot order is the order of objects in your PLAN_JSON (index 0 = first object, etc.).
- Your PLAN_JSON MUST be a JSON array with EXACTLY ${previousSlots.length} objects — same length as the current plan. Each object is one slot in order.
- For every index i where i ≠ ${singleReplaceSlotIndex}: use the EXACT same placeId, suggestedTime, dayIndex, and reason as in the current plan (you may copy those fields verbatim).
- Only index ${singleReplaceSlotIndex} may use a different placeId from the available list and an updated reason. Keep suggestedTime and dayIndex for that slot the same as now unless the user explicitly asked to change the time.
- Do not reorder, add, or remove slots.${
        durationDays >= 2
          ? `
- This trip has ${durationDays} days: keep the SAME dayIndex on every slot as in the list above (only placeId/reason may change at index ${singleReplaceSlotIndex}).`
          : ''
      }`;
    }

    currentPlanBlock = `

CURRENT PLAN (user may have edited it; they want you to update it):
${lines.join('\n')}${replaceOneStopNote}`;
  }

  const systemPrompt = `You are an expert Tripoli, Lebanon trip planner—accurate, helpful, and concise.

${languageInstruction}
${dbLocaleNote}
${multilingualInputRules}
${tripoliLebanonContext}
${tripoliOnly}
${familiarity}

${plannerQualityRules}

${plannerReplyStyleRules}

**Intent examples (match user wording loosely):**
${fewShot}

**Reference patterns:**
${trainingBlock}

You MUST never say the user "didn't ask a question" or "haven't shared any information"—treat "hello", "plan trip", "start", "plan", "i want a plan" as valid. The user has already set their number of days and places per day (see Trip context below). Reply by asking about interests (food, culture, history, shopping) or suggest a plan using the places list.

Chat naturally. When you have enough to suggest a plan (or the user asks for one), propose it and output it using PLAN_JSON as instructed below.

${planInstruction}

Available places (each object: id, name, category, area hint, optional location, bestTime, duration, price, tags — use this to cluster routing and pick times):
${JSON.stringify(placesContext)}

Trip context: ${durationDays} day(s)${
    placesPerDay != null && placesPerDay > 0
      ? `, HARD LIMIT ${placesPerDay} stop(s) per calendar day (${durationDays * placesPerDay} stops total)`
      : ''
  }, budget ${budget}${
    selectedDate
      ? `, trip start date (ISO) ${formatYMD(selectedDate instanceof Date ? selectedDate : new Date(selectedDate))}`
      : ''
  }${
    userInterests.length
      ? `, interests: ${userInterests.map((x) => String(x)).join(', ')}`
      : ''
  }
${activityContext ? `\n${activityContext}\n` : ''}${
    rankingHints?.length
      ? `\n**Planning hints (follow when consistent with the user):**\n${rankingHints.map((h) => `- ${h}`).join('\n')}\n`
      : ''
  }${daySchedulingNote}${currentPlanBlock}`;

  const userPrompt =
    historyStr === ''
      ? `User: ${userMessage}\n\nAssistant:`
      : `${historyStr}\n\nUser: ${userMessage}\n\nAssistant:`;

  const plannerTemperature =
    singleReplaceSlotIndex != null
      ? 0.28
      : previousSlots?.length
        ? 0.35
        : placesPerDay != null && placesPerDay > 0
          ? 0.3
          : 0.48;

  try {
    const result = await callAICompleteReliable({
      system: systemPrompt,
      user: userPrompt,
      temperature: plannerTemperature,
      maxTokens: 2688,
    });
    const raw = result.text;
    if (raw == null || raw === '') {
      const hint = result.errorDetail ? ` ${result.errorDetail}` : '';
      return { text: `Sorry, I couldn't reply.${hint}`, slots: null, tripSettings: null };
    }

    const { cleaned: rawForPlan, tripSettings } = extractTripSettingsAndStrip(raw);

    let effDays = durationDays;
    let effPlacesPerDay = placesPerDay;
    let effSelectedDate = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    if (tripSettings?.durationDays != null) effDays = tripSettings.durationDays;
    if (tripSettings?.placesPerDay != null) effPlacesPerDay = tripSettings.placesPerDay;
    if (tripSettings?.startDate) {
      effSelectedDate = new Date(`${tripSettings.startDate}T12:00:00`);
    }

    let { text, slots } = parsePlanJson(rawForPlan, placeIdSet);
    const outText = text || 'Here’s a plan for you!';

    const pickFillTimes = (n) => {
      const base = ['09:30', '11:00', '13:30', '15:00', '16:30', '18:00', '19:30', '21:00'];
      const out = [];
      for (let i = 0; i < n; i += 1) out.push(base[i % base.length]);
      return out;
    };

    const ensureExactSlotCount = (rawSlots) => {
      if (!Array.isArray(rawSlots) || rawSlots.length === 0) return rawSlots;
      if (effPlacesPerDay == null || effPlacesPerDay <= 0 || effDays < 1) return rawSlots;

      const target = effDays * effPlacesPerDay;
      let next = rawSlots.slice(0, target);
      if (next.length >= target) return next;

      const counts = Array.from({ length: effDays }, () => 0);
      const used = new Set();
      next.forEach((s) => {
        used.add(String(s.placeId));
        const d = Number.isFinite(Number(s.dayIndex)) ? Number(s.dayIndex) : 0;
        const di = Math.min(effDays - 1, Math.max(0, d));
        counts[di] += 1;
      });

      const candidates = (fallbackPlaceIds || []).filter((id) => placeIdSet.has(String(id)) && !used.has(String(id)));
      const fillsNeeded = target - next.length;
      const fillTimes = pickFillTimes(effPlacesPerDay);

      for (let i = 0; i < fillsNeeded; i += 1) {
        const pid = candidates[i];
        if (!pid) break;
        let dayIndex = counts.indexOf(Math.min(...counts));
        if (counts[dayIndex] >= effPlacesPerDay) {
          // All full (shouldn't happen with fillsNeeded math), bail.
          break;
        }
        const place = (places || []).find((p) => String(p.id) === String(pid));
        const time = fillTimes[counts[dayIndex]] || '09:30';
        next.push({
          placeId: String(pid),
          suggestedTime: time,
          dayIndex,
          reason: place?.category
            ? `Added to complete your ${effPlacesPerDay} stops/day plan (${place.category}).`
            : `Added to complete your ${effPlacesPerDay} stops/day plan.`,
        });
        used.add(String(pid));
        counts[dayIndex] += 1;
      }

      return next;
    };

    const finalizeTripSlots = async (rawSlots) => {
      if (!rawSlots?.length) return rawSlots;
      let next = normalizeSlotsForDuration(rawSlots, effDays);
      next = dedupeSlotsByPlacePreserveOrder(next);
      if (effPlacesPerDay != null && effPlacesPerDay > 0) {
        next = enforcePlacesPerDay(next, effDays, effPlacesPerDay);
      }
      next = ensureExactSlotCount(next);
      return applySmartScheduleToAiSlots(next, effDays, effSelectedDate, places);
    };

    if (
      singleReplaceSlotIndex != null &&
      Number.isInteger(singleReplaceSlotIndex) &&
      previousSlots?.length &&
      singleReplaceSlotIndex >= 0 &&
      singleReplaceSlotIndex < previousSlots.length
    ) {
      const { ok, slots: merged } = mergeSingleReplaceFromRawPlan(
        rawForPlan,
        previousSlots,
        singleReplaceSlotIndex,
        placeIdSet
      );
      if (ok) {
        return {
          text: outText,
          slots: await finalizeTripSlots(merged),
          tripSettings,
        };
      }
      slots = merged;
      const fail =
        lang === 'ar'
          ? '\n\nتعذّر تطبيق استبدال هذا الموقع فقط. جرّب طلبًا أوضح أو أعد المحاولة.'
          : lang === 'fr'
            ? '\n\nImpossible d’appliquer le remplacement pour cet arrêt seul. Reformulez ou réessayez.'
            : '\n\nCould not apply a single-stop replacement. Try a clearer request or try again.';
      return {
        text: `${outText}${fail}`,
        slots: slots?.length ? await finalizeTripSlots(slots) : slots,
        tripSettings,
      };
    }

    if (slots?.length) {
      slots = await finalizeTripSlots(slots);
    }
    return { text: outText, slots, tripSettings };
  } catch (e) {
    if (e instanceof AIPlannerApiError) throw e;
    return { text: 'Something went wrong. Please try again.', slots: null, tripSettings: null };
  }
}

/**
 * Build trip `days` payload for POST /api/user/trips from AI slots.
 */
export function slotsToTripDays(slots, durationDays, startDate) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const maxDay = Number.isFinite(durationDays) && durationDays >= 1 ? durationDays - 1 : 0;
  const byDay = new Map();
  for (const s of slots) {
    let d = s.dayIndex != null && Number.isFinite(s.dayIndex) ? Math.max(0, s.dayIndex) : 0;
    d = Math.min(maxDay, d);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(s);
  }

  const days = [];
  for (let d = 0; d < durationDays; d += 1) {
    const list = (byDay.get(d) || []).slice();
    list.sort((a, b) => {
      const ta = a.suggestedTime || '00:00';
      const tb = b.suggestedTime || '00:00';
      return ta.localeCompare(tb);
    });
    const dayDate = new Date(start);
    dayDate.setDate(dayDate.getDate() + d);
    const dateStr = dayDate.toISOString().slice(0, 10);
    const slotsOut = list.map((s) => {
      const hm = normalizeSuggestedTime(s.suggestedTime);
      return {
        placeId: s.placeId,
        startTime: hm.length === 5 && hm.includes(':') ? `${hm}:00` : '09:00:00',
        endTime: null,
        notes: s.reason || null,
      };
    });
    days.push({ date: dateStr, slots: slotsOut });
  }
  return days;
}
