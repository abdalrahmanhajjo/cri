/**
 * Map pg / pool errors to HTTP responses so public routes stay consistent.
 */
function isDatabaseConnectivityError(err) {
  const msg = String(err?.message || err || '');
  return (
    err?.code === 'XX000' ||
    msg.includes('Circuit breaker') ||
    msg.includes('Failed to retrieve database credentials') ||
    msg.includes('Unable to establish connection to upstream') ||
    msg.includes('upstream database') ||
    msg.includes('Connection terminated') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ENOTFOUND')
  );
}

/** User-facing copy when DB is down (avoids blaming auth when upstream Postgres is unreachable). */
function userFacingDbUnavailableMessage(detailMsg) {
  const m = String(detailMsg || '');
  if (m.includes('ENOTFOUND') && m.includes('db.') && m.includes('supabase.co')) {
    return (
      'DNS could not resolve the Supabase Direct host (db.*.supabase.co). Use the Session pooler URI in server/.env instead (Project Settings → Database), or fix DNS / IPv6 on your network.'
    );
  }
  if (
    m.includes('Unable to establish connection to upstream') ||
    m.includes('upstream database')
  ) {
    return (
      'Database unavailable: Supabase could not reach Postgres (upstream). If the project was paused, open the dashboard and Restore, then wait 2–5 minutes. ' +
      'Try the other connection mode in Project Settings → Database (Session pooler vs Direct). Check https://status.supabase.com for incidents.'
    );
  }
  return (
    'Cannot reach the database. In Supabase: ensure the project is active (not paused), then set DATABASE_URL in server/.env to the Direct or Session pooler URI from Project Settings → Database (password URL-encoded).'
  );
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
