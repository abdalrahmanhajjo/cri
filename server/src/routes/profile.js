const express = require('express');
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../middleware/auth');
const { query: dbQuery } = require('../db');
const { validatePassword } = require('../utils/passwordValidator');
const { validate } = require('../middleware/validation');
const { updateProfileSchema, updateAccountSchema } = require('../schemas/profile');

const router = express.Router();
router.use(authMiddleware);
const { visitorFollowupsFromDb } = require('../utils/inquiryFollowups');



router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.userId;
    const userResult = await dbQuery(
      `SELECT u.id, u.email, u.name, u.avatar_url, u.created_at,
              COALESCE(u.is_admin, false) AS is_admin,
              COALESCE(u.is_business_owner, false) AS is_business_owner,
              (SELECT COUNT(*)::int FROM place_owners po WHERE po.user_id = u.id) AS owned_place_count
       FROM users u WHERE u.id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];
    const profileResult = await dbQuery('SELECT * FROM profiles WHERE user_id = $1', [userId]);
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
      createdAt: user.created_at,
      isAdmin: user.is_admin === true,
      isBusinessOwner: user.is_business_owner === true,
      ownedPlaceCount: user.owned_place_count ?? 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/profile', validate(updateProfileSchema), async (req, res) => {
  try {
    const userId = req.user.userId;
    const updates = req.body;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    if (updates.name !== undefined) {
      await dbQuery('UPDATE users SET name = $1 WHERE id = $2', [updates.name, userId]);
    }
    if (updates.bio !== undefined || updates.city !== undefined || updates.analytics !== undefined || updates.showTips !== undefined) {
      const existing = await dbQuery('SELECT bio, city, analytics, show_tips FROM profiles WHERE user_id = $1', [userId]);
      const row = existing.rows[0];
      const bio = updates.bio !== undefined ? updates.bio : (row?.bio ?? null);
      const city = updates.city !== undefined ? updates.city : (row?.city ?? null);
      const analytics = updates.analytics !== undefined ? updates.analytics : (row?.analytics ?? true);
      const showTips = updates.showTips !== undefined ? updates.showTips : (row?.show_tips ?? true);
      if (row) {
        await dbQuery('UPDATE profiles SET bio = $1, city = $2, analytics = $3, show_tips = $4 WHERE user_id = $5', [bio, city, analytics, showTips, userId]);
      } else {
        await dbQuery('INSERT INTO profiles (user_id, bio, city, analytics, show_tips) VALUES ($1, $2, $3, $4, $5)', [userId, bio, city, analytics, showTips]);
      }
    }
    const userResult = await dbQuery(
      `SELECT u.id, u.email, u.name, u.created_at,
              COALESCE(u.is_admin, false) AS is_admin,
              COALESCE(u.is_business_owner, false) AS is_business_owner,
              (SELECT COUNT(*)::int FROM place_owners po WHERE po.user_id = u.id) AS owned_place_count
       FROM users u WHERE u.id = $1`,
      [userId]
    );
    const profileResult = await dbQuery('SELECT bio, city, analytics, show_tips FROM profiles WHERE user_id = $1', [userId]);
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
      createdAt: user.created_at,
      isAdmin: user.is_admin === true,
      isBusinessOwner: user.is_business_owner === true,
      ownedPlaceCount: user.owned_place_count ?? 0,
    });
  } catch (err) {
    if (err.code === '42P01') return res.status(400).json({ error: 'Profile table not configured' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/** Logged-in visitors: all place inquiry threads they started (user_id set on send). */
router.get('/inquiries', async (req, res) => {
  const userId = req.user.userId;
  try {
    let rows;
    try {
      ({ rows } = await dbQuery(
        `SELECT i.id, i.place_id, i.message, i.status, i.response, i.responded_at, i.created_at,
                p.name AS place_name,
                COALESCE(i.visitor_followups, '[]'::jsonb) AS visitor_followups
         FROM place_inquiries i
         INNER JOIN places p ON p.id = i.place_id
         WHERE i.user_id = $1
         ORDER BY i.created_at DESC
         LIMIT 300`,
        [userId]
      ));
    } catch (e) {
      if (e.code === '42703' && String(e.message || '').includes('visitor_followups')) {
        ({ rows } = await dbQuery(
          `SELECT i.id, i.place_id, i.message, i.status, i.response, i.responded_at, i.created_at,
                  p.name AS place_name
           FROM place_inquiries i
           INNER JOIN places p ON p.id = i.place_id
           WHERE i.user_id = $1
           ORDER BY i.created_at DESC
           LIMIT 300`,
          [userId]
        ));
      } else {
        throw e;
      }
    }
    const inquiries = rows.map((r) => ({
      id: r.id,
      placeId: r.place_id,
      placeName: r.place_name || String(r.place_id),
      message: r.message || '',
      status: r.status,
      response: r.response || null,
      respondedAt: r.responded_at || null,
      createdAt: r.created_at,
      visitorFollowups: visitorFollowupsFromDb(r.visitor_followups),
    }));
    res.json({ inquiries });
  } catch (err) {
    if (err.code === '42P01') {
      return res.json({ inquiries: [] });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

router.post('/change-password', validate(updateAccountSchema), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    const pv = validatePassword(newPassword);
    if (!pv.valid) return res.status(400).json({ error: pv.error });

    const row = await dbQuery('SELECT password_hash FROM users WHERE id = $1 AND auth_provider = \'email\'', [userId]);
    if (row.rows.length === 0 || !row.rows[0].password_hash) return res.status(400).json({ error: 'Password change not available for this account' });
    const match = await bcrypt.compare(currentPassword, row.rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await dbQuery('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
