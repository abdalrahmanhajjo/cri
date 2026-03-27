const express = require('express');
const { query } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET /api/admin/users ?q &provider &isAdmin &isBusinessOwner &emailVerified &isBlocked */
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const provider = String(req.query.provider || 'all').toLowerCase();
  const isAdmin = String(req.query.isAdmin || 'all').toLowerCase();
  const isBusinessOwner = String(req.query.isBusinessOwner || 'all').toLowerCase();
  const emailVerified = String(req.query.emailVerified || 'all').toLowerCase();
  const isBlocked = String(req.query.isBlocked || 'all').toLowerCase();

  const where = [];
  const params = [];

  if (q) {
    const idx = params.length + 1;
    where.push(`(COALESCE(name, '') ILIKE $${idx} OR email ILIKE $${idx})`);
    params.push(`%${q}%`);
  }
  if (provider === 'google') {
    where.push('auth_provider = \'google\'');
  } else if (provider === 'email') {
    where.push('(auth_provider IS NULL OR auth_provider = \'\' OR auth_provider = \'email\')');
  }
  if (isAdmin === 'true') {
    where.push('COALESCE(is_admin, false) = true');
  } else if (isAdmin === 'false') {
    where.push('COALESCE(is_admin, false) = false');
  }
  if (isBusinessOwner === 'true') {
    where.push('COALESCE(is_business_owner, false) = true');
  } else if (isBusinessOwner === 'false') {
    where.push('COALESCE(is_business_owner, false) = false');
  }
  if (emailVerified === 'true') {
    where.push('email_verified = true');
  } else if (emailVerified === 'false') {
    where.push('(email_verified IS NOT TRUE)');
  }
  if (isBlocked === 'true') {
    where.push('COALESCE(is_blocked, false) = true');
  } else if (isBlocked === 'false') {
    where.push('COALESCE(is_blocked, false) = false');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limIdx = params.length + 1;
  const offIdx = params.length + 2;
  try {
    const { rows } = await query(
      `SELECT id, email, name, created_at, auth_provider, email_verified, phone_verified,
              COALESCE(is_admin, false) AS is_admin, COALESCE(is_business_owner, false) AS is_business_owner,
              COALESCE(is_blocked, false) AS is_blocked
       FROM users
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${limIdx} OFFSET $${offIdx}`,
      [...params, limit, offset]
    );
    const countRes = await query(`SELECT COUNT(*)::int AS c FROM users ${whereSql}`, params);
    const total = countRes.rows[0]?.c ?? 0;
    res.json({
      users: rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        createdAt: r.created_at,
        authProvider: r.auth_provider,
        emailVerified: r.email_verified === true,
        phoneVerified: r.phone_verified === true,
        isAdmin: r.is_admin === true,
        isBusinessOwner: r.is_business_owner === true,
        isBlocked: r.is_blocked === true,
      })),
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/** PATCH /api/admin/users/:id — roles + block flag */
router.patch('/:id', async (req, res) => {
  const id = req.params.id;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid user id' });
  const { isAdmin, isBusinessOwner, isBlocked } = req.body || {};
  const hasField =
    typeof isAdmin === 'boolean' ||
    typeof isBusinessOwner === 'boolean' ||
    typeof isBlocked === 'boolean';
  if (!hasField) {
    return res.status(400).json({ error: 'Provide isAdmin, isBusinessOwner, and/or isBlocked booleans' });
  }
  const actorId = req.user.userId;
  if (typeof isBlocked === 'boolean' && isBlocked === true && id === actorId) {
    return res.status(400).json({ error: 'You cannot block your own account' });
  }
  if (typeof isAdmin === 'boolean' && id === actorId) {
    return res.status(400).json({ error: 'You cannot change your own admin role here' });
  }
  try {
    const updates = [];
    const vals = [];
    let p = 1;
    if (typeof isAdmin === 'boolean') {
      updates.push(`is_admin = $${p++}`);
      vals.push(isAdmin);
    }
    if (typeof isBusinessOwner === 'boolean') {
      updates.push(`is_business_owner = $${p++}`);
      vals.push(isBusinessOwner);
    }
    if (typeof isBlocked === 'boolean') {
      updates.push(`is_blocked = $${p++}`);
      vals.push(isBlocked);
    }
    vals.push(id);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${p} RETURNING id, email, name, is_admin, is_business_owner, COALESCE(is_blocked, false) AS is_blocked`,
      vals
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const r = result.rows[0];
    res.json({
      id: r.id,
      email: r.email,
      name: r.name,
      isAdmin: r.is_admin === true,
      isBusinessOwner: r.is_business_owner === true,
      isBlocked: r.is_blocked === true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/** DELETE /api/admin/users/:id — remove account (fails if FKs prevent it) */
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid user id' });
  if (id === req.user.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account from here' });
  }
  try {
    const result = await query('DELETE FROM users WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error:
          'Cannot delete this user while related data exists (trips, favourites, feed posts, etc.). Remove or reassign those records first.',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
