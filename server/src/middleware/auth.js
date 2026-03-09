const jwt = require('jsonwebtoken');

const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? '' : 'fallback-dev-only');
const MAX_TOKEN_LENGTH = 1024;
const JWT_OPTIONS = {
  algorithms: ['HS256'],
  maxAge: isProd ? '3d' : '7d',
  clockTolerance: 0,
};

function authMiddleware(req, res, next) {
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
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authMiddleware };
