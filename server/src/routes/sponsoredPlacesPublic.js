const express = require('express');
const { getCollection } = require('../mongo');

const router = express.Router();
const ROW_ID = 'default';

function normalizeSurface(raw) {
  const s = String(raw || '').trim().toLowerCase();
  const valid = ['home', 'discover', 'feed', 'dining', 'hotels'];
  return valid.includes(s) ? s : 'home';
}

async function loadSiteSettings() {
  try {
    const coll = await getCollection('site_settings');
    const row = await coll.findOne({ id: ROW_ID });
    return row?.data && typeof row.data === 'object' ? row.data : {};
  } catch (err) {
    return {};
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
  const now = new Date();
  try {
    const settings = await loadSiteSettings();
    if (!isSurfaceEnabled(settings, surface)) return res.json({ items: [], enabled: false });

    const sponsoredColl = await getCollection('sponsored_places');
    const items = await sponsoredColl.aggregate([
      { $match: {
          enabled: true,
          surface: { $in: [surface, 'all'] },
          $or: [{ starts_at: null }, { starts_at: { $lte: now } }],
          $or: [{ ends_at: null }, { ends_at: { $gte: now } }]
      }},
      { $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place'
      }},
      { $addFields: {
          placeObj: { $arrayElemAt: ['$place', 0] }
      }},
      { $project: {
          id: 1,
          place_id: 1,
          surface: 1,
          rank: 1,
          enabled: 1,
          starts_at: 1,
          ends_at: 1,
          badge_text: 1,
          title_override: 1,
          subtitle_override: 1,
          image_override_url: 1,
          cta_url: 1,
          place_name: '$placeObj.name',
          place_category: '$placeObj.category',
          place_location: '$placeObj.location',
          place_images: '$placeObj.images'
      }},
      { $sort: { rank: 1, created_at: -1 } },
      { $limit: 40 }
    ]).toArray();

    res.json({ items: items.map(rowToSponsored), enabled: true });
  } catch (err) {
    console.error(err);
    res.json({ items: [], enabled: true });
  }
});

module.exports = router;
