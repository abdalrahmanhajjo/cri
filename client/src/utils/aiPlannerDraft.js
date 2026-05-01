/**
 * AI Planner Draft — persists the current chat + plan to sessionStorage so
 * navigating away and back doesn't lose unsaved work.
 *
 * Uses sessionStorage (not localStorage) so the draft is scoped to the tab
 * and automatically discarded when the browser/tab is closed.
 */

const DRAFT_VERSION = 1;

function draftKey(userId) {
  return `vt_ai_planner_draft_v${DRAFT_VERSION}:${userId || 'anon'}`;
}

/**
 * Save the current chat messages to the session draft.
 * Only stores messages that have meaningful content (skips empty arrays).
 */
export function savePlannerDraft(userId, messages) {
  if (typeof window === 'undefined' || !Array.isArray(messages)) return;
  try {
    // Strip large/transient fields that don't need to be persisted
    const slim = messages.map((m) => {
      const base = {
        role: m.role,
        content: m.content ?? null,
      };
      if (Array.isArray(m.slots) && m.slots.length > 0) base.slots = m.slots;
      if (m.error) base.error = true;
      if (m.retryText) base.retryText = m.retryText;
      if (Array.isArray(m.changelog)) base.changelog = m.changelog;
      return base;
    });
    const payload = { v: DRAFT_VERSION, ts: Date.now(), messages: slim };
    sessionStorage.setItem(draftKey(userId), JSON.stringify(payload));
  } catch {
    /* sessionStorage quota or private mode — silently ignore */
  }
}

/**
 * Load a previously saved draft. Returns the messages array or null.
 * Discards drafts older than `maxAgeMs` (default 12 hours).
 */
export function loadPlannerDraft(userId, maxAgeMs = 12 * 60 * 60 * 1000) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || o.v !== DRAFT_VERSION || !Array.isArray(o.messages)) return null;
    if (typeof o.ts === 'number' && Date.now() - o.ts > maxAgeMs) {
      sessionStorage.removeItem(draftKey(userId));
      return null;
    }
    if (o.messages.length === 0) return null;
    return o.messages;
  } catch {
    return null;
  }
}

/**
 * Clear the draft (call after the user saves to trips or explicitly starts fresh).
 */
export function clearPlannerDraft(userId) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(draftKey(userId));
  } catch {
    /* ignore */
  }
}
