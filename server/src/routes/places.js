const express = require('express');
const { query } = require('../db');
const { getRequestLang } = require('../utils/requestLang');
const { parsePositiveInt } = require('../utils/validate');

const router = express.Router();

/** Fix malformed extension (e.g. xxxjpg -> xxx.jpg) from old upload bug */
function fixImageUrlExtension(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/([a-f0-9]{32})(jpe?g|png|gif|webp)$/i, '$1.$2');
}

function resolveImageUrls(images, baseUrl) {
  if (!Array.isArray(images)) return [];
  const base = (baseUrl || process.env.UPLOADS_BASE_URL || '').replace(/\/$/, '');
  return images.filter(Boolean).map((url) => {
    if (!url || typeof url !== 'string') return null;
    url = fixImageUrlExtension(url);
    if (url.startsWith('http')) return url;
    if (url.startsWith('/') && base) return base + url;
    return url;
  }).filter(Boolean);
}

function safeParseJson(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function rowToPlace(row, baseUrl) {
  let images = safeParseJson(row.images, []);
  images = resolveImageUrls(images, baseUrl);
  const result = {
    id: row.id,
    name: row.name,
    description: row.description || '',
    location: row.location || '',
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    images,
    category: row.category || '',
    categoryId: row.category_id,
    duration: row.duration,
    price: row.price,
    bestTime: row.best_time,
    rating: row.rating,
    reviewCount: row.review_count,
    hours: row.hours,
    tags: row.tags,
    searchName: row.search_name
  };
  if (row.latitude != null && row.longitude != null) result.coordinates = { lat: row.latitude, lng: row.longitude };
  if (images.length === 1) result.image = images[0];
  return result;
}

function getUploadsBaseUrl(req) {
  if (process.env.UPLOADS_BASE_URL) return process.env.UPLOADS_BASE_URL;
  const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:' + (process.env.PORT || 3000);
  return proto + '://' + host;
}

router.get('/', async (req, res) => {
  try {
    const baseUrl = getUploadsBaseUrl(req);
    const lang = getRequestLang(req);
    const result = await query(
      `SELECT p.id, p.latitude, p.longitude, p.images, p.rating, p.review_count, p.hours, p.search_name, p.category_id,
              COALESCE(pt.name, p.name) AS name, COALESCE(pt.description, p.description) AS description,
              COALESCE(pt.location, p.location) AS location, COALESCE(pt.category, p.category) AS category,
              COALESCE(pt.duration, p.duration) AS duration, COALESCE(pt.price, p.price) AS price,
              COALESCE(pt.best_time, p.best_time) AS best_time, COALESCE(pt.tags, p.tags) AS tags
       FROM places p
       LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $1
       ORDER BY p.name`,
      [lang]
    );
    const places = result.rows.map((r) => rowToPlace(r, baseUrl));
    res.json({ popular: places, locations: places });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch places', detail: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

router.get('/:id', async (req, res) => {
  const rawId = req.params.id;
  const idResult = parsePositiveInt(rawId);
  const bySlug = !idResult.valid;
  if (bySlug && (typeof rawId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(rawId))) {
    return res.status(400).json({ error: 'Invalid place id' });
  }
  try {
    const baseUrl = getUploadsBaseUrl(req);
    const lang = getRequestLang(req);
    const slugNorm = rawId.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    let result = bySlug
      ? await query(
          `SELECT p.id, p.latitude, p.longitude, p.images, p.rating, p.review_count, p.hours, p.search_name, p.category_id,
                  COALESCE(pt.name, p.name) AS name, COALESCE(pt.description, p.description) AS description,
                  COALESCE(pt.location, p.location) AS location, COALESCE(pt.category, p.category) AS category,
                  COALESCE(pt.duration, p.duration) AS duration, COALESCE(pt.price, p.price) AS price,
                  COALESCE(pt.best_time, p.best_time) AS best_time, COALESCE(pt.tags, p.tags) AS tags
           FROM places p
           LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $1
           WHERE p.id::text = $2
              OR p.search_name = $2
              OR LOWER(REPLACE(REPLACE(COALESCE(p.search_name, ''), ' ', '_'), '-', '_')) = $3
              OR LOWER(REPLACE(REPLACE(COALESCE(p.name, ''), ' ', '_'), '-', '_')) = $3`,
          [lang, rawId, slugNorm]
        )
      : await query(
          `SELECT p.id, p.latitude, p.longitude, p.images, p.rating, p.review_count, p.hours, p.search_name, p.category_id,
                  COALESCE(pt.name, p.name) AS name, COALESCE(pt.description, p.description) AS description,
                  COALESCE(pt.location, p.location) AS location, COALESCE(pt.category, p.category) AS category,
                  COALESCE(pt.duration, p.duration) AS duration, COALESCE(pt.price, p.price) AS price,
                  COALESCE(pt.best_time, p.best_time) AS best_time, COALESCE(pt.tags, p.tags) AS tags
           FROM places p
           LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $1
           WHERE p.id = $2`,
          [lang, idResult.value]
        );
    if (result.rows.length === 0 && !bySlug) {
      result = await query(
        `SELECT p.id, p.latitude, p.longitude, p.images, p.rating, p.review_count, p.hours, p.search_name, p.category_id,
                COALESCE(pt.name, p.name) AS name, COALESCE(pt.description, p.description) AS description,
                COALESCE(pt.location, p.location) AS location, COALESCE(pt.category, p.category) AS category,
                COALESCE(pt.duration, p.duration) AS duration, COALESCE(pt.price, p.price) AS price,
                COALESCE(pt.best_time, p.best_time) AS best_time, COALESCE(pt.tags, p.tags) AS tags
         FROM places p
         LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $1
         WHERE p.id::text = $2`,
        [lang, rawId]
      );
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'Place not found' });
    res.json(rowToPlace(result.rows[0], baseUrl));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch place' });
  }
});

module.exports = router;
