const express = require('express');
const { getCollection } = require('../mongo');
const { getRequestLang } = require('../utils/requestLang');
const { sendDbAwareError } = require('../utils/dbHttpError');
const { normalizeDbText } = require('../utils/normalizeDbText');
const { cachePublicList } = require('../middleware/publicCache');

const router = express.Router();

function getTranslation(doc, lang) {
  if (!doc || !doc.translations || typeof doc.translations !== 'object') return null;
  const hit = doc.translations[lang];
  return hit && typeof hit === 'object' ? hit : null;
}

function rowToTour(doc, lang) {
  const tr = getTranslation(doc, lang);
  return {
    id: doc.id,
    name: normalizeDbText(tr?.name || doc.name),
    duration: normalizeDbText(tr?.duration || doc.duration || ''),
    durationHours: doc.duration_hours || doc.durationHours,
    locations: doc.locations,
    rating: doc.rating,
    reviews: doc.reviews,
    price: doc.price,
    currency: doc.currency,
    priceDisplay: normalizeDbText(String(tr?.price_display || tr?.priceDisplay || doc.priceDisplay || '')),
    badge: normalizeDbText(String(tr?.badge || doc.badge || '')),
    badgeColor: doc.badge_color || doc.badgeColor,
    description: normalizeDbText(tr?.description || doc.description || ''),
    image: doc.image,
    difficulty: normalizeDbText(String(tr?.difficulty || doc.difficulty || '')),
    languages: (Array.isArray(doc.languages) ? doc.languages : []).map(x => normalizeDbText(String(x))),
    includes: (Array.isArray(tr?.includes || doc.includes) ? (tr?.includes || doc.includes) : []).map(x => normalizeDbText(String(x))),
    excludes: (Array.isArray(tr?.excludes || doc.excludes) ? (tr?.excludes || doc.excludes) : []).map(x => normalizeDbText(String(x))),
    highlights: (Array.isArray(tr?.highlights || doc.highlights) ? (tr?.highlights || doc.highlights) : []).map(x => normalizeDbText(String(x))),
    itinerary: Array.isArray(tr?.itinerary || doc.itinerary) ? (tr?.itinerary || doc.itinerary) : [],
    placeIds: doc.place_ids || doc.placeIds || []
  };
}

router.get('/', cachePublicList(60, 300), async (req, res) => {
  try {
    const lang = getRequestLang(req);
    const toursColl = await getCollection('tours');
    const docs = await toursColl.find({}).sort({ name: 1 }).toArray();
    res.json({ featured: docs.map(doc => rowToTour(doc, lang)) });
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to fetch tours');
  }
});

router.get('/:id', async (req, res) => {
  const rawId = req.params.id;
  try {
    const lang = getRequestLang(req);
    const toursColl = await getCollection('tours');
    const doc = await toursColl.findOne({ id: rawId });
    
    if (!doc) return res.status(404).json({ error: 'Tour not found' });
    res.json(rowToTour(doc, lang));
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to fetch tour');
  }
});

module.exports = router;
