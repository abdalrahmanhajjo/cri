const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    console.error('Fatal: JWT_SECRET is required in production.');
    process.exit(1);
  }
  if (!process.env.CORS_ORIGIN?.trim()) {
    console.warn('Security: CORS_ORIGIN is not set. Set it to your frontend URL(s) in production.');
  }
}

const express = require('express');
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
const profileRoutes = require('./routes/profile');
const tripsRoutes = require('./routes/trips');
const adminPlacesRoutes = require('./routes/admin/places');
const adminCategoriesRoutes = require('./routes/admin/categories');
const adminToursRoutes = require('./routes/admin/tours');
const adminEventsRoutes = require('./routes/admin/events');
const adminContentRoutes = require('./routes/admin/content');
const adminUploadRoutes = require('./routes/admin/upload');

const app = express();
const PORT = process.env.PORT || 3095;

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
app.use(express.json({ limit: '256kb' }));
app.use(sanitizeBody);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
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
    max: 80,
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true
  })
);

app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    message: { error: 'Too many auth attempts. Try again later.' },
    standardHeaders: true
  })
);

app.use(
  '/api/admin',
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Too many admin requests. Please slow down.' },
    standardHeaders: true
  })
);

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/tours', toursRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/user', profileRoutes);
app.use('/api/user', tripsRoutes);
app.use('/api/admin/places', adminPlacesRoutes);
app.use('/api/admin/categories', adminCategoriesRoutes);
app.use('/api/admin/tours', adminToursRoutes);
app.use('/api/admin/events', adminEventsRoutes);
app.use('/api/admin/content', adminContentRoutes);
app.use('/api/admin/upload', adminUploadRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'An error occurred' : (err.message || 'An error occurred') });
});

const basePort = parseInt(process.env.PORT, 10) || 3095;
function tryListen(port) {
  const server = app.listen(port, () => {
    console.log('Tripoli Explorer Web API running on http://localhost:' + port);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < basePort + 10) {
      tryListen(port + 1);
    } else {
      throw err;
    }
  });
}
tryListen(basePort);
