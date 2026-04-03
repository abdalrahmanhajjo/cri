const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const crypto = require('crypto');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

function clampInt(n, lo, hi, fallback) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return fallback;
  return Math.max(lo, Math.min(hi, x));
}

function normalizeSurface(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'home' || s === 'discover' || s === 'feed' || s === 'dining' || s === 'hotels' || s === 'all')
    return s;
  return 'all';
}

function parseMaybeDate(raw) {
  if (raw == null || raw === '') return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function sanitizeInput(body) {
  const b = body && typeof body === 'object' ? body : {};
  const out = {};
  if (b.placeId != null) out.placeId = String(b.placeId).trim();
  if (b.surface != null) out.surface = normalizeSurface(b.surface);
  if (b.rank != null) out.rank = clampInt(b.rank, -999999, 999999, 0);
  if (b.enabled != null) out.enabled = Boolean(b.enabled);
  if (b.startsAt !== undefined || b.starts_at !== undefined) out.startsAt = parseMaybeDate(b.startsAt ?? b.starts_at);
  if (b.endsAt !== undefined || b.ends_at !== undefined) out.endsAt = parseMaybeDate(b.endsAt ?? b.ends_at);
  if (b.badgeText !== undefined || b.badge_text !== undefined)
    out.badgeText = (b.badgeText ?? b.badge_text) == null ? null : String(b.badgeText ?? b.badge_text).trim().slice(0, 64);
  if (b.titleOverride !== undefined || b.title_override !== undefined)
    out.titleOverride = (b.titleOverride ?? b.title_override) == null ? null : String(b.titleOverride ?? b.title_override).trim().slice(0, 140);
  if (b.subtitleOverride !== undefined || b.subtitle_override !== undefined)
    out.subtitleOverride = (b.subtitleOverride ?? b.subtitle_override) == null ? null : String(b.subtitleOverride ?? b.subtitle_override).trim().slice(0, 220);
  if (b.imageOverrideUrl !== undefined || b.image_override_url !== undefined)
    out.imageOverrideUrl = (b.imageOverrideUrl ?? b.image_override_url) == null ? null : String(b.imageOverrideUrl ?? b.image_override_url).trim().slice(0, 800);
  if (b.ctaUrl !== undefined || b.cta_url !== undefined)
    out.ctaUrl = (b.ctaUrl ?? b.cta_url) == null ? null : String(b.ctaUrl ?? b.cta_url).trim().slice(0, 800);
  return out;
}

/** GET /api/admin/sponsored-places */
router.get('/', async (req, res) => {
  try {
    const spColl = await getCollection('sponsored_places');
    const items = await spColl.aggregate([
      { $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place'
      }},
      { $unwind: '$place' },
      { $lookup: {
          from: 'sponsorship_purchases',
          localField: 'purchase_id',
          foreignField: 'id',
          as: 'purchase'
      }},
      { $addFields: {
          purchaseObj: { $arrayElemAt: ['$purchase', 0] }
      }},
      { $sort: { rank: 1, created_at: -1 } }
    ]).toArray();

    const result = items.map((r) => ({
      id: String(r.id || r._id),
      placeId: String(r.place_id),
      surface: r.surface || 'all',
      rank: Number(r.rank) || 0,
      enabled: r.enabled === true,
      startsAt: r.starts_at || null,
      endsAt: r.ends_at || null,
      badgeText: r.badge_text || null,
      titleOverride: r.title_override || null,
      subtitleOverride: r.subtitle_override || null,
      imageOverrideUrl: r.image_override_url || null,
      ctaUrl: r.cta_url || null,
      createdAt: r.created_at || null,
      updatedAt: r.updated_at || null,
      source: r.source || 'admin',
      purchaseId: r.purchase_id ? String(r.purchase_id) : null,
      purchasedByUserId: r.purchased_by_user_id ? String(r.purchased_by_user_id) : null,
      stripeCheckoutSessionId: r.purchaseObj?.stripe_checkout_session_id || null,
      stripePaymentIntentId: r.purchaseObj?.stripe_payment_intent_id || null,
      purchaseStatus: r.purchaseObj?.status || null,
      purchaseAmountCents: r.purchaseObj?.amount_cents != null ? Number(r.purchaseObj.amount_cents) : null,
      purchaseCurrency: r.purchaseObj?.currency || null,
      place: {
        id: String(r.place_id),
        name: r.place.name || '',
        category: r.place.category || '',
        location: r.place.location || '',
        images: r.place.images || [],
      },
    }));
    res.json({ items: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load sponsored places' });
  }
});

/** POST /api/admin/sponsored-places */
router.post('/', async (req, res) => {
  const v = sanitizeInput(req.body);
  if (!v.placeId) return res.status(400).json({ error: 'placeId is required' });
  try {
    const placesColl = await getCollection('places');
    const place = await placesColl.findOne({ id: v.placeId });
    if (!place) return res.status(404).json({ error: 'Place not found' });

    const spColl = await getCollection('sponsored_places');
    const surface = v.surface || 'all';
    
    const existing = await spColl.findOne({ place_id: v.placeId, surface: surface });
    const id = existing ? existing.id : crypto.randomUUID();

    const doc = {
      id,
      place_id: v.placeId,
      surface,
      rank: v.rank ?? 0,
      enabled: v.enabled ?? true,
      starts_at: v.startsAt,
      ends_at: v.endsAt,
      badge_text: v.badgeText ?? null,
      title_override: v.titleOverride ?? null,
      subtitle_override: v.subtitleOverride ?? null,
      image_override_url: v.imageOverrideUrl ?? null,
      cta_url: v.ctaUrl ?? null,
      source: existing ? existing.source : 'admin',
      purchase_id: existing ? existing.purchase_id : null,
      purchased_by_user_id: existing ? existing.purchased_by_user_id : null,
      created_at: existing ? existing.created_at : new Date(),
      updated_at: new Date()
    };

    await spColl.replaceOne({ place_id: v.placeId, surface: surface }, doc, { upsert: true });
    res.status(201).json({ id: String(id), ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create sponsored place' });
  }
});

/** PATCH /api/admin/sponsored-places/:id */
router.patch('/:id', async (req, res) => {
  const id = req.params.id;
  const v = sanitizeInput(req.body);
  try {
    const setObj = {};
    if (v.rank !== undefined) setObj.rank = v.rank;
    if (v.enabled !== undefined) setObj.enabled = v.enabled;
    if (v.startsAt !== undefined) setObj.starts_at = v.startsAt;
    if (v.endsAt !== undefined) setObj.ends_at = v.endsAt;
    if (v.badgeText !== undefined) setObj.badge_text = v.badgeText;
    if (v.titleOverride !== undefined) setObj.title_override = v.titleOverride;
    if (v.subtitleOverride !== undefined) setObj.subtitle_override = v.subtitleOverride;
    if (v.imageOverrideUrl !== undefined) setObj.image_override_url = v.imageOverrideUrl;
    if (v.ctaUrl !== undefined) setObj.cta_url = v.ctaUrl;
    
    if (Object.keys(setObj).length === 0) return res.status(400).json({ error: 'No fields to update' });
    setObj.updated_at = new Date();

    const spColl = await getCollection('sponsored_places');
    const result = await spColl.updateOne({ id: id }, { $set: setObj });
    
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update sponsored place' });
  }
});

/** DELETE /api/admin/sponsored-places/:id */
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const spColl = await getCollection('sponsored_places');
    const result = await spColl.deleteOne({ id: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete sponsored place' });
  }
});

module.exports = router;
