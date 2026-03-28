'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { logInfo } = require('../utils/logger');

const router = express.Router();

const ALLOWED_NAMES = new Set(['CLS', 'FCP', 'INP', 'LCP', 'TTFB']);

const vitalsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many metrics submissions.' },
  standardHeaders: true,
});

function numOrNull(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * POST /api/metrics/vitals
 * Body: { metrics: [{ name, value, id, delta, rating }] } or single metric object.
 * Used by web-vitals in the browser (sendBeacon / fetch keepalive).
 */
router.post('/vitals', vitalsLimiter, (req, res) => {
  const rid = req.id;
  const raw = req.body && typeof req.body === 'object' ? req.body : {};
  let list = raw.metrics;
  if (!Array.isArray(list)) {
    if (raw.name && ALLOWED_NAMES.has(String(raw.name))) {
      list = [raw];
    } else {
      return res.status(400).json({ error: 'Invalid payload' });
    }
  }
  if (list.length > 20) return res.status(400).json({ error: 'Too many metrics' });

  const sanitized = [];
  for (const m of list) {
    if (!m || typeof m !== 'object') continue;
    const name = String(m.name || '');
    if (!ALLOWED_NAMES.has(name)) continue;
    const value = numOrNull(m.value);
    const delta = numOrNull(m.delta);
    if (value == null && delta == null) continue;
    sanitized.push({
      name,
      value: value ?? delta,
      delta: delta ?? value,
      id: typeof m.id === 'string' && m.id.length <= 64 ? m.id : undefined,
      rating: typeof m.rating === 'string' && m.rating.length <= 24 ? m.rating : undefined,
    });
  }

  if (sanitized.length === 0) {
    return res.status(400).json({ error: 'No valid metrics' });
  }

  logInfo('web_vitals', {
    requestId: rid,
    path: req.path,
    metrics: sanitized,
    ua: (req.get('user-agent') || '').slice(0, 200),
    referer: (req.get('referer') || '').slice(0, 200),
  });

  res.status(204).end();
});

module.exports = router;
