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

function docToEvent(doc, lang) {
  const tr = getTranslation(doc, lang);
  return {
    id: doc.id,
    name: normalizeDbText(tr?.name || doc.name),
    description: normalizeDbText(tr?.description || doc.description || ''),
    startDate: doc.startDate instanceof Date ? doc.startDate.toISOString() : doc.startDate,
    endDate: doc.endDate instanceof Date ? doc.endDate.toISOString() : doc.endDate,
    location: normalizeDbText(tr?.location || doc.location || ''),
    image: doc.image,
    category: normalizeDbText(tr?.category || doc.category || ''),
    organizer: normalizeDbText(tr?.organizer || doc.organizer || ''),
    price: doc.price,
    priceDisplay: normalizeDbText(String(tr?.priceDisplay || doc.priceDisplay || '')),
    status: normalizeDbText(String(tr?.status || doc.status || '')),
    placeId: doc.placeId
  };
}

router.get('/', cachePublicList(45, 240), async (req, res) => {
  try {
    const lang = getRequestLang(req);
    const eventsColl = await getCollection('events');
    const docs = await eventsColl.find({}).sort({ startDate: -1 }).toArray();
    
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
