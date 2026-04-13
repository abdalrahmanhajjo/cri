const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { authMiddleware } = require('../middleware/auth');
const { getCollection } = require('../mongo');
const { parsePlaceId, safeUrl } = require('../utils/validate');
const { feedImagesForStorage } = require('../utils/feedImageUrls');
const { normalizeFeedEnhancements } = require('../utils/feedPostPayload');
const { canManageFeedPost, loadFeedPostById } = require('../utils/feedPostAccess');
const {
  isLikelyVideoUpload,
  multerFileAllowed,
  prepareUploadedImage,
  pickImageExtension,
  VIDEO_MIME_TO_EXT,
} = require('../utils/imageUpload');
const { getMulterFileSizeLimit } = require('../utils/uploadLimits');
const { prepareFeedVideoDiskPath } = require('../utils/feedVideoUploadPrepare');
const { getImageKit, uploadImageKitWithMetadataFallback } = require('../utils/imagekit');

const router = express.Router();
router.use(authMiddleware);

const MULTER_TMP = path.join(os.tmpdir(), 'visit-multer-user-feed');
try {
  if (!fs.existsSync(MULTER_TMP)) fs.mkdirSync(MULTER_TMP, { recursive: true });
} catch (_) {}

const multerFileLimits = getMulterFileSizeLimit();
const uploadMw = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, MULTER_TMP),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '';
      cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
    },
  }),
  ...(multerFileLimits ? { limits: multerFileLimits } : {}),
  fileFilter: (req, file, cb) => {
    const ok = multerFileAllowed(file);
    cb(
      ok
        ? null
        : new Error(
            'Only images (JPEG, PNG, GIF, WebP, HEIC/HEIF — HEIC is saved as JPEG) or videos (MP4, WebM, MOV) allowed'
          ),
      ok
    );
  },
});

async function assertCanLinkPostToPlace(userId, placeId) {
  const placesColl = await getCollection('places');
  const place = await placesColl.findOne({ id: placeId });
  if (!place) return { ok: false, status: 404, error: 'Place not found' };
  if (place.feed_linking_disabled === true) {
    return { ok: false, status: 403, error: 'Post/reel linking is disabled for this place' };
  }
  const poColl = await getCollection('place_owners');
  const own = await poColl.findOne({ user_id: userId, place_id: placeId });
  if (place.feed_linking_restricted_to_owner === true && !own) {
    return { ok: false, status: 403, error: 'Only verified business owners can link posts/reels to this place' };
  }
  return { ok: true, place, own: !!own };
}

/** GET /api/user/feed/places?q= — search places to link (min 2 chars). */
router.get('/places', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) return res.json({ places: [] });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 40);
  try {
    const placesColl = await getCollection('places');
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(esc, 'i');
    const rows = await placesColl
      .find({
        $or: [{ id: q }, { name: regex }, { search_name: regex }],
      })
      .project({
        id: 1,
        name: 1,
        location: 1,
        feed_linking_disabled: 1,
        feed_linking_restricted_to_owner: 1,
      })
      .limit(limit)
      .toArray();
    res.json({
      places: rows.map((p) => ({
        id: p.id,
        name: p.name || '',
        location: p.location || '',
        feedLinkingDisabled: p.feed_linking_disabled === true,
        feedLinkingRestrictedToOwner: p.feed_linking_restricted_to_owner === true,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

/** POST /api/user/feed/upload — FormData: file, placeId (required). */
router.post('/upload', uploadMw.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const imagekit = getImageKit();
  if (!imagekit) return res.status(500).json({ error: 'ImageKit configuration missing' });

  const parsed = parsePlaceId(req.body?.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'placeId is required' });
  const placeId = parsed.value;

  try {
    const usersColl = await getCollection('users');
    const user = await usersColl.findOne({ id: req.user.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.feed_upload_blocked === true && user.is_admin !== true) {
      return res.status(403).json({ error: 'Your account is blocked from uploading posts/reels' });
    }

    const link = await assertCanLinkPostToPlace(req.user.userId, placeId);
    if (!link.ok) return res.status(link.status).json({ error: link.error });

    const multerPath = req.file.path;
    let finalFileName;
    let storageFolder = '/tripoli-explorer/business';

    try {
      if (isLikelyVideoUpload(req.file)) {
        const rawExt = path.extname(req.file.originalname) || '';
        const ext = (rawExt.startsWith('.') ? rawExt : rawExt ? `.${rawExt}` : '').toLowerCase();
        const fromMime = VIDEO_MIME_TO_EXT[(req.file.mimetype || '').toLowerCase()] || '.mp4';
        const safeExt = /^\.(mp4|webm|mov|m4v|3gp|3g2|mkv)$/i.test(ext) ? ext : fromMime;

        const prep = await prepareFeedVideoDiskPath(multerPath, safeExt, req.file);
        finalFileName = `${crypto.randomBytes(16).toString('hex')}${prep.safeExt || safeExt}`;
        storageFolder = '/tripoli-explorer/videos';

        const uploadResponse = await uploadImageKitWithMetadataFallback(imagekit, {
          file: fs.createReadStream(prep.diskPath),
          fileName: finalFileName,
          folder: storageFolder,
          useUniqueFileName: false,
          customMetadata: { placeId: placeId.toString(), uploadedBy: req.user.userId, source: 'user_feed' },
        });

        if (prep.cleanupPath) await fs.promises.unlink(prep.cleanupPath).catch(() => {});
        if (prep.transcoderCleanup) await prep.transcoderCleanup().catch(() => {});

        return res.json({ url: uploadResponse.url });
      }

      const uploadBuffer = await fs.promises.readFile(multerPath);
      await fs.promises.unlink(multerPath).catch(() => {});

      const prep = await prepareUploadedImage(uploadBuffer, req.file.mimetype, req.file.originalname);
      const safeExt = pickImageExtension(prep.contentType, req.file.originalname, prep.useExtension);
      finalFileName = `${crypto.randomBytes(16).toString('hex')}${safeExt}`;

      const uploadResponse = await uploadImageKitWithMetadataFallback(imagekit, {
        file: prep.buffer,
        fileName: finalFileName,
        folder: storageFolder,
        useUniqueFileName: false,
        customMetadata: { placeId: placeId.toString(), uploadedBy: req.user.userId, source: 'user_feed' },
      });

      return res.json({ url: uploadResponse.url });
    } catch (err) {
      console.error('ImageKit user feed upload error:', err);
      if (fs.existsSync(multerPath)) await fs.promises.unlink(multerPath).catch(() => {});
      return res.status(500).json({ error: err?.message || 'Storage upload failed' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * POST /api/user/feed
 * Any signed-in user: post/reel must include placeId. Community posts may require moderation.
 */
router.post('/', async (req, res) => {
  const userId = req.user.userId;
  const pid = parsePlaceId(req.body?.placeId);
  if (!pid.valid) return res.status(400).json({ error: 'placeId is required — every post/reel must be linked to a place' });

  const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim() : '';
  if (!caption || caption.length > 8000) {
    return res.status(400).json({ error: 'caption is required (max 8000 characters)' });
  }

  const { image_url: imageUrl, image_urls: imageUrlsArr } = feedImagesForStorage(req.body || {});
  const videoUrl = safeUrl(req.body?.video_url) || null;
  const rawType = typeof req.body?.type === 'string' ? req.body.type.trim().toLowerCase() : 'post';
  const type = rawType === 'reel' || rawType === 'video' ? 'video' : 'post';
  if (type === 'video' && !videoUrl) {
    return res.status(400).json({ error: 'Video posts require a valid video URL' });
  }
  const hasImage = Boolean(imageUrl || (Array.isArray(imageUrlsArr) && imageUrlsArr.length));
  if (type !== 'video' && !hasImage) {
    return res.status(400).json({ error: 'Add at least one image for this post' });
  }

  try {
    const usersColl = await getCollection('users');
    const user = await usersColl.findOne({ id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.feed_upload_blocked === true && user.is_admin !== true) {
      return res.status(403).json({ error: 'Your account is blocked from uploading posts/reels' });
    }

    const link = await assertCanLinkPostToPlace(userId, pid.value);
    if (!link.ok) return res.status(link.status).json({ error: link.error });

    const isOwnerPosting = link.own === true;
    const moderation_status = isOwnerPosting ? 'approved' : 'pending';
    const discoverable = isOwnerPosting ? true : false;
    const author_verified = isOwnerPosting === true;
    const author_role = isOwnerPosting ? 'business_owner' : 'community';

    const authorName = (user?.name && String(user.name).trim()) || (user?.email && String(user.email).split('@')[0]) || 'Member';
    const authorShort = authorName.slice(0, 255);

    const id = crypto.randomUUID();
    const postsColl = await getCollection('feed_posts');
    const enhancements = normalizeFeedEnhancements(req.body || {});
    const newPost = {
      id,
      user_id: userId,
      author_name: authorShort,
      place_id: pid.value,
      caption,
      image_url: imageUrl,
      image_urls: imageUrlsArr || [],
      video_url: videoUrl,
      type,
      author_role,
      author_verified,
      moderation_status,
      discoverable,
      ...enhancements,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await postsColl.insertOne(newPost);
    res.status(201).json({ post: newPost });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

function buildFeedUpdateSet(body) {
  const setObj = {};
  if (body.caption !== undefined) {
    const cap = String(body.caption).trim();
    if (!cap || cap.length > 8000) return { error: 'Invalid caption' };
    setObj.caption = cap;
  }

  const hasImageUrls = Object.prototype.hasOwnProperty.call(body, 'image_urls');
  const hasImageUrl = Object.prototype.hasOwnProperty.call(body, 'image_url');
  if (hasImageUrls || hasImageUrl) {
    const { image_url: nextFirst, image_urls: nextList } = feedImagesForStorage({
      image_url: hasImageUrl ? body.image_url : undefined,
      image_urls: hasImageUrls ? body.image_urls : undefined,
    });
    setObj.image_url = nextFirst;
    setObj.image_urls = nextList || [];
  }
  if (body.video_url !== undefined) {
    setObj.video_url = body.video_url ? safeUrl(body.video_url) : null;
  }
  if (body.type !== undefined) {
    const raw = String(body.type).trim().toLowerCase();
    setObj.type = raw === 'reel' || raw === 'video' ? 'video' : 'post';
  }
  if (body.hide_likes !== undefined) setObj.hide_likes = Boolean(body.hide_likes);
  if (body.comments_disabled !== undefined) setObj.comments_disabled = Boolean(body.comments_disabled);
  Object.assign(setObj, normalizeFeedEnhancements(body));
  return { setObj };
}

/** PATCH /api/user/feed/:id — author, place owner, or admin */
router.patch('/:id', async (req, res) => {
  const userId = req.user.userId;
  const existing = await loadFeedPostById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });
  if (!(await canManageFeedPost(userId, existing))) {
    return res.status(404).json({ error: 'Post not found' });
  }

  let actor;
  try {
    const usersColl = await getCollection('users');
    actor = await usersColl.findOne({ id: userId }, { projection: { feed_upload_blocked: 1, is_admin: 1 } });
    if (actor?.feed_upload_blocked === true && actor?.is_admin !== true) {
      return res.status(403).json({ error: 'Your account is blocked from uploading posts/reels' });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to verify user' });
  }

  const body = req.body || {};
  const setObj = {};

  if (body.placeId !== undefined || body.place_id !== undefined) {
    const pid = parsePlaceId(body.placeId ?? body.place_id);
    if (!pid.valid) return res.status(400).json({ error: 'Invalid placeId' });
    if (pid.value !== existing.place_id) {
      if (actor?.is_admin !== true) {
        const link = await assertCanLinkPostToPlace(userId, pid.value);
        if (!link.ok) return res.status(link.status).json({ error: link.error });
      }
      setObj.place_id = pid.value;
    }
  }

  const built = buildFeedUpdateSet(body);
  if (built.error) return res.status(400).json({ error: built.error });
  Object.assign(setObj, built.setObj);

  if (Object.keys(setObj).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  setObj.updated_at = new Date();

  try {
    const postsColl = await getCollection('feed_posts');
    await postsColl.updateOne({ id: req.params.id }, { $set: setObj });
    const post = await postsColl.findOne({ id: req.params.id });
    res.json({ post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

/** DELETE /api/user/feed/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.user.userId;
  const existing = await loadFeedPostById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });
  if (!(await canManageFeedPost(userId, existing))) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const id = req.params.id;
  try {
    const postsColl = await getCollection('feed_posts');
    const commentsColl = await getCollection('feed_comments');
    const likesColl = await getCollection('feed_likes');
    const savesColl = await getCollection('feed_saves');

    await commentsColl.deleteMany({ post_id: id });
    await likesColl.deleteMany({ post_id: id });
    await savesColl.deleteMany({ post_id: id });
    await postsColl.deleteOne({ id: id });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
