const { v4: uuidv4 } = require('uuid');

/** Simple structured logger */
const logger = {
  info: (msg, meta = {}) => console.log(JSON.stringify({ level: 'info', msg, ...meta, timestamp: new Date().toISOString() })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'error', msg, ...meta, timestamp: new Date().toISOString() })),
  warn: (msg, meta = {}) => console.warn(JSON.stringify({ level: 'warn', msg, ...meta, timestamp: new Date().toISOString() })),
};

/**
 * Request ID and logging middleware
 */
const requestLogger = (req, res, next) => {
  req.id = uuidv4();
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('request_finished', {
      id: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });
  next();
};

module.exports = {
  logger,
  requestLogger
};
