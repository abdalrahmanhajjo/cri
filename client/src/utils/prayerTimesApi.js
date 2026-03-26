import { TRIPOLI_LAT, TRIPOLI_LON } from './visitWeatherHint';

/**
 * Parse "HH:MM" or "H:MM" from AlAdhan to minutes from midnight.
 * @param {string} raw
 * @returns {number | null}
 */
export function parseTimeToMinutes(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim().slice(0, 5);
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return h * 60 + min;
}

/**
 * @typedef {{ fajr: number, sunrise: number, dhuhr: number, asr: number, maghrib: number, isha: number } | null} PrayerMinutes
 */

/**
 * Muslim World League × coordinates for Tripoli (visitor scheduling; not a fatwa).
 * @param {string} ymd yyyy-mm-dd
 * @returns {Promise<PrayerMinutes>}
 */
export async function fetchPrayerMinutesForDate(ymd) {
  const s = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, mo, da] = s.split('-');
  const ddmmyyyy = `${da}-${mo}-${y}`;
  const url =
    `https://api.aladhan.com/v1/timings/${ddmmyyyy}` +
    `?latitude=${TRIPOLI_LAT}&longitude=${TRIPOLI_LON}&method=3`;
  let res;
  try {
    res = await fetch(url);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let json;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const t = json?.data?.timings;
  if (!t || typeof t !== 'object') return null;
  const fajr = parseTimeToMinutes(t.Fajr);
  const sunrise = parseTimeToMinutes(t.Sunrise);
  const dhuhr = parseTimeToMinutes(t.Dhuhr);
  const asr = parseTimeToMinutes(t.Asr);
  const maghrib = parseTimeToMinutes(t.Maghrib);
  const isha = parseTimeToMinutes(t.Isha);
  if ([fajr, sunrise, dhuhr, asr, maghrib, isha].some((x) => x == null)) return null;
  return { fajr, sunrise, dhuhr, asr, maghrib, isha };
}
