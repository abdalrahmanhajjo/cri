const express = require('express');
const { query } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');

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
  return d.toISOString();
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
    const { rows } = await query(
      `SELECT sp.id, sp.place_id, sp.surface, sp.rank, sp.enabled, sp.starts_at, sp.ends_at,
              sp.badge_text, sp.title_override, sp.subtitle_override, sp.image_override_url, sp.cta_url,
              sp.created_at, sp.updated_at, sp.source, sp.purchase_id, sp.purchased_by_user_id,
              pur.stripe_checkout_session_id, pur.stripe_payment_intent_id, pur.status AS purchase_status,
              pur.amount_cents AS purchase_amount_cents, pur.currency AS purchase_currency,
              p.name AS place_name, p.category AS place_category, p.location AS place_location, p.images AS place_images
       FROM sponsored_places sp
       INNER JOIN places p ON p.id = sp.place_id
       LEFT JOIN sponsorship_purchases pur ON pur.id = sp.purchase_id
       ORDER BY sp.rank ASC, sp.created_at DESC`
    );
    const items = rows.map((r) => ({
      id: String(r.id),
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
      stripeCheckoutSessionId: r.stripe_checkout_session_id || null,
      stripePaymentIntentId: r.stripe_payment_intent_id || null,
      purchaseStatus: r.purchase_status || null,
      purchaseAmountCents: r.purchase_amount_cents != null ? Number(r.purchase_amount_cents) : null,
      purchaseCurrency: r.purchase_currency || null,
      place: {
        id: String(r.place_id),
        name: r.place_name || '',
        category: r.place_category || '',
        location: r.place_location || '',
        images: r.place_images || [],
      },
    }));
    res.json({ items });
  } catch (err) {
    if (err.code === '42P01') return res.json({ items: [] });
    console.error(err);
    res.status(500).json({ error: 'Failed to load sponsored places' });
  }
});

/** POST /api/admin/sponsored-places */
router.post('/', async (req, res) => {
  const v = sanitizeInput(req.body);
  if (!v.placeId) return res.status(400).json({ error: 'placeId is required' });
  try {
    const { rows: placeRows } = await query('SELECT id FROM places WHERE id = $1', [v.placeId]);
    if (!placeRows.length) return res.status(404).json({ error: 'Place not found' });
    const { rows } = await query(
      `INSERT INTO sponsored_places
         (place_id, surface, rank, enabled, starts_at, ends_at, badge_text, title_override, subtitle_override, image_override_url, cta_url,
          source, purchase_id, purchased_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8, $9, $10, $11, 'admin', NULL, NULL, NOW(), NOW())
       ON CONFLICT (place_id, surface) DO UPDATE SET
         rank = EXCLUDED.rank,
         enabled = EXCLUDED.enabled,
         starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at,
         badge_text = EXCLUDED.badge_text,
         title_override = EXCLUDED.title_override,
         subtitle_override = EXCLUDED.subtitle_override,
         image_override_url = EXCLUDED.image_override_url,
         cta_url = EXCLUDED.cta_url,
         updated_at = NOW()
       RETURNING id`,
      [
        v.placeId,
        v.surface || 'all',
        v.rank ?? 0,
        v.enabled ?? true,
        v.startsAt,
        v.endsAt,
        v.badgeText ?? null,
        v.titleOverride ?? null,
        v.subtitleOverride ?? null,
        v.imageOverrideUrl ?? null,
        v.ctaUrl ?? null,
      ]
    );
    res.status(201).json({ id: String(rows[0]?.id), ok: true });
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
    const { rowCount } = await query(
      `UPDATE sponsored_places SET
         rank = COALESCE($2, rank),
         enabled = COALESCE($3, enabled),
         starts_at = $4::timestamptz,
         ends_at = $5::timestamptz,
         badge_text = COALESCE($6, badge_text),
         title_override = COALESCE($7, title_override),
         subtitle_override = COALESCE($8, subtitle_override),
         image_override_url = COALESCE($9, image_override_url),
         cta_url = COALESCE($10, cta_url),
         updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        v.rank !== undefined ? v.rank : null,
        v.enabled !== undefined ? v.enabled : null,
        v.startsAt,
        v.endsAt,
        v.badgeText !== undefined ? v.badgeText : null,
        v.titleOverride !== undefined ? v.titleOverride : null,
        v.subtitleOverride !== undefined ? v.subtitleOverride : null,
        v.imageOverrideUrl !== undefined ? v.imageOverrideUrl : null,
        v.ctaUrl !== undefined ? v.ctaUrl : null,
      ]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '22P02') return res.status(400).json({ error: 'Invalid id or timestamp' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update sponsored place' });
  }
});

/** DELETE /api/admin/sponsored-places/:id */
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const { rowCount } = await query('DELETE FROM sponsored_places WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete sponsored place' });
  }
});

module.exports = router;

