const { getMongoDb, getCollection } = require('../mongo');
const { mergeDiningProfileLayers } = require('../utils/diningProfileMerge');

function getTranslation(doc, lang) {
  if (!doc || !doc.translations || typeof doc.translations !== 'object') return null;
  const hit = doc.translations[lang];
  return hit && typeof hit === 'object' ? hit : null;
}

/**
 * List all categories with their place counts.
 */
async function listCategories(lang) {
  const collection = await getCollection('categories');
  const docs = await collection.find({}).toArray();
  
  const db = await getMongoDb();
  const placeCounts = await db.collection('places').aggregate([
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
  ]).toArray();
  
  const countMap = new Map(placeCounts.map((row) => [String(row._id || ''), Number(row.count || 0)]));

  const categories = docs.map((doc) => {
    const tr = getTranslation(doc, lang);
    return {
      id: doc.id,
      name: tr?.name || doc.name,
      icon: doc.icon,
      description: tr?.description || doc.description || '',
      tags: Array.isArray(tr?.tags) ? tr.tags : Array.isArray(doc.tags) ? doc.tags : [],
      count: countMap.get(String(doc.id)) ?? Number(doc.count || 0),
      color: doc.color || '#666666',
    };
  });
  
  categories.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return { source: 'mongo', categories };
}

/**
 * List all interests.
 */
async function listInterests(lang) {
  const collection = await getCollection('interests');
  const docs = await collection.find({}).toArray();
  
  const interests = docs.map((doc) => {
    const tr = getTranslation(doc, lang);
    return {
      id: doc.id,
      name: tr?.name || doc.name,
      icon: doc.icon,
      description: tr?.description || doc.description || '',
      color: doc.color || '#666666',
      count: Number(doc.count || 0),
      popularity: Number(doc.popularity || 0),
      tags: Array.isArray(tr?.tags) ? tr.tags : Array.isArray(doc.tags) ? doc.tags : [],
    };
  });
  
  interests.sort((a, b) => {
    if ((b.popularity || 0) !== (a.popularity || 0)) return (b.popularity || 0) - (a.popularity || 0);
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  
  return { source: 'mongo', interests };
}

/**
 * List places with optional pagination.
 */
async function listPlaces(lang, { limit, offset, usePagination } = {}) {
  const collection = await getCollection('places');
  
  // For now, we list all and paginate in memory to keep behavior consistent with current listPlaces logic
  // but eventually this should be done in DB if the dataset is large.
  const docs = await collection.find({}).toArray();
  
  const places = docs.map((doc) => {
    const tr = getTranslation(doc, lang);
    return {
      id: doc.id,
      name: tr?.name || doc.name,
      description: tr?.description || doc.description || '',
      location: tr?.location || doc.location || '',
      latitude: doc.latitude ?? null,
      longitude: doc.longitude ?? null,
      images: Array.isArray(doc.images) ? doc.images : [],
      category: tr?.category || doc.category || '',
      category_id: doc.categoryId || null,
      duration: tr?.duration || doc.duration || null,
      price: tr?.price || doc.price || null,
      best_time: tr?.best_time || tr?.bestTime || doc.bestTime || null,
      rating: doc.rating ?? null,
      review_count: doc.reviewCount ?? null,
      hours: doc.hours || null,
      tags: Array.isArray(tr?.tags) ? tr.tags : Array.isArray(doc.tags) ? doc.tags : [],
      search_name: doc.searchName || null,
      dining_profile: (() => {
        const camel = doc.diningProfile && typeof doc.diningProfile === 'object' && !Array.isArray(doc.diningProfile) ? doc.diningProfile : {};
        const snake = doc.dining_profile && typeof doc.dining_profile === 'object' && !Array.isArray(doc.dining_profile) ? doc.dining_profile : {};
        return mergeDiningProfileLayers(camel, snake);
      })(),
      app_avg_rating: doc.app_avg_rating ?? null,
      app_review_count: doc.app_review_count ?? 0,
    };
  });
  
  places.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  
  if (!usePagination) {
    return { source: 'mongo', places, total: places.length };
  }
  
  const safeOffset = Number(offset || 0);
  const safeLimit = Number(limit || 24);
  
  return {
    source: 'mongo',
    places: places.slice(safeOffset, safeOffset + safeLimit),
    total: places.length,
  };
}

module.exports = {
  listCategories,
  listInterests,
  listPlaces,
};
