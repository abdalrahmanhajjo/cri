const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * Liveness check
 * Quick check to see if the process is up.
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Readiness check
 * Verifies the process is up AND can connect to the database.
 * Used by Render/Docker/K8s for traffic routing.
 */
router.get('/ready', async (req, res) => {
  try {
    // Attempt a simple query to verify DB connectivity
    await pool.query('SELECT 1');
    res.json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Health] Readiness check failed:', err.message);
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
