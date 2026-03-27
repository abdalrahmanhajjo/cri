const fs = require('fs');
const path = require('path');
const express = require('express');
require('express-async-errors');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const config = require('./config');
const { logger, requestLogger } = require('./middleware/logging');
const { sanitizeBody } = require('./middleware/security');

// Routes
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const placesRoutes = require('./routes/places');
const placesActionsRoutes = require('./routes/places.actions');
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
const { seoRouter, makeSeoResponder } = require('./seo/seoRoutes');

const { isDatabaseConnectivityError, userFacingDbUnavailableMessage } = require('./utils/dbHttpError');

const app = express();

// Proxy trust
if (config.TRUST_PROXY === '0' || config.TRUST_PROXY === 'false') {
  app.set('trust proxy', false);
} else {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

// Logging & Request ID
app.use(requestLogger);
app.use((req, res, next) => {
  if (req.id) res.set('X-Request-Id', req.id);
  next();
});

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      scriptSrc: ['\'self\'', '\'unsafe-inline\'', 'https://maps.googleapis.com'],
      styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'],
      imgSrc: ['\'self\'', 'data:', 'https:', 'http:'],
      connectSrc: ['\'self\'', 'https://api.groq.com', 'https://*.supabase.co', 'https://*.pooler.supabase.com'],
      fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
      objectSrc: ['\'none\''],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

app.use(compression());
app.use(express.json({ limit: config.JSON_BODY_LIMIT, strict: true }));
app.use(sanitizeBody);

// CORS
if (config.NODE_ENV === 'production' && !config.CORS_ORIGIN) {
  logger.error('CRITICAL: CORS_ORIGIN is missing in production. Fail-closed enabled.');
}

const allowedOrigins = config.CORS_ORIGIN && config.CORS_ORIGIN !== '*'
  ? config.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : null;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (config.CORS_ORIGIN === '*') return callback(null, true);
    if (allowedOrigins && allowedOrigins.includes(origin)) return callback(null, true);
    
    if (config.NODE_ENV === 'production') {
      const err = new Error('CORS blocked');
      err.status = 403;
      return callback(err, false);
    }
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Code'],
  maxAge: 86400,
}));

// Session Code extract
app.use('/api', (req, res, next) => {
  const code = req.get('X-Session-Code');
  if (code && typeof code === 'string' && code.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(code)) {
    req.sessionCode = code;
  }
  next();
});

// Health Checks (before rate limits)
app.use(healthRoutes);

// Rate Limits
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMITS.API,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
}));

app.use('/api/auth', rateLimit({
  windowMs: config.RATE_LIMITS.AUTH.WINDOW * 60 * 1000,
  max: config.RATE_LIMITS.AUTH.MAX,
  message: { error: 'Too many auth attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// ... other rate limits (omitted for brevity in this step, but I should include them all)
app.use('/api/admin', rateLimit({ windowMs: 60 * 1000, max: config.RATE_LIMITS.ADMIN, message: { error: 'Too many admin requests.' }, standardHeaders: true }));
app.use('/api/business', rateLimit({ windowMs: 60 * 1000, max: config.RATE_LIMITS.BUSINESS, message: { error: 'Too many business requests.' }, standardHeaders: true }));
app.use('/api/coupons', rateLimit({ windowMs: 60 * 1000, max: config.RATE_LIMITS.COUPONS, message: { error: 'Too many coupon requests.' }, standardHeaders: true }));
app.use('/api/ai', rateLimit({ windowMs: 60 * 1000, max: config.RATE_LIMITS.AI, message: { error: 'Too many AI requests.' }, standardHeaders: true }));

// Static
app.use('/uploads', express.static(config.PATHS.UPLOADS));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/places', placesActionsRoutes);
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
app.use('/api/user/trips', tripsRoutes);
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

// Client serving for Production
if (config.SERVE_CLIENT_DIST) {
  const distPath = config.PATHS.CLIENT_DIST;
  if (fs.existsSync(distPath)) {
    app.use(seoRouter);
    app.get('*', makeSeoResponder({ clientDistPath: distPath }));
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path === '/health' || req.path === '/ready') return next();
      if (path.extname(req.path)) return next();
      res.sendFile(path.join(distPath, 'index.html'), (err) => next(err));
    });
  }
}

// Global Error Handler
let lastDbConnectivityLog = 0;
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const msg = String(err.message || err);
  const dbDown = isDatabaseConnectivityError(err);
  
  if (dbDown) {
    const now = Date.now();
    if (now - lastDbConnectivityLog > 60000) {
      lastDbConnectivityLog = now;
      logger.error('database_connectivity_issue', { message: msg });
    }
  } else {
    logger.error('unhandled_error', { message: msg, stack: err.stack, id: req.id });
  }

  const status = dbDown ? 503 : (err.status || 500);
  const error = dbDown
    ? userFacingDbUnavailableMessage(msg)
    : config.NODE_ENV === 'production' ? 'An error occurred' : (err.message || 'An error occurred');

  res.status(status).json({
    error,
    id: req.id,
    detail: config.NODE_ENV !== 'production' ? msg : undefined,
  });
});

module.exports = app;
