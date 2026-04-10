const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
require('express-async-errors');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { sanitizeBody } = require('./middleware/security');

const healthRoutes = require('./routes/health');
const metricsRoutes = require('./routes/metrics');
const { logError, useJson: structuredLogs } = require('./utils/logger');
const { captureException } = require('./instrumentSentry');
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
const adminPlacePromotionsRoutes = require('./routes/admin/placePromotions');
const adminSponsoredPlacesRoutes = require('./routes/admin/sponsoredPlaces');
const adminSponsorshipPurchasesRoutes = require('./routes/admin/sponsorshipPurchases');
const adminCouponsMgmtRoutes = require('./routes/admin/couponsMgmt');
const adminEmailBroadcastRoutes = require('./routes/admin/emailBroadcast');
const siteSettingsPublicRoutes = require('./routes/siteSettingsPublic');
const weatherPublicRoutes = require('./routes/weatherPublic');
const businessRoutes = require('./routes/business');
const feedPublicRoutes = require('./routes/feed');
const promotionsPublicRoutes = require('./routes/promotionsPublic');
const couponsRoutes = require('./routes/coupons');
const aiRoutes = require('./routes/ai');
const sponsoredPlacesPublicRoutes = require('./routes/sponsoredPlacesPublic');
const { seoRouter, makeSeoResponder } = require('./seo/seoRoutes');
const { injectAbsoluteFaviconLinks, getBaseUrl } = require('./seo/seoUtils');
const { isDatabaseConnectivityError, userFacingDbUnavailableMessage } = require('./utils/dbHttpError');

const app = express();

/** Behind Render / nginx. TRUST_PROXY=0 disables. */
if (process.env.TRUST_PROXY === '0' || process.env.TRUST_PROXY === 'false') {
  app.set('trust proxy', false);
} else if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

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

const isProd = process.env.NODE_ENV === 'production';
const rawCors = process.env.CORS_ORIGIN?.trim();
const allowedOrigins =
  rawCors && rawCors !== '*' ? rawCors.split(',').map((o) => o.trim()).filter(Boolean) : null;

app.disable('x-powered-by');

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      // Helmet's defaults also define script-src; merging produced duplicate script-src (browser warning).
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://maps.googleapis.com',
          'https://www.googletagmanager.com',
          /** Google Identity Services — https://accounts.google.com/gsi/client */
          'https://accounts.google.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        mediaSrc: ["'self'", 'data:', 'https:', 'http:', 'blob:'],
        connectSrc: [
          "'self'",
          'https://api.groq.com',
          'https://api.open-meteo.com',
          'https://api.aladhan.com',
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
          'https://*.google-analytics.com',
          /** GIS token / FedCM may connect to accounts.google.com */
          'https://accounts.google.com',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        frameSrc: ["'self'", 'https://www.googletagmanager.com', 'https://accounts.google.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    /** Default Helmet COOP is `same-origin`, which breaks Google Sign-In popups (blank gsi/transform). */
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  })
);

app.use(compression());

/** Stripe webhooks require raw body for signature verification (must run before express.json). */
const stripeWebhookRouter = require('./routes/stripeWebhook');
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookRouter);

app.use(express.json({ limit: JSON_BODY_LIMIT, strict: true }));
app.use(sanitizeBody);

if (isProd && !rawCors) {
  console.error('CRITICAL: CORS_ORIGIN is missing in production. Requests from browsers will be rejected.');
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (rawCors === '*') return callback(null, true);
      if (allowedOrigins && allowedOrigins.includes(origin)) return callback(null, true);
      if (isProd) {
        const err = new Error('Not allowed by CORS');
        err.status = 403;
        return callback(err, false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Code'],
    maxAge: 86400,
  })
);

app.use('/api', (req, res, next) => {
  const code = req.get('X-Session-Code');
  if (code && typeof code === 'string' && code.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(code)) {
    req.sessionCode = code;
  }
  next();
});

app.use(healthRoutes);

app.use('/api/metrics', metricsRoutes);

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

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


app.use('/api/public/weather', weatherPublicRoutes);

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
app.use('/api/sponsored-places', sponsoredPlacesPublicRoutes);
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
app.use('/api/admin/place-promotions', adminPlacePromotionsRoutes);
app.use('/api/admin/sponsored-places', adminSponsoredPlacesRoutes);
app.use('/api/admin/sponsorship-purchases', adminSponsorshipPurchasesRoutes);
app.use('/api/admin/coupons', adminCouponsMgmtRoutes);
app.use('/api/admin/email-broadcast', adminEmailBroadcastRoutes);
app.use('/api/business', businessRoutes);

const serveClientDist =
  process.env.SERVE_CLIENT_DIST === '1' ||
  process.env.SERVE_CLIENT_DIST === 'true' ||
  process.env.SERVE_CLIENT_DIST === 'yes';
const clientDistPath = path.join(__dirname, '../../client/dist');
if (serveClientDist) {
  if (fs.existsSync(clientDistPath)) {
    app.use(seoRouter);
    app.get('*', makeSeoResponder({ clientDistPath }));

    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/uploads') ||
        req.path === '/health' ||
        req.path === '/ready'
      ) {
        return next();
      }
      if (path.extname(req.path)) return next();
      const indexPath = path.join(clientDistPath, 'index.html');
      try {
        const st = fs.statSync(indexPath);
        if (!cachedSpaIndexHtml || st.mtimeMs !== cachedSpaIndexMtime) {
          cachedSpaIndexHtml = fs.readFileSync(indexPath, 'utf8');
          cachedSpaIndexMtime = st.mtimeMs;
        }
        const html = injectAbsoluteFaviconLinks(cachedSpaIndexHtml, getBaseUrl(req));
        res.type('text/html').send(html);
      } catch (e) {
        res.sendFile(indexPath, (err) => next(err || e));
      }
    });
    console.log(`Serving SPA from ${clientDistPath} (SERVE_CLIENT_DIST)`);
  } else {
    console.warn(
      'SERVE_CLIENT_DIST is set but client/dist not found. From repo root run: npm run build --prefix client'
    );
  }
}

let cachedSpaIndexHtml = null;
let cachedSpaIndexMtime = 0;

let lastDbConnectivityLog = 0;

/** Multer / upload filter errors must stay readable in production (global handler would hide them). */
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  try {
    const multer = require('multer');
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const cap = process.env.UPLOAD_MAX_FILE_BYTES?.trim();
        const msg = cap
          ? `File too large. Maximum is ${cap} bytes (UPLOAD_MAX_FILE_BYTES).`
          : 'File too large.';
        return res.status(413).json({ error: msg });
      }
      return res.status(400).json({ error: err.message || 'Upload rejected.' });
    }
  } catch (_) {
    /* multer not available */
  }
  const uploadMsg = String(err.message || '');
  if (
    uploadMsg.includes('Only images (JPEG') ||
    uploadMsg.includes('videos (MP4') ||
    uploadMsg.includes('HEIC is saved as JPEG')
  ) {
    return res.status(400).json({ error: uploadMsg });
  }
  next(err);
});

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
    logError('request_error', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl?.split('?')[0],
      message: msg,
      stack: !isProd && err.stack ? String(err.stack).slice(0, 2000) : undefined,
    });
    captureException(err, { requestId: req.id, path: req.originalUrl?.split('?')[0] });
    if (!structuredLogs) console.error(err);
  }
  const status = err.status != null ? err.status : dbDown ? 503 : 500;
  const error = dbDown
    ? userFacingDbUnavailableMessage(msg)
    : isProd
      ? 'An error occurred'
      : err.message || 'An error occurred';
  res.status(status).json({
    error,
    id: req.id,
    detail: !isProd ? msg : undefined,
  });
});

module.exports = app;
