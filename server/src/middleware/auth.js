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

/** Returns false if response already sent (blocked / missing user / error). */
async function assertUserNotBlocked(userId, res) {
  try {
    const { rows } = await query(
      'SELECT COALESCE(is_blocked, false) AS is_blocked FROM users WHERE id = $1',
      [userId]
    );
    if (!rows.length) {
      res.status(401).json({ error: 'Invalid token' });
      return false;
    }
    if (rows[0].is_blocked === true) {
      res.status(403).json({ error: 'Account disabled', code: 'ACCOUNT_BLOCKED' });
      return false;
    }
    return true;
  } catch (err) {
    if (err.code === '42703') {
      return true;
    }
    console.error(err);
    res.status(500).json({ error: 'Auth check failed' });
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
    const ok = await assertUserNotBlocked(decoded.userId, res);
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
      const ok = await assertUserNotBlocked(decoded.userId, res);
      if (!ok) return;
      req.user = decoded;
    }
  } catch {
    /* ignore invalid optional token */
  }
  next();
}

module.exports = { authMiddleware, optionalAuthMiddleware };
