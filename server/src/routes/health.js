const express = require('express');
const { query: dbQuery } = require('../db');

const router = express.Router();

/** Liveness — process up (no DB). */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** Readiness — DB reachable (SELECT 1). Use for K8s/Render routing. */
router.get('/ready', async (req, res) => {
  try {
    await dbQuery('SELECT 1');
    res.json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      detail: process.env.NODE_ENV === 'development' ? String(err.message || err) : undefined,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
