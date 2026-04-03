const fs = require('fs');
const path = require('path');

/* Primary: server/.env. Then repo-root .env fills any missing keys. */
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
const rootEnvPath = path.join(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath });
}

const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error('Fatal: MONGODB_URI is required in production.');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET?.trim()) {
    console.error('Fatal: JWT_SECRET is required in production.');
    process.exit(1);
  }
  const cors = process.env.CORS_ORIGIN?.trim();
  if (!cors) {
    console.error(
      'Fatal: CORS_ORIGIN is required in production (comma-separated origins, or * only for controlled testing).'
    );
    process.exit(1);
  }
} else if (!process.env.JWT_SECRET?.trim()) {
  console.warn('Warning: JWT_SECRET is not set; auth tokens will use a dev fallback.');
}

const { initSentry, isEnabled: sentryEnabled } = require('./instrumentSentry');
initSentry();

const app = require('./app');

const {
  hasMongoConfigured,
  verifyMongoConnection,
  closeMongoClient,
  mongoDbName,
} = require('./mongo');

const basePort = parseInt(process.env.PORT, 10) || 3095;
const listenHost = process.env.HOST?.trim() || '0.0.0.0';

const server = app.listen(basePort, listenHost, () => {
  const clientDev = (process.env.CLIENT_DEV_URL || 'http://localhost:5173').replace(/\/$/, '');
  console.log(
    `Tripoli Explorer Web API on http://${listenHost === '0.0.0.0' ? 'localhost' : listenHost}:${basePort}`
  );
  console.log('  GET /health (liveness)  |  GET /ready (DB readiness)');
  console.log(
    '  REST: /api/admin/*  |  /api/business/*  |  /api/feed  |  /api/promotions  |  /api/coupons  |  /api/site-settings'
  );
  console.log(`  Web app: ${clientDev}/admin  |  ${clientDev}/business`);
  const groqOk = Boolean((process.env.GROQ_API_KEY || '').trim());
  const n8nOk = Boolean((process.env.N8N_WEBHOOK_URL || '').trim());
  console.log(
    `  AI planner: ${groqOk ? 'GROQ_API_KEY set' : n8nOk ? 'N8N_WEBHOOK_URL set' : 'not configured'}`
  );
  console.log(`  MongoDB: ${hasMongoConfigured() ? `configured (${mongoDbName()})` : 'not configured'}`);
  console.log(`  Sentry: ${sentryEnabled() ? 'on' : 'off'}`);

  if (hasMongoConfigured()) void verifyMongoConnection();
});

/** Long uploads + ffmpeg (reels). Host/proxy may still enforce a lower max (set same on the platform if possible). */
const HTTP_SERVER_TIMEOUT_MS = parseInt(process.env.HTTP_SERVER_TIMEOUT_MS || '900000', 10);
if (Number.isFinite(HTTP_SERVER_TIMEOUT_MS) && HTTP_SERVER_TIMEOUT_MS > 0) {
  server.timeout = HTTP_SERVER_TIMEOUT_MS;
  server.requestTimeout = HTTP_SERVER_TIMEOUT_MS;
  server.headersTimeout = Math.min(HTTP_SERVER_TIMEOUT_MS + 120000, 1_800_000);
  console.log(`  HTTP server timeout: ${HTTP_SERVER_TIMEOUT_MS}ms (HTTP_SERVER_TIMEOUT_MS)`);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${basePort} is in use. Stop the other process or set PORT in server/.env (match client DEV_API_PROXY_TARGET).`
    );
    process.exit(1);
  }
  throw err;
});

function shutdown(signal) {
  console.log(`Shutting down (${signal})…`);
  server.close((closeErr) => {
    if (closeErr) console.error('HTTP close error:', closeErr.message);
    const mongoClose = closeMongoClient();
    mongoClose
      .then(() => process.exit(0))
      .catch((e) => {
        console.error('MongoDB close error:', e.message);
        process.exit(1);
      });
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
