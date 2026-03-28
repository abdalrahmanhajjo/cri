'use strict';

/**
 * Optional error monitoring. Set SENTRY_DSN on the server; no-op when unset.
 */
let Sentry = null;

function initSentry() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE?.trim() || undefined,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,
      sendDefaultPii: false,
    });
  } catch (e) {
    console.warn('Sentry: failed to load (@sentry/node).', e.message);
    Sentry = null;
  }
}

function captureException(err, context) {
  if (!Sentry || !err) return;
  try {
    Sentry.withScope((scope) => {
      if (context && typeof context === 'object') {
        if (context.requestId) scope.setTag('request_id', String(context.requestId));
        if (context.path) scope.setTag('path', String(context.path));
      }
      Sentry.captureException(err);
    });
  } catch (_) {
    /* ignore */
  }
}

function isEnabled() {
  return Boolean(Sentry);
}

module.exports = { initSentry, captureException, isEnabled };
