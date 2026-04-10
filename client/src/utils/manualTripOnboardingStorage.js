const CREATE_VERSION = '1';
const BUILDER_VERSION = '1';

export function manualTripCreateTourKey(userId) {
  const id = userId != null && String(userId).trim() !== '' ? String(userId) : 'anon';
  return `tripoli_manual_trip_create_tour_v${CREATE_VERSION}_${id}`;
}

export function isManualTripCreateTourDone(userId) {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(manualTripCreateTourKey(userId)) === '1';
  } catch {
    return true;
  }
}

export function setManualTripCreateTourDone(userId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(manualTripCreateTourKey(userId), '1');
  } catch {
    /* ignore */
  }
}

export function clearManualTripCreateTour(userId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(manualTripCreateTourKey(userId));
  } catch {
    /* ignore */
  }
}

export function manualTripBuilderTourKey(userId) {
  const id = userId != null && String(userId).trim() !== '' ? String(userId) : 'anon';
  return `tripoli_manual_trip_builder_tour_v${BUILDER_VERSION}_${id}`;
}

export function isManualTripBuilderTourDone(userId) {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(manualTripBuilderTourKey(userId)) === '1';
  } catch {
    return true;
  }
}

export function setManualTripBuilderTourDone(userId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(manualTripBuilderTourKey(userId), '1');
  } catch {
    /* ignore */
  }
}

export function clearManualTripBuilderTour(userId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(manualTripBuilderTourKey(userId));
  } catch {
    /* ignore */
  }
}
