const { query: dbQuery } = require('../db');

/**
 * Requires authMiddleware first. Allows access if users.is_admin is true
 * or email is listed in ADMIN_EMAILS (comma-separated, for bootstrap).
 * Same DB as the mobile app — grant admin in Supabase: UPDATE users SET is_admin = true WHERE email = '...';
 */
async function adminMiddleware(req, res, next) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const allowEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  try {
    const { rows } = await dbQuery(
      'SELECT id, email, COALESCE(is_admin, false) AS is_admin FROM users WHERE id = $1',
      [userId]
    );
    const row = rows[0];
    if (!row) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const email = (row.email || '').toLowerCase();
    const onAllowList = allowEmails.length > 0 && allowEmails.includes(email);
    if (row.is_admin === true || onAllowList) {
      req.admin = { userId: row.id, email: row.email, viaAllowList: onAllowList && row.is_admin !== true };
      return next();
    }
    return res.status(403).json({ error: 'Admin access required. Ask a database admin to set is_admin = true for your account, or add your email to ADMIN_EMAILS in development.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to verify admin access' });
  }
}

module.exports = { adminMiddleware };
