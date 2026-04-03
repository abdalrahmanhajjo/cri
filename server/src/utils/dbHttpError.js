/**
 * Map MongoDB errors to HTTP responses so public routes stay consistent.
 */
function isDatabaseConnectivityError(err) {
  const msg = String(err?.message || err || '');
  return (
    // MongoDB
    msg.includes('MONGODB_URI is not configured') ||
    msg.includes('topology was destroyed') ||
    msg.includes('server selection timeout') ||
    msg.includes('failed to connect to server') ||
    // Common
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ENOTFOUND')
  );
}

/** User-facing copy when DB is down. */
function userFacingDbUnavailableMessage(detailMsg) {
  const m = String(detailMsg || '');
  
  if (m.includes('MONGODB_URI')) {
    return 'Database configuration error: MONGODB_URI is missing or invalid.';
  }

  if (m.includes('server selection timeout') || m.includes('failed to connect to server')) {
    return 'Cannot reach the MongoDB database. Ensure your cluster is active and your IP is whitelisted in MongoDB Atlas (if used).';
  }

  return 'The database is currently unavailable. Please try again in a few minutes.';
}

/**
 * @param {import('express').Response} res
 * @param {Error} err
 * @param {string} fallbackMessage — e.g. "Failed to fetch places"
 */
function sendDbAwareError(res, err, fallbackMessage) {
  const msg = String(err?.message || err || '');
  const down = isDatabaseConnectivityError(err);
  const error = down ? userFacingDbUnavailableMessage(msg) : fallbackMessage;
  return res.status(down ? 503 : 500).json({
    error,
    detail: process.env.NODE_ENV !== 'production' ? msg : undefined,
  });
}

module.exports = {
  isDatabaseConnectivityError,
  sendDbAwareError,
  userFacingDbUnavailableMessage,
};
