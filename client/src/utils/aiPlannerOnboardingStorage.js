const TOUR_VERSION = '2';

export function aiPlannerOnboardingStorageKey(userId) {
  const id = userId != null && String(userId).trim() !== '' ? String(userId) : 'anon';
  return `tripoli_ai_planner_onboarding_v${TOUR_VERSION}_${id}`;
}

export function isAiPlannerOnboardingDone(userId) {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(aiPlannerOnboardingStorageKey(userId)) === '1';
  } catch {
    return true;
  }
}

export function setAiPlannerOnboardingDone(userId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(aiPlannerOnboardingStorageKey(userId), '1');
  } catch {
    /* ignore */
  }
}

export function clearAiPlannerOnboarding(userId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(aiPlannerOnboardingStorageKey(userId));
  } catch {
    /* ignore */
  }
}
