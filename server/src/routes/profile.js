const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../db');
const { validatePassword } = require('../utils/passwordValidator');
const { isImageMime, prepareUploadedImage, pickImageExtension } = require('../utils/imageUpload');
const { getMulterFileSizeLimit } = require('../utils/uploadLimits');

const router = express.Router();
router.use(authMiddleware);
const { visitorFollowupsFromDb } = require('../utils/inquiryFollowups');

const LOCAL_AVATARS = path.join(__dirname, '../../uploads/avatars');
const MULTER_TMP = path.join(os.tmpdir(), 'visit-multer-uploads');
try {
  fs.mkdirSync(LOCAL_AVATARS, { recursive: true });
  fs.mkdirSync(MULTER_TMP, { recursive: true });
} catch (_) {}

const multerFileLimits = getMulterFileSizeLimit();
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, MULTER_TMP),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '';
      cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
    },
  }),
  ...(multerFileLimits ? { limits: multerFileLimits } : {}),
  fileFilter: (req, file, cb) => {
    const m = (file.mimetype || '').toLowerCase();
    const ok =
      isImageMime(m) ||
      // iOS sometimes sends HEIC as octet-stream; imageUpload.prepareUploadedImage handles conversion
      (m === 'application/octet-stream' && /\.(heic|heif|jpe?g|png|gif|webp)$/i.test(file.originalname || ''));
    cb(ok ? null : new Error('Only image uploads are allowed for profile photos'), ok);
  },
});

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
    const userResult = await query(
      `SELECT u.id, u.email, u.name, u.avatar_url, u.created_at,
              COALESCE(u.is_admin, false) AS is_admin,
              COALESCE(u.is_business_owner, false) AS is_business_owner,
              (SELECT COUNT(*)::int FROM place_owners po WHERE po.user_id = u.id) AS owned_place_count
       FROM users u WHERE u.id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];
    const profileResult = await query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
    const profile = profileResult.rows[0] || {};
    const avatarPath = user.avatar_url || null;
    // Return a relative URL for local uploads (works with Vite proxy in dev and with getImageUrl() on the client).
    const avatarUrl =
      typeof avatarPath === 'string' && avatarPath.startsWith('http') ? avatarPath : avatarPath;
    res.json({
      id: user.id,
      name: user.name || (profile.username && profile.username.replace(/^@/, '')) || '',
      username: profile.username || (user.name ? '@' + user.name.toLowerCase().replace(/\s/g, '') : ''),
      email: user.email,
      avatarUrl: avatarUrl || null,
      avatarPath: avatarPath || null,
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
    const userResult = await query(
      `SELECT u.id, u.email, u.name, u.created_at,
              COALESCE(u.is_admin, false) AS is_admin,
              COALESCE(u.is_business_owner, false) AS is_business_owner,
              (SELECT COUNT(*)::int FROM place_owners po WHERE po.user_id = u.id) AS owned_place_count
       FROM users u WHERE u.id = $1`,
      [userId]
    );
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

/** POST /api/user/profile/avatar — upload and set profile photo */
router.post('/profile/avatar', avatarUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const userId = req.user.userId;

  const multerPath = req.file.path;
  try {
    const buf0 = await fs.promises.readFile(multerPath);
    await fs.promises.unlink(multerPath).catch(() => {});
    const prep = await prepareUploadedImage(buf0, req.file.mimetype, req.file.originalname);
    const ext = pickImageExtension(prep.contentType, req.file.originalname, prep.useExtension);
    const fileName = `${crypto.randomBytes(18).toString('hex')}${ext}`;
    const diskPath = path.join(LOCAL_AVATARS, fileName);
    await fs.promises.writeFile(diskPath, prep.buffer);

    // Best-effort: cleanup old avatar when it is a local /uploads/avatars path.
    try {
      const prev = await query('SELECT avatar_url FROM users WHERE id = $1', [userId]);
      const prevUrl = prev.rows[0]?.avatar_url;
      if (typeof prevUrl === 'string' && prevUrl.startsWith('/uploads/avatars/')) {
        const prevName = prevUrl.replace('/uploads/avatars/', '');
        if (prevName && !prevName.includes('..') && !prevName.includes('/') && prevName !== fileName) {
          const prevDisk = path.join(LOCAL_AVATARS, prevName);
          await fs.promises.unlink(prevDisk).catch(() => {});
        }
      }
    } catch (_) {}

    const relativeUrl = `/uploads/avatars/${fileName}`;
    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [relativeUrl, userId]);

    // Keep it relative; the web client resolves with getImageUrl() (and Vite proxies /uploads in dev).
    res.json({ avatarUrl: relativeUrl, avatarPath: relativeUrl });
  } catch (err) {
    await fs.promises.unlink(multerPath).catch(() => {});
    if (err.code === 'HEIC_CONVERT_FAILED') return res.status(422).json({ error: err.message });
    if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

/** Logged-in visitors: all place inquiry threads they started (user_id set on send). */
router.get('/inquiries', async (req, res) => {
  const userId = req.user.userId;
  try {
    let rows;
    try {
      ({ rows } = await query(
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
        ({ rows } = await query(
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
