'use strict';

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,119}$/i;

/** Lebanon / Eastern Med bounds (generous for border listings) */
const LAT_MIN = 32;
const LAT_MAX = 38;
const LNG_MIN = 33;
const LNG_MAX = 38;

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v) {
  if (v == null || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate admin POST /api/admin/places body (create / upsert).
 */
function validateAdminPlaceUpsert(body) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};

  let id = (b.id != null ? String(b.id) : '').trim();
  if (!id && b.name != null) {
    id = String(b.name)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '');
  }
  if (!id || !ID_RE.test(id)) {
    errors.push('id must be 1–120 characters: letters, numbers, underscore, hyphen');
  }

  const name = b.name != null ? String(b.name).trim() : '';
  if (!name || name.length > 300) {
    errors.push('name is required and must be at most 300 characters');
  }

  const description = b.description != null ? String(b.description) : '';
  if (description.length > 50_000) {
    errors.push('description must be at most 50000 characters');
  }

  const location = b.location != null ? String(b.location) : '';
  if (location.length > 500) {
    errors.push('location must be at most 500 characters');
  }

  const lat = numOrNull(b.latitude);
  const lng = numOrNull(b.longitude);
  if (lat != null && (lat < LAT_MIN || lat > LAT_MAX)) {
    errors.push(`latitude must be between ${LAT_MIN} and ${LAT_MAX}`);
  }
  if (lng != null && (lng < LNG_MIN || lng > LNG_MAX)) {
    errors.push(`longitude must be between ${LNG_MIN} and ${LNG_MAX}`);
  }
  if ((lat == null) !== (lng == null)) {
    errors.push('latitude and longitude must both be set or both omitted');
  }

  const searchName = (b.searchName != null ? String(b.searchName) : b.search_name != null ? String(b.search_name) : '').trim();
  if (searchName.length > 200) {
    errors.push('searchName must be at most 200 characters');
  }

  const category = b.category != null ? String(b.category) : '';
  if (category.length > 200) {
    errors.push('category must be at most 200 characters');
  }

  const categoryId = (b.categoryId != null ? String(b.categoryId) : b.category_id != null ? String(b.category_id) : '').trim();
  if (categoryId.length > 80) {
    errors.push('categoryId must be at most 80 characters');
  }

  const duration = b.duration != null ? String(b.duration) : '';
  if (duration.length > 120) {
    errors.push('duration must be at most 120 characters');
  }

  const price = b.price != null ? String(b.price) : '';
  if (price.length > 80) {
    errors.push('price must be at most 80 characters');
  }

  const bestTime = (b.bestTime != null ? String(b.bestTime) : b.best_time != null ? String(b.best_time) : '') || '';
  if (bestTime.length > 200) {
    errors.push('bestTime must be at most 200 characters');
  }

  let rating = numOrNull(b.rating);
  if (rating != null && (rating < 0 || rating > 5)) {
    errors.push('rating must be between 0 and 5');
  }

  let reviewCount = intOrNull(b.reviewCount ?? b.review_count);
  if (reviewCount != null && (reviewCount < 0 || reviewCount > 50_000_000)) {
    errors.push('reviewCount must be a sensible non-negative integer');
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      id,
      name,
      description,
      location,
      latitude: lat,
      longitude: lng,
      searchName: searchName || null,
      category: category || null,
      categoryId: categoryId || null,
      duration: duration || null,
      price: price || null,
      bestTime: bestTime || null,
      rating,
      reviewCount,
    },
  };
}

module.exports = { validateAdminPlaceUpsert };
