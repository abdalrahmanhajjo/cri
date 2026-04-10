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

function toIso(val) {
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? String(val) : d.toISOString();
  }
  return null;
}

function docToEvent(doc, lang) {
  const tr = getTranslation(doc, lang);
  const startRaw = doc.startDate ?? doc.start_date;
  const endRaw = doc.endDate ?? doc.end_date;
  const lat = doc.latitude ?? doc.lat;
  const lng = doc.longitude ?? doc.lng;
  return {
    id: doc.id,
    name: normalizeDbText(tr?.name || doc.name),
    description: normalizeDbText(tr?.description || doc.description || ''),
    startDate: toIso(startRaw),
    endDate: toIso(endRaw),
    location: normalizeDbText(tr?.location || doc.location || ''),
    image: doc.image,
    category: normalizeDbText(tr?.category || doc.category || ''),
    organizer: normalizeDbText(tr?.organizer || doc.organizer || ''),
    price: doc.price,
    priceDisplay: normalizeDbText(
      String(tr?.priceDisplay || doc.priceDisplay || doc.price_display || '')
    ),
    status: normalizeDbText(String(tr?.status || doc.status || '')),
    placeId: doc.placeId ?? doc.place_id ?? null,
    latitude: lat != null && lat !== '' && Number.isFinite(Number(lat)) ? Number(lat) : null,
    longitude: lng != null && lng !== '' && Number.isFinite(Number(lng)) ? Number(lng) : null,
  };
}

router.get('/', cachePublicList(45, 240), async (req, res) => {
  try {
    const lang = getRequestLang(req);
    const eventsColl = await getCollection('events');
    const docs = await eventsColl.find({}).sort({ start_date: -1, updated_at: -1 }).toArray();
    
    res.json({ events: docs.map(doc => docToEvent(doc, lang)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.get('/:id', async (req, res) => {
  const rawId = req.params.id;
  try {
    const lang = getRequestLang(req);
    const eventsColl = await getCollection('events');
    const doc = await eventsColl.findOne({ id: rawId });
    
    if (!doc) return res.status(404).json({ error: 'Event not found' });
    res.json(docToEvent(doc, lang));
  } catch (err) {
    console.error(err);
    sendDbAwareError(res, err, 'Failed to fetch event');
  }
});

module.exports = router;
