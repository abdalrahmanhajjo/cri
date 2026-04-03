const express = require('express');
const { hasMongoConfigured, verifyMongoConnection } = require('../mongo');

const router = express.Router();

/** Liveness — process up (no DB). */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mongo: hasMongoConfigured() ? 'enabled' : 'not_configured',
    timestamp: new Date().toISOString(),
  });
});

/** Readiness — DB reachable. Use for K8s/Render routing. */
router.get('/ready', async (req, res) => {
  try {
    if (!hasMongoConfigured()) {
      throw new Error('MongoDB is not configured.');
    }
    const mongoOk = await verifyMongoConnection();
    if (!mongoOk) throw new Error('MongoDB ping failed.');

    res.json({
      status: 'ready',
      database: 'connected',
      mongo: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      mongo: hasMongoConfigured() ? 'error' : 'not_configured',
      message: err.message,
      detail: process.env.NODE_ENV === 'development' ? String(err.message || err) : undefined,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
