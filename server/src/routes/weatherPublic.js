'use strict';

const express = require('express');
const { cachePublicList } = require('../middleware/publicCache');

const router = express.Router();

const TRIPOLI_LAT = 34.4367;
const TRIPOLI_LON = 35.8497;
const TZ = encodeURIComponent('Asia/Beirut');

const TRIPOLI_FORECAST_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${TRIPOLI_LAT}&longitude=${TRIPOLI_LON}` +
  '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m' +
  '&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min' +
  `&timezone=${TZ}`;

async function fetchOpenMeteoJson(url) {
  const ac = new AbortController();
  const kill = setTimeout(() => ac.abort(), 10_000);
  try {
    const r = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': 'VisitTripoli-Web/1.0' },
    });
    if (!r.ok) return { ok: false };
    const json = await r.json();
    return { ok: true, json };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(kill);
  }
}

/** Full forecast for home “Weather in Tripoli” (same JSON shape as Open-Meteo). */
router.get('/tripoli', cachePublicList(120, 600), async (req, res) => {
  const out = await fetchOpenMeteoJson(TRIPOLI_FORECAST_URL);
  if (!out.ok || !out.json?.current || !out.json?.daily) {
    return res.status(502).json({ error: 'Weather unavailable' });
  }
  res.json(out.json);
});

/**
 * Single-day weather_code for trip smart-scheduling (browser CSP–safe).
 * Query: start_date=YYYY-MM-DD&end_date=YYYY-MM-DD (same day).
 */
router.get('/day', cachePublicList(300, 900), async (req, res) => {
  const start = String(req.query.start_date || '').slice(0, 10);
  const end = String(req.query.end_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || start !== end) {
    return res.status(400).json({ error: 'start_date and end_date must be the same valid YYYY-MM-DD' });
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${TRIPOLI_LAT}&longitude=${TRIPOLI_LON}` +
    '&daily=weather_code' +
    `&timezone=${TZ}` +
    `&start_date=${start}&end_date=${end}`;
  const out = await fetchOpenMeteoJson(url);
  if (!out.ok || !out.json?.daily) {
    return res.status(502).json({ error: 'Weather unavailable' });
  }
  res.json(out.json);
});

module.exports = router;
