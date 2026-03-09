const express = require('express');
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../db');
const { validatePassword } = require('../utils/passwordValidator');

const router = express.Router();
router.use(authMiddleware);

function sanitizeProfileInput(body) {
  const out = {};
  if (typeof body.name === 'string') {
    const n = body.name.trim();
    if (n.length <= 150) out.name = n || null;
  }
  if (typeof body.bio === 'string') {
    const b = body.bio.trim();
    if (b.length <= 500) out.bio = b || null;
  }
  if (typeof body.city === 'string') {
    const c = body.city.trim();
    if (c.length <= 100) out.city = c || null;
  }
  if (typeof body.analytics === 'boolean') out.analytics = body.analytics;
  if (typeof body.showTips === 'boolean') out.showTips = body.showTips;
  return out;
}

router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.userId;
    const userResult = await query('SELECT id, email, name, avatar_url, created_at FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];
    const profileResult = await query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
    const profile = profileResult.rows[0] || {};
    const baseUrl = (req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http')) + '://' + (req.get('x-forwarded-host') || req.get('host') || 'localhost:' + (process.env.PORT || 3000));
    const avatarUrl = user.avatar_url && !user.avatar_url.startsWith('http') ? baseUrl + user.avatar_url : (user.avatar_url || null);
    res.json({
      id: user.id,
      name: user.name || (profile.username && profile.username.replace(/^@/, '')) || '',
      username: profile.username || (user.name ? '@' + user.name.toLowerCase().replace(/\s/g, '') : ''),
      email: user.email,
      avatarUrl: avatarUrl || null,
      city: profile.city || '',
      bio: profile.bio || '',
      mood: profile.mood || 'mixed',
      pace: profile.pace || 'normal',
      analytics: profile.analytics ?? true,
      showTips: profile.show_tips ?? true,
      appRating: profile.app_rating ?? 0,
      onboardingCompleted: profile.onboarding_completed === true,
      createdAt: user.created_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const userId = req.user.userId;
    const updates = sanitizeProfileInput(req.body || {});
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    if (updates.name !== undefined) {
      await query('UPDATE users SET name = $1 WHERE id = $2', [updates.name, userId]);
    }
    if (updates.bio !== undefined || updates.city !== undefined || updates.analytics !== undefined || updates.showTips !== undefined) {
      const existing = await query('SELECT bio, city, analytics, show_tips FROM profiles WHERE user_id = $1', [userId]);
      const row = existing.rows[0];
      const bio = updates.bio !== undefined ? updates.bio : (row?.bio ?? null);
      const city = updates.city !== undefined ? updates.city : (row?.city ?? null);
      const analytics = updates.analytics !== undefined ? updates.analytics : (row?.analytics ?? true);
      const showTips = updates.showTips !== undefined ? updates.showTips : (row?.show_tips ?? true);
      if (row) {
        await query('UPDATE profiles SET bio = $1, city = $2, analytics = $3, show_tips = $4 WHERE user_id = $5', [bio, city, analytics, showTips, userId]);
      } else {
        await query('INSERT INTO profiles (user_id, bio, city, analytics, show_tips) VALUES ($1, $2, $3, $4, $5)', [userId, bio, city, analytics, showTips]);
      }
    }
    const userResult = await query('SELECT id, email, name, created_at FROM users WHERE id = $1', [userId]);
    const profileResult = await query('SELECT bio, city, analytics, show_tips FROM profiles WHERE user_id = $1', [userId]);
    const user = userResult.rows[0];
    const profile = profileResult.rows[0] || {};
    res.json({
      id: user.id,
      name: user.name || '',
      email: user.email,
      city: profile.city || '',
      bio: profile.bio || '',
      analytics: profile.analytics ?? true,
      showTips: profile.show_tips ?? true,
      createdAt: user.created_at
    });
  } catch (err) {
    if (err.code === '42P01') return res.status(400).json({ error: 'Profile table not configured' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/change-password', async (req, res) => {
  try {
    const userId = req.user.userId;
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current password and new password required' });

    const pv = validatePassword(newPassword);
    if (!pv.valid) return res.status(400).json({ error: pv.error });

    const row = await query('SELECT password_hash FROM users WHERE id = $1 AND auth_provider = \'email\'', [userId]);
    if (row.rows.length === 0 || !row.rows[0].password_hash) return res.status(400).json({ error: 'Password change not available for this account' });
    const match = await bcrypt.compare(currentPassword, row.rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
