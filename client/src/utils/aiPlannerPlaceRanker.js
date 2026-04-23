/**
 * Ranks places for the AI planner so the model sees strong candidates first.
 * Existing exports stay the same, but scoring/diversity now live in utils/placeRanking/*.ts.
 */

import { rankPlaces } from './placeRanking/rankPlaces.ts';
import { mmrSelect } from './placeRanking/mmrSelect.ts';
import { retrieveCandidates } from './placeRanking/retrieveCandidates.ts';
import { aiRerankPlaces } from './placeRanking/aiRerankPlaces.ts';

const BUDGET_LOW_HINTS = /\b(free|cheap|budget|low|econom|€?0|\$0|gratis|مجاني|رخيص|اقتصاد)/i;
const BUDGET_HIGH_HINTS = /\b(luxury|upscale|fine|splurge|treat|premium|فاخر|رفاه)/i;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function areaBucket(place) {
  const loc = norm(place?.location);
  const name = norm(place?.name);
  const blob = `${loc} ${name}`;
  if (/(mina|port|seafront|corniche|fish|Ù…ÙŠÙ†Ø§Ø¡|Ù…Ù†Ø§Ø±Ø©)/.test(blob)) return 'mina';
  if (/(old city|souk|souq|khan|citadel|tell|Ù…Ø¯ÙŠÙ†Ø© Ù‚Ø¯ÙŠÙ…Ø©|Ø³ÙˆÙ‚|Ø®Ø§Ù†|Ù‚Ù„Ø¹Ø©)/.test(blob)) return 'old_city';
  return 'other';
}

export function extractPlannerKeywords(userMessage, interestNames, budget) {
  const parts = [];
  for (const n of interestNames || []) if (n) parts.push(norm(n));
  if (userMessage) parts.push(norm(userMessage));
  const blob = parts.join(' ');
  const tokens = new Set();
  for (const w of blob.split(/[^a-zA-Z0-9\u0600-\u06FF]+/).filter((x) => x.length > 2)) {
    tokens.add(w);
  }
  for (const phrase of [
    'museum',
    'mosque',
    'church',
    'citadel',
    'souk',
    'sweet',
    'dessert',
    'coffee',
    'seafood',
    'fish',
    'family',
    'history',
    'shopping',
    'craft',
    'soap',
    'beach',
    'view',
  ]) {
    if (blob.includes(phrase)) tokens.add(phrase);
  }
  return { blob, tokens, budget };
}

export async function rankPlacesForPlanner(places, options = {}) {
  const {
    userMessage = '',
    interestNames = [],
    budget = 'moderate',
    maxForPrompt = 52,
    learnedCategoryHints = [],
  } = options;

  const list = Array.isArray(places) ? [...places] : [];
  if (!list.length) return { ordered: [], hintLines: [] };

  const intentText = [userMessage, ...(interestNames || [])].filter(Boolean).join(' ');
  const retrieved = await retrieveCandidates(list, intentText, 90);
  const rerankedList = await aiRerankPlaces(retrieved, intentText);
  const ranked = rankPlaces(rerankedList, intentText, { budget, interestNames });
  const head = ranked.slice(0, Math.min(90, ranked.length));
  const picked = mmrSelect(head, { k: Math.min(maxForPrompt, head.length), lambda: 0.64 });
  const ordered = picked.map((row) => row.place);

  const kw = extractPlannerKeywords(userMessage, interestNames, budget);
  const hintLines = [];
  if (kw.budget === 'low' || BUDGET_LOW_HINTS.test(kw.blob)) {
    hintLines.push('User budget is modest: prefer free/low-cost venues where possible; still vary the day.');
  }
  if (kw.budget === 'luxury' || BUDGET_HIGH_HINTS.test(kw.blob)) {
    hintLines.push('User is comfortable spending: include standout food/experience stops where tags/price suggest quality.');
  }
  if (ordered.length >= 2) {
    const buckets = new Set(ordered.slice(0, 24).map((p) => areaBucket(p)));
    if (buckets.size >= 2) {
      hintLines.push(
        'Places are tagged by area hints in the list (location). When possible, cluster consecutive stops to reduce walking—Old City/souks vs Al-Mina/waterfront.'
      );
    }
  }
  if (interestNames?.length) {
    hintLines.push(`User selected themes: ${interestNames.join(', ')} — weight those heavily in choices and reasons.`);
  }
  if (learnedCategoryHints.length) {
    hintLines.push(
      `From earlier AI plans on this device they often saw these listing categories: ${learnedCategoryHints.slice(0, 6).join(', ')} — when it fits the request, lean on that taste but still add variety.`
    );
  }

  return { ordered, hintLines };
}

export function compactPlaceRowForModel(p) {
  const tags = Array.isArray(p.tags)
    ? p.tags.slice(0, 4).map((t) => String(t).trim()).filter(Boolean)
    : [];
  const loc = p.location != null ? String(p.location).trim() : '';
  const locShort = loc.length > 42 ? `${loc.slice(0, 40)}…` : loc;
  const dur = p.duration != null ? String(p.duration).trim() : '';
  const price = p.price != null ? String(p.price).trim() : '';
  const bt = p.bestTime != null ? String(p.bestTime).trim().toLowerCase() : '';
  const area = areaBucket(p);
  const oh = p.openingHours != null ? String(p.openingHours).trim() : '';
  return {
    id: String(p.id),
    name: p.name != null ? String(p.name) : '',
    category: p.category != null ? String(p.category) : '',
    area,
    location: locShort,
    bestTime: bt || undefined,
    duration: dur || undefined,
    price: price || undefined,
    openingHours: oh || undefined,
    tags: tags.length ? tags : undefined,
  };
}
