const fs = require('fs');
const path = require('path');
/* Primary: server/.env. Then repo-root .env fills any missing keys (e.g. GROQ only in root). */
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
const rootEnvPath = path.join(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath });
}

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    console.error('Fatal: JWT_SECRET is required in production.');
    process.exit(1);
  }
  const corsSet = process.env.CORS_ORIGIN?.trim();
  if (!corsSet) {
    console.warn('Security: CORS_ORIGIN is not set. Set it to your frontend URL(s), or use CORS_ORIGIN=* for development only.');
  }
}

const express = require('express');
require('express-async-errors');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { sanitizeBody } = require('./middleware/security');

const authRoutes = require('./routes/auth');
const placesRoutes = require('./routes/places');
const toursRoutes = require('./routes/tours');
const eventsRoutes = require('./routes/events');
const categoriesRoutes = require('./routes/categories');
const interestsPublicRoutes = require('./routes/interests');
const profileRoutes = require('./routes/profile');
const tripsRoutes = require('./routes/trips');
const adminPlacesRoutes = require('./routes/admin/places');
const adminCategoriesRoutes = require('./routes/admin/categories');
const adminToursRoutes = require('./routes/admin/tours');
const adminEventsRoutes = require('./routes/admin/events');
const adminContentRoutes = require('./routes/admin/content');
const adminUploadRoutes = require('./routes/admin/upload');
const adminStatsRoutes = require('./routes/admin/stats');
const adminUsersRoutes = require('./routes/admin/users');
const adminAllTripsRoutes = require('./routes/admin/allTrips');
const adminFeedRoutes = require('./routes/admin/feed');
const adminInterestsRoutes = require('./routes/admin/interests');
const adminPlaceOwnersRoutes = require('./routes/admin/placeOwners');
const adminSiteSettingsRoutes = require('./routes/admin/siteSettings');
const siteSettingsPublicRoutes = require('./routes/siteSettingsPublic');
const businessRoutes = require('./routes/business');
const feedPublicRoutes = require('./routes/feed');
const promotionsPublicRoutes = require('./routes/promotionsPublic');
const couponsRoutes = require('./routes/coupons');
const aiRoutes = require('./routes/ai');
const { verifyDatabaseConnection } = require('./db');
const { isDatabaseConnectivityError, userFacingDbUnavailableMessage } = require('./utils/dbHttpError');

const app = express();
/** Behind Render / nginx / load balancers so rate limits and req.ip reflect the client. Set TRUST_PROXY=0 to disable. */
if (process.env.TRUST_PROXY === '0' || process.env.TRUST_PROXY === 'false') {
  app.set('trust proxy', false);
} else if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const PORT = process.env.PORT || 3095;

/** Positive int from env, or default. Used for rate limits and body size tuning. */
function envInt(name, defaultValue, min = 1) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return defaultValue;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= min ? n : defaultValue;
}

const RATE_LIMIT_API_PER_MIN = envInt('RATE_LIMIT_API_PER_MIN', 500, 10);
const RATE_LIMIT_AUTH_MAX = envInt('RATE_LIMIT_AUTH_MAX', 60, 5);
const RATE_LIMIT_AUTH_WINDOW_MIN = envInt('RATE_LIMIT_AUTH_WINDOW_MIN', 15, 1);
const RATE_LIMIT_ADMIN_PER_MIN = envInt('RATE_LIMIT_ADMIN_PER_MIN', 240, 10);
const RATE_LIMIT_BUSINESS_PER_MIN = envInt('RATE_LIMIT_BUSINESS_PER_MIN', 300, 10);
const RATE_LIMIT_COUPONS_PER_MIN = envInt('RATE_LIMIT_COUPONS_PER_MIN', 120, 10);
const RATE_LIMIT_AI_PER_MIN = envInt('RATE_LIMIT_AI_PER_MIN', 24, 5);
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT?.trim() || '512kb';

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));
app.use(compression());
app.use(express.json({ limit: JSON_BODY_LIMIT, strict: true }));
app.use(sanitizeBody);

/** Comma-separated origins, or * for all (same as mobile app .env). */
const rawCors = process.env.CORS_ORIGIN?.trim();
const allowedOrigins =
  rawCors && rawCors !== '*'
    ? rawCors.split(',').map((o) => o.trim()).filter(Boolean)
    : null;
app.use(
  cors({
    origin: allowedOrigins != null && allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Code'],
    maxAge: 86400,
  })
);

app.use('/api', (req, res, next) => {
  const code = req.get('X-Session-Code');
  if (code && typeof code === 'string' && code.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(code)) req.sessionCode = code;
  next();
});

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: RATE_LIMIT_API_PER_MIN,
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
  })
);

app.use(
  '/api/auth',
  rateLimit({
    windowMs: RATE_LIMIT_AUTH_WINDOW_MIN * 60 * 1000,
    max: RATE_LIMIT_AUTH_MAX,
    message: { error: 'Too many auth attempts. Try again later.' },
    standardHeaders: true,
  })
);

app.use(
  '/api/admin',
  rateLimit({
    windowMs: 60 * 1000,
    max: RATE_LIMIT_ADMIN_PER_MIN,
    message: { error: 'Too many admin requests. Please slow down.' },
    standardHeaders: true,
  })
);

app.use(
  '/api/business',
  rateLimit({
    windowMs: 60 * 1000,
    max: RATE_LIMIT_BUSINESS_PER_MIN,
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
  })
);

app.use(
  '/api/coupons',
  rateLimit({
    windowMs: 60 * 1000,
    max: RATE_LIMIT_COUPONS_PER_MIN,
    message: { error: 'Too many coupon requests. Please slow down.' },
    standardHeaders: true,
  })
);

app.use(
  '/api/ai',
  rateLimit({
    windowMs: 60 * 1000,
    max: RATE_LIMIT_AI_PER_MIN,
    message: { error: 'Too many AI requests. Please slow down.' },
    standardHeaders: true,
  })
);

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/tours', toursRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/interests', interestsPublicRoutes);
app.use('/api/feed', feedPublicRoutes);
app.use('/api/promotions', promotionsPublicRoutes);
app.use('/api/coupons', couponsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/site-settings', siteSettingsPublicRoutes);
app.use('/api/user', profileRoutes);
app.use('/api/user', tripsRoutes);
app.use('/api/admin/places', adminPlacesRoutes);
app.use('/api/admin/categories', adminCategoriesRoutes);
app.use('/api/admin/tours', adminToursRoutes);
app.use('/api/admin/events', adminEventsRoutes);
app.use('/api/admin/content', adminContentRoutes);
app.use('/api/admin/upload', adminUploadRoutes);
app.use('/api/admin/stats', adminStatsRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/all-trips', adminAllTripsRoutes);
app.use('/api/admin/feed', adminFeedRoutes);
app.use('/api/admin/interests', adminInterestsRoutes);
app.use('/api/admin/place-owners', adminPlaceOwnersRoutes);
app.use('/api/admin/site-settings', adminSiteSettingsRoutes);
app.use('/api/business', businessRoutes);

/** Single-host deploy: build client to ../client/dist and set SERVE_CLIENT_DIST=true (see Dockerfile). */
const serveClientDist =
  process.env.SERVE_CLIENT_DIST === '1' ||
  process.env.SERVE_CLIENT_DIST === 'true' ||
  process.env.SERVE_CLIENT_DIST === 'yes';
const clientDistPath = path.join(__dirname, '../../client/dist');
if (serveClientDist) {
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path === '/health') {
        return next();
      }
      if (path.extname(req.path)) return next();
      res.sendFile(path.join(clientDistPath, 'index.html'), (err) => next(err));
    });
    console.log(`Serving SPA from ${clientDistPath} (SERVE_CLIENT_DIST)`);
  } else {
    console.warn(
      'SERVE_CLIENT_DIST is set but client/dist not found. From repo root run: npm run build --prefix client'
    );
  }
}

let lastDbConnectivityLog = 0;
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const msg = String(err.message || err);
  const dbDown = isDatabaseConnectivityError(err);
  if (dbDown) {
    const now = Date.now();
    if (now - lastDbConnectivityLog > 60_000) {
      lastDbConnectivityLog = now;
      console.error('Database connectivity:', msg);
    }
  } else {
    console.error(err);
  }
  const status = dbDown ? 503 : 500;
  const error = dbDown
    ? userFacingDbUnavailableMessage(msg)
    : process.env.NODE_ENV === 'production'
      ? 'An error occurred'
      : err.message || 'An error occurred';
  res.status(status).json({
    error,
    detail: process.env.NODE_ENV !== 'production' ? msg : undefined,
  });
});

const basePort = parseInt(process.env.PORT, 10) || 3095;
const listenHost = process.env.HOST?.trim() || '0.0.0.0';
const server = app.listen(basePort, listenHost, () => {
  const clientDev = (process.env.CLIENT_DEV_URL || 'http://localhost:5173').replace(/\/$/, '');
  console.log(`Tripoli Explorer Web API running on http://${listenHost === '0.0.0.0' ? 'localhost' : listenHost}:${basePort}`);
  console.log('  REST: /api/admin/* (admin)  |  /api/business/* (owners)  |  GET /api/feed  |  GET /api/promotions  |  /api/coupons/* (auth)  |  GET /api/site-settings (public JSON)');
  console.log(`  Web app (set CLIENT_DEV_URL in server/.env if Vite uses another port):`);
  console.log(`    ${clientDev}/admin  |  ${clientDev}/business`);
  const groqOk = Boolean((process.env.GROQ_API_KEY || '').trim());
  const n8nOk = Boolean((process.env.N8N_WEBHOOK_URL || '').trim());
  console.log(
    `  AI planner: ${groqOk ? 'GROQ_API_KEY set' : n8nOk ? 'N8N_WEBHOOK_URL set' : 'not configured (add GROQ_API_KEY to server/.env and restart)'}`
  );
  void verifyDatabaseConnection();
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${basePort} is already in use. Stop the other process (or set PORT in server/.env) so it matches client DEV_API_PROXY_TARGET in client/.env.`
    );
    process.exit(1);
    return;
  }
  throw err;
});

