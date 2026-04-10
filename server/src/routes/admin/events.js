const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { invalidateSitemapCache } = require('../../seo/seoRoutes');
const { adminMiddleware } = require('../../middleware/admin');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const id = (body.id || '').toString().trim() || ('event_' + Date.now());
    
    const startDate = body.startDate || body.start_date ? new Date(body.startDate || body.start_date) : new Date();
    const endDate = body.endDate || body.end_date ? new Date(body.endDate || body.end_date) : new Date(Date.now() + 3600000);

    const latRaw = body.latitude ?? body.lat;
    const lngRaw = body.longitude ?? body.lng;
    const latitude =
      latRaw != null && latRaw !== '' && Number.isFinite(Number(latRaw)) ? Number(latRaw) : null;
    const longitude =
      lngRaw != null && lngRaw !== '' && Number.isFinite(Number(lngRaw)) ? Number(lngRaw) : null;

    const eventsColl = await getCollection('events');
    const doc = {
      id,
      name: (body.name || 'Untitled Event').toString(),
      description: (body.description || '').toString(),
      start_date: startDate,
      end_date: endDate,
      location: (body.location || '').toString(),
      image: (body.image || '').toString() || null,
      category: (body.category || '').toString(),
      organizer: (body.organizer || '').toString() || null,
      price: body.price != null ? parseFloat(body.price) : null,
      price_display: (body.priceDisplay || body.price_display || '').toString() || null,
      status: (body.status || 'active').toString(),
      place_id: (body.placeId || body.place_id || '').toString().trim() || null,
      latitude,
      longitude,
      updated_at: new Date()
    };

    await eventsColl.replaceOne({ id }, doc, { upsert: true });
    invalidateSitemapCache();
    res.status(201).json({ id, message: 'Event saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save event' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    
    const setObj = {};
    if (body.name !== undefined) setObj.name = String(body.name);
    if (body.description !== undefined) setObj.description = String(body.description);
    if (body.startDate !== undefined || body.start_date !== undefined) {
      setObj.start_date = new Date(body.startDate ?? body.start_date);
    }
    if (body.endDate !== undefined || body.end_date !== undefined) {
      setObj.end_date = new Date(body.endDate ?? body.end_date);
    }
    if (body.location !== undefined) setObj.location = String(body.location);
    if (body.image !== undefined) setObj.image = String(body.image);
    if (body.category !== undefined) setObj.category = String(body.category);
    if (body.organizer !== undefined) setObj.organizer = String(body.organizer);
    if (body.price !== undefined) setObj.price = body.price != null ? parseFloat(body.price) : null;
    if (body.priceDisplay !== undefined || body.price_display !== undefined) {
      setObj.price_display = String(body.priceDisplay ?? body.price_display);
    }
    if (body.status !== undefined) setObj.status = String(body.status);
    if (body.placeId !== undefined || body.place_id !== undefined) {
      const pid = String(body.placeId ?? body.place_id ?? '').trim();
      setObj.place_id = pid || null;
    }
    if (body.latitude !== undefined || body.lat !== undefined) {
      const v = body.latitude ?? body.lat;
      setObj.latitude =
        v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
    }
    if (body.longitude !== undefined || body.lng !== undefined) {
      const v = body.longitude ?? body.lng;
      setObj.longitude =
        v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
    }

    setObj.updated_at = new Date();

    const eventsColl = await getCollection('events');
    const result = await eventsColl.updateOne({ id }, { $set: setObj });
    
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Event not found' });
    invalidateSitemapCache();
    res.json({ id, message: 'Event updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const eventsColl = await getCollection('events');
    const result = await eventsColl.deleteOne({ id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Event not found' });
    invalidateSitemapCache();
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
