const path = require('path');

/**
 * Positive int from env, or default.
 */
function envInt(name, defaultValue, min = 1) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return defaultValue;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= min ? n : defaultValue;
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: envInt('PORT', 3095),
  HOST: process.env.HOST?.trim() || '0.0.0.0',
  TRUST_PROXY: process.env.TRUST_PROXY,
  JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT?.trim() || '512kb',
  CORS_ORIGIN: process.env.CORS_ORIGIN?.trim(),
  SERVE_CLIENT_DIST: ['1', 'true', 'yes'].includes(process.env.SERVE_CLIENT_DIST?.trim().toLowerCase()),
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  RATE_LIMITS: {
    API: envInt('RATE_LIMIT_API_PER_MIN', 500, 10),
    AUTH: {
      MAX: envInt('RATE_LIMIT_AUTH_MAX', 60, 5),
      WINDOW: envInt('RATE_LIMIT_AUTH_WINDOW_MIN', 15, 1),
    },
    ADMIN: envInt('RATE_LIMIT_ADMIN_PER_MIN', 240, 10),
    BUSINESS: envInt('RATE_LIMIT_BUSINESS_PER_MIN', 300, 10),
    COUPONS: envInt('RATE_LIMIT_COUPONS_PER_MIN', 120, 10),
    AI: envInt('RATE_LIMIT_AI_PER_MIN', 24, 5),
  },
  PATHS: {
    UPLOADS: path.join(__dirname, '../../uploads'),
    CLIENT_DIST: path.join(__dirname, '../../../client/dist'),
  }
};
