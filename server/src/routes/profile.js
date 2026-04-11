const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');
const { getCollection, getMongoDb } = require('../mongo');
const { validatePassword } = require('../utils/passwordValidator');
const { isImageMime, prepareUploadedImage, pickImageExtension } = require('../utils/imageUpload');
const { getMulterFileSizeLimit } = require('../utils/uploadLimits');
const { visitorFollowupsFromDb } = require('../utils/inquiryFollowups');
const { getImageKit } = require('../utils/imagekit');

const router = express.Router();
router.use(authMiddleware);

const MULTER_TMP = path.join(os.tmpdir(), 'visit-multer-uploads');
try {
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
      (m === 'application/octet-stream' && /\.(heic|heif|jpe?g|png|gif|webp)$/i.test(file.originalname || ''));
    cb(ok ? null : new Error('Only image uploads are allowed for profile photos'), ok);
  },
});

async function uploadAvatarWithMetadataFallback(imagekit, uploadPayload) {
  try {
    return await imagekit.upload(uploadPayload);
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    if (!msg.includes('invalid custom metadata')) throw err;
    const { customMetadata: _omit, ...withoutCustomMetadata } = uploadPayload;
    return imagekit.upload(withoutCustomMetadata);
  }
}

function sanitizeProfileInput(body) {
  const out = {};
  if (typeof body.name === 'string') {
    const n = body.name.trim();
    if (n.length <= 150) out.name = n || null;
  }
  if (typeof body.bio === 'string') {
    const b = body.bio.trim();
    if (b.length <= 500) out.profile_bio = b || null;
  }
  if (typeof body.city === 'string') {
    const c = body.city.trim();
    if (c.length <= 100) out.profile_city = c || null;
  }
  if (typeof body.analytics === 'boolean') out.profile_analytics = body.analytics;
  if (typeof body.showTips === 'boolean') out.profile_show_tips = body.showTips;
  return out;
}

router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.userId;
    const usersColl = await getCollection('users');
    const user = await usersColl.findOne({ id: userId });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const placeOwnersColl = await getCollection('place_owners');
    const ownedPlaceCount = await placeOwnersColl.countDocuments({ user_id: userId });
    
    const profile = user.profile || {};
    
    res.json({
      id: user.id,
      name: user.name || (profile.username && profile.username.replace(/^@/, '')) || '',
      username: profile.username || (user.name ? '@' + user.name.toLowerCase().replace(/\s/g, '') : ''),
      email: user.email,
      avatarUrl: user.avatar_url || null,
      avatarPath: user.avatar_url || null,
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
      ownedPlaceCount: ownedPlaceCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const userId = req.user.userId;
    const rawUpdates = req.body || {};
    const updates = sanitizeProfileInput(rawUpdates);
    
    if (Object.keys(updates).length === 0 && !rawUpdates.name) {
       return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setObj = {};
    if (rawUpdates.name !== undefined) setObj.name = rawUpdates.name;
    
    // Using dot notation for embedded profile fields
    if (rawUpdates.bio !== undefined) setObj['profile.bio'] = rawUpdates.bio;
    if (rawUpdates.city !== undefined) setObj['profile.city'] = rawUpdates.city;
    if (rawUpdates.analytics !== undefined) setObj['profile.analytics'] = rawUpdates.analytics;
    if (rawUpdates.showTips !== undefined) setObj['profile.show_tips'] = rawUpdates.showTips;
    setObj['profile.updated_at'] = new Date();

    const usersColl = await getCollection('users');
    await usersColl.updateOne({ id: userId }, { $set: setObj });
    
    const updatedUser = await usersColl.findOne({ id: userId });
    const profile = updatedUser.profile || {};
    const placeOwnersColl = await getCollection('place_owners');
    const ownedPlaceCount = await placeOwnersColl.countDocuments({ user_id: userId });

    res.json({
      id: updatedUser.id,
      name: updatedUser.name || '',
      email: updatedUser.email,
      city: profile.city || '',
      bio: profile.bio || '',
      analytics: profile.analytics ?? true,
      showTips: profile.show_tips ?? true,
      createdAt: updatedUser.created_at,
      isAdmin: updatedUser.is_admin === true,
      isBusinessOwner: updatedUser.is_business_owner === true,
      ownedPlaceCount: ownedPlaceCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/profile/avatar', avatarUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const userId = req.user.userId;

  const imagekit = getImageKit();
  if (!imagekit) {
    return res.status(500).json({
      error: 'ImageKit is not configured. Please set IMAGEKIT_* in server .env (same as place/tour uploads).',
    });
  }

  const storageFolder = '/tripoli-explorer/avatars';
  const multerPath = req.file.path;
  try {
    const buf0 = await fs.promises.readFile(multerPath);
    await fs.promises.unlink(multerPath).catch(() => {});
    const prep = await prepareUploadedImage(buf0, req.file.mimetype, req.file.originalname);
    const safeExt = pickImageExtension(prep.contentType, req.file.originalname, prep.useExtension);
    const finalFileName = `${crypto.randomBytes(16).toString('hex')}${safeExt}`;

    const uploadResponse = await uploadAvatarWithMetadataFallback(imagekit, {
      file: prep.buffer,
      fileName: finalFileName,
      folder: storageFolder,
      useUniqueFileName: false,
      customMetadata: { userId: String(userId) },
    });
    const ikUrl = uploadResponse.url;
    if (!ikUrl) throw new Error('ImageKit returned no url');

    const usersColl = await getCollection('users');
    const user = await usersColl.findOne({ id: userId });
    const prevUrl = user?.avatar_url;

    if (typeof prevUrl === 'string' && prevUrl.startsWith('/uploads/avatars/')) {
      const prevName = prevUrl.replace('/uploads/avatars/', '');
      const localAvatars = path.join(__dirname, '../../uploads/avatars');
      if (prevName && !prevName.includes('..') && !prevName.includes('/') && prevName !== finalFileName) {
        const prevDisk = path.join(localAvatars, prevName);
        await fs.promises.unlink(prevDisk).catch(() => {});
      }
    }

    await usersColl.updateOne({ id: userId }, { $set: { avatar_url: ikUrl } });

    res.json({ avatarUrl: ikUrl, avatarPath: ikUrl });
  } catch (err) {
    await fs.promises.unlink(multerPath).catch(() => {});
    console.error('Profile avatar ImageKit upload error:', err);
    res.status(500).json({ error: err?.message || 'Failed to upload avatar' });
  }
});

router.get('/inquiries', async (req, res) => {
  const userId = req.user.userId;
  try {
    const inquiriesColl = await getCollection('place_inquiries');
    const rows = await inquiriesColl.aggregate([
      { $match: { user_id: userId } },
      { $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place'
      }},
      { $addFields: {
          place_name: { $arrayElemAt: ['$place.name', 0] }
      }},
      { $sort: { created_at: -1 } },
      { $limit: 300 }
    ]).toArray();

    const inquiries = rows.map((r) => ({
      id: r.id || r._id,
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

    const usersColl = await getCollection('users');
    const user = await usersColl.findOne({ id: userId, auth_provider: 'email' });
    
    if (!user || !user.password_hash) return res.status(400).json({ error: 'Password change not available' });
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await usersColl.updateOne({ id: userId }, { $set: { password_hash: hash } });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
