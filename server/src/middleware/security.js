const validator = require('validator');

/**
 * Basic body sanitization to prevent XSS.
 * More specific validation should happen per route via Zod.
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    const keys = Object.keys(req.body);
    for (const key of keys) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = validator.escape(req.body[key].trim());
      }
    }
  }
  next();
}

module.exports = {
  sanitizeBody
};
