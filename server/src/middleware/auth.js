const jwt = require('jsonwebtoken');
const { query } = require('../db');

const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? '' : 'fallback-dev-only');
const MAX_TOKEN_LENGTH = 1024;
const JWT_OPTIONS = {
  algorithms: ['HS256'],
  maxAge: isProd ? '3d' : '7d',
  clockTolerance: 0,
};

/**
 * Confirms user exists, is not blocked, and (for email/password accounts) has verified email.
 * @param {boolean} [opts.optional] If true, unverified/missing user returns false without sending 403;
 *   blocked users still receive 403. Caller should call next() without req.user when false and !res.headersSent.
 * @returns {Promise<boolean>}
 */
async function assertUserCanUseApi(userId, res, opts = {}) {
  const optional = opts.optional === true;
  try {
    const { rows } = await query(
      `SELECT COALESCE(is_blocked, false) AS is_blocked,
              COALESCE(email_verified, false) AS email_verified,
              LOWER(TRIM(COALESCE(auth_provider, 'email'))) AS auth_provider
       FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows.length) {
      if (optional) return false;
      res.status(401).json({ error: 'Invalid token' });
      return false;
    }
    const row = rows[0];
    if (row.is_blocked === true) {
      res.status(403).json({ error: 'Account disabled', code: 'ACCOUNT_BLOCKED' });
      return false;
    }
    if (row.auth_provider === 'email' && row.email_verified !== true) {
      if (optional) return false;
      res.status(403).json({
        error:
          'Please verify your email to use your account. Check your inbox for the code, or open Verify email from the sign-in page.',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return false;
    }
    return true;
  } catch (err) {
    if (err.code === '42703') {
      return true;
    }
    console.error(err);
    if (!optional) {
      res.status(500).json({ error: 'Auth check failed' });
    }
    return false;
  }
}

async function authMiddleware(req, res, next) {
  if (isProd && !process.env.JWT_SECRET) {
    return res.status(503).json({ error: 'Service unavailable' });
  }
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (token.length > MAX_TOKEN_LENGTH) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, JWT_OPTIONS);
    if (!decoded.userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const ok = await assertUserCanUseApi(decoded.userId, res, { optional: false });
    if (!ok) return;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Sets req.user when a valid Bearer token is present; otherwise leaves req.user unset. */
async function optionalAuthMiddleware(req, res, next) {
  if (isProd && !process.env.JWT_SECRET) {
    return next();
  }
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET, JWT_OPTIONS);
    if (decoded.userId) {
      const ok = await assertUserCanUseApi(decoded.userId, res, { optional: true });
      if (!ok) {
        if (res.headersSent) return;
        return next();
      }
      req.user = decoded;
    }
  } catch {
    /* ignore invalid optional token */
  }
  next();
}

module.exports = { authMiddleware, optionalAuthMiddleware };
