const { getCollection } = require('../mongo');

/**
 * Requires authMiddleware first. Allows access if users.is_admin is true
 * or email is listed in ADMIN_EMAILS (comma-separated, for bootstrap).
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
    const usersColl = await getCollection('users');
    const user = await usersColl.findOne({ id: userId });
    
    if (!user) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const email = (user.email || '').toLowerCase();
    const onAllowList = allowEmails.length > 0 && allowEmails.includes(email);
    
    if (user.is_admin === true || onAllowList) {
      req.admin = { userId: user.id, email: user.email, viaAllowList: onAllowList && user.is_admin !== true };
      return next();
    }
    return res.status(403).json({ error: 'Admin access required. Ask a database admin to set is_admin = true for your account, or add your email to ADMIN_EMAILS in development.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to verify admin access' });
  }
}

module.exports = { adminMiddleware };
