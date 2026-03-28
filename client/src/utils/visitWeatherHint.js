import { getApiOrigin } from './apiOrigin';

/** Tripoli — same coordinates as Explore.jsx Plan your visit widget. */
export const TRIPOLI_LAT = 34.4367;
export const TRIPOLI_LON = 35.8497;
export const TRIPOLI_TIMEZONE = 'Asia/Beirut';

function dayWeatherProxyUrl(ymd) {
  const base = getApiOrigin();
  const path = `/api/public/weather/day?start_date=${encodeURIComponent(ymd)}&end_date=${encodeURIComponent(ymd)}`;
  return base ? `${base}${path}` : path;
}

/**
 * WMO weather code for one calendar day (Open-Meteo daily).
 * @param {number} code
 * @returns {boolean} true if outdoor walking is unpleasant (rain, storm, fog, etc.)
 */
export function wmoCodeIsPoorForOutdoor(code) {
  if (code == null || Number.isNaN(Number(code))) return false;
  const c = Number(code);
  if (c === 45 || c === 48) return true; // fog
  if (c >= 51) return true; // drizzle and worse
  return false;
}

/**
 * @param {string} ymd yyyy-mm-dd
 * @returns {Promise<boolean>}
 */
export async function fetchPoorOutdoorWeatherForDate(ymd) {
  const d = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const url = dayWeatherProxyUrl(d);
  let res;
  try {
    res = await fetch(url);
  } catch {
    return false;
  }
  if (!res.ok) return false;
  let json;
  try {
    json = await res.json();
  } catch {
    return false;
  }
  const codes = json?.daily?.weather_code;
  const code = Array.isArray(codes) ? codes[0] : null;
  return wmoCodeIsPoorForOutdoor(code);
}
