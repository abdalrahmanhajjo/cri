const jwt = require('jsonwebtoken');
const { getCollection } = require('../mongo');

const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? '' : 'fallback-dev-only');
const MAX_TOKEN_LENGTH = 1024;
/**
 * Must match `expiresIn` on every auth JWT issued in `routes/auth.js`.
 * Default 7d so a typical break (e.g. 1h away) does not force sign-in; override with JWT_EXPIRES_IN.
 */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_OPTIONS = {
  algorithms: ['HS256'],
  maxAge: JWT_EXPIRES_IN,
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
    const usersColl = await getCollection('users');
    const user = await usersColl.findOne({ id: userId });
    
    if (!user) {
      if (optional) return false;
      res.status(401).json({ error: 'Invalid token' });
      return false;
    }

    if (user.is_blocked === true) {
      res.status(403).json({ error: 'Account disabled', code: 'ACCOUNT_BLOCKED' });
      return false;
    }

    if (user.auth_provider === 'email' && user.email_verified !== true) {
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

module.exports = { authMiddleware, optionalAuthMiddleware, JWT_EXPIRES_IN };
