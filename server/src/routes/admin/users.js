const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
const { logAuditEvent } = require('../../utils/audit');
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

  try {
    const usersColl = await getCollection('users');
    const queryObj = {};

    if (q) {
      queryObj.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }

    if (provider === 'google') {
      queryObj.auth_provider = 'google';
    } else if (provider === 'email') {
      queryObj.auth_provider = { $in: [null, '', 'email'] };
    }

    if (isAdmin === 'true') queryObj.is_admin = true;
    else if (isAdmin === 'false') queryObj.is_admin = { $ne: true };

    if (isBusinessOwner === 'true') queryObj.is_business_owner = true;
    else if (isBusinessOwner === 'false') queryObj.is_business_owner = { $ne: true };

    if (emailVerified === 'true') queryObj.email_verified = true;
    else if (emailVerified === 'false') queryObj.email_verified = { $ne: true };

    if (isBlocked === 'true') queryObj.is_blocked = true;
    else if (isBlocked === 'false') queryObj.is_blocked = { $ne: true };

    const total = await usersColl.countDocuments(queryObj);
    const rows = await usersColl.find(queryObj)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

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
      feedUploadBlocked: r.feed_upload_blocked === true,
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
  const { isAdmin, isBusinessOwner, isBlocked, feedUploadBlocked } = req.body || {};
  
  if (typeof isAdmin !== 'boolean' && typeof isBusinessOwner !== 'boolean' && typeof isBlocked !== 'boolean' && typeof feedUploadBlocked !== 'boolean') {
    return res.status(400).json({ error: 'Provide isAdmin, isBusinessOwner, isBlocked, and/or feedUploadBlocked booleans' });
  }
  
  const actorId = req.user.userId;
  if (isBlocked === true && id === actorId) {
    return res.status(400).json({ error: 'You cannot block your own account' });
  }
  if (isAdmin !== undefined && id === actorId) {
    return res.status(400).json({ error: 'You cannot change your own admin role here' });
  }

  try {
    const setObj = {};
    if (typeof isAdmin === 'boolean') setObj.is_admin = isAdmin;
    if (typeof isBusinessOwner === 'boolean') setObj.is_business_owner = isBusinessOwner;
    if (typeof isBlocked === 'boolean') setObj.is_blocked = isBlocked;
    if (typeof feedUploadBlocked === 'boolean') setObj.feed_upload_blocked = feedUploadBlocked;

    const usersColl = await getCollection('users');
    const result = await usersColl.findOneAndUpdate(
      { id: id },
      { $set: setObj },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'User not found' });
    const r = result;
    res.json({
      id: r.id,
      email: r.email,
      name: r.name,
      isAdmin: r.is_admin === true,
      isBusinessOwner: r.is_business_owner === true,
      isBlocked: r.is_blocked === true,
    });

    // Audit log
    const actor = { userId: req.user.userId, email: req.user.email || 'admin', ip: req.ip };
    logAuditEvent('update_user', actor, { targetUserId: id, changes: setObj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/** DELETE /api/admin/users/:id */
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid user id' });
  if (id === req.user.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account from here' });
  }
  try {
    const usersColl = await getCollection('users');
    const result = await usersColl.deleteOne({ id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'User not found' });

    // Audit log
    const actor = { userId: req.user.userId, email: req.user.email || 'admin', ip: req.ip };
    logAuditEvent('delete_user', actor, { targetUserId: id });

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
