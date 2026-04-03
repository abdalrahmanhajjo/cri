const { query } = require('../db');

function getTranslation(row, prefix = 'tr_') {
  // If we joined a translation table and the translated name is there, it's the hit.
  // The PostgreSQL schema uses a separate table (e.g. place_translations) for each lang.
  // When we join, pt.name as tr_name, etc.
  // If tr_name is NULL, we fall back to the base row.name.
  return {
    name: row[`${prefix}name`],
    description: row[`${prefix}description`],
    location: row[`${prefix}location`],
    category: row[`${prefix}category`],
    duration: row[`${prefix}duration`],
    price: row[`${prefix}price`],
    best_time: row[`${prefix}best_time`],
    tags: row[`${prefix}tags`],
  };
}

/**
 * List all categories with their place counts.
 */
async function listCategories(lang) {
  // Join categories with translations for the specific lang
  const { rows: categoriesRows } = await query(`
    SELECT c.*, ct.name as tr_name, ct.description as tr_description, ct.tags as tr_tags
    FROM categories c
    LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.lang = $1
  `, [lang]);

  // Aggregate counts from places
  const { rows: countRows } = await query(`
    SELECT category_id, COUNT(*) as count FROM places GROUP BY category_id
  `, []);
  
  const countMap = new Map(countRows.map((row) => [String(row.category_id || ''), Number(row.count || 0)]));

  const categories = categoriesRows.map((row) => {
    return {
      id: row.id,
      name: row.tr_name || row.name,
      icon: row.icon,
      description: row.tr_description || row.description || '',
      tags: Array.isArray(row.tr_tags) ? row.tr_tags : Array.isArray(row.tags) ? row.tags : [],
      count: countMap.get(String(row.id)) ?? Number(row.count || 0),
      color: row.color || '#666666',
    };
  });
  
  categories.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return { source: 'postgres', categories };
}

/**
 * List all interests.
 */
async function listInterests(lang) {
  const { rows: interestRows } = await query(`
    SELECT i.*, it.name as tr_name, it.description as tr_description, it.tags as tr_tags
    FROM interests i
    LEFT JOIN interest_translations it ON it.interest_id = i.id AND it.lang = $1
  `, [lang]);
  
  const interests = interestRows.map((row) => {
    return {
      id: row.id,
      name: row.tr_name || row.name,
      icon: row.icon,
      description: row.tr_description || row.description || '',
      color: row.color || '#666666',
      count: Number(row.count || 0),
      popularity: Number(row.popularity || 0),
      tags: Array.isArray(row.tr_tags) ? row.tr_tags : Array.isArray(row.tags) ? row.tags : [],
    };
  });
  
  interests.sort((a, b) => {
    if ((b.popularity || 0) !== (a.popularity || 0)) return (b.popularity || 0) - (a.popularity || 0);
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  
  return { source: 'postgres', interests };
}

/**
 * List places with optional pagination.
 */
async function listPlaces(lang, { limit, offset, usePagination } = {}) {
  // Join places with translations
  const { rows: docs } = await query(`
    SELECT p.*, pt.name as tr_name, pt.description as tr_description, pt.location as tr_location, 
           pt.category as tr_category, pt.duration as tr_duration, pt.price as tr_price, 
           pt.best_time as tr_best_time, pt.tags as tr_tags
    FROM places p
    LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $1
  `, [lang]);
  
  const places = docs.map((row) => {
    return {
      id: row.id,
      name: row.tr_name || row.name,
      description: row.tr_description || row.description || '',
      location: row.tr_location || row.location || '',
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      images: Array.isArray(row.images) ? row.images : [],
      category: row.tr_category || row.category || '',
      category_id: row.category_id || null,
      duration: row.tr_duration || row.duration || null,
      price: row.tr_price || row.price || null,
      best_time: row.tr_best_time || row.best_time || null,
      rating: row.rating ?? null,
      review_count: row.review_count ?? null,
      hours: row.hours || null,
      tags: Array.isArray(row.tr_tags) ? row.tr_tags : Array.isArray(row.tags) ? row.tags : [],
      search_name: row.search_name || null,
      dining_profile: row.dining_profile || {},
      app_avg_rating: row.app_avg_rating ?? null,
      app_review_count: row.app_review_count ?? 0,
    };
  });
  
  places.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  
  if (!usePagination) {
    return { source: 'postgres', places, total: places.length };
  }
  
  const safeOffset = Number(offset || 0);
  const safeLimit = Number(limit || 24);
  
  return {
    source: 'postgres',
    places: places.slice(safeOffset, safeOffset + safeLimit),
    total: places.length,
  };
}

module.exports = {
  listCategories,
  listInterests,
  listPlaces,
};
