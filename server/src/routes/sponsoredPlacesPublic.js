const express = require('express');
const { query } = require('../db');

const router = express.Router();
const ROW_ID = 'default';

function normalizeSurface(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'home' || s === 'discover' || s === 'feed' || s === 'dining' || s === 'hotels') return s;
  return 'home';
}

async function loadSiteSettings() {
  try {
    const { rows } = await query('SELECT data FROM site_settings WHERE id = $1', [ROW_ID]);
    const data = rows[0]?.data;
    return data && typeof data === 'object' ? data : {};
  } catch (err) {
    if (err.code === '42P01') return {};
    throw err;
  }
}

function isSurfaceEnabled(settings, surface) {
  const root = settings?.sponsoredPlacesEnabled;
  if (!root || typeof root !== 'object') return true;
  const v = root[surface];
  if (v === undefined) return true;
  return Boolean(v);
}

function rowToSponsored(r) {
  const images = Array.isArray(r.place_images) ? r.place_images : [];
  const image = images.length ? images[0] : null;
  return {
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
    place: {
      id: String(r.place_id),
      name: r.place_name || '',
      category: r.place_category || '',
      location: r.place_location || '',
      images,
      image,
    },
  };
}

/** GET /api/sponsored-places?surface=home|discover|feed|dining|hotels */
router.get('/', async (req, res) => {
  const surface = normalizeSurface(req.query.surface);
  try {
    const settings = await loadSiteSettings();
    if (!isSurfaceEnabled(settings, surface)) return res.json({ items: [], enabled: false });

    const { rows } = await query(
      `SELECT sp.id, sp.place_id, sp.surface, sp.rank, sp.enabled, sp.starts_at, sp.ends_at,
              sp.badge_text, sp.title_override, sp.subtitle_override, sp.image_override_url, sp.cta_url,
              p.name AS place_name, p.category AS place_category, p.location AS place_location, p.images AS place_images
       FROM sponsored_places sp
       INNER JOIN places p ON p.id = sp.place_id
       WHERE sp.enabled = true
         AND (sp.surface = $1 OR sp.surface = 'all')
         AND (sp.starts_at IS NULL OR sp.starts_at <= NOW())
         AND (sp.ends_at IS NULL OR sp.ends_at >= NOW())
       ORDER BY sp.rank ASC, sp.created_at DESC
       LIMIT 40`,
      [surface]
    );
    res.json({ items: rows.map(rowToSponsored), enabled: true });
  } catch (err) {
    if (err.code === '42P01') return res.json({ items: [], enabled: true });
    console.error(err);
    res.status(500).json({ error: 'Failed to load sponsored places' });
  }
});

module.exports = router;

