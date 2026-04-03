#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { query, closePool } = require('../src/db');
const { getMongoDb, closeMongoClient, hasMongoConfigured, mongoDbName } = require('../src/mongo');

async function loadTranslationMap(table, keyField) {
  const { rows } = await query(`SELECT * FROM ${table}`, []);
  const map = new Map();
  for (const row of rows) {
    const entityId = String(row[keyField]);
    const lang = String(row.lang);
    if (!map.has(entityId)) map.set(entityId, {});
    map.get(entityId)[lang] = row;
  }
  return map;
}

async function syncCategories(db) {
  const { rows } = await query('SELECT * FROM categories ORDER BY id', []);
  const translations = await loadTranslationMap('category_translations', 'category_id');
  const collection = db.collection('categories');
  const ops = rows.map((row) => ({
    updateOne: {
      filter: { _id: String(row.id) },
      update: {
        $set: {
          id: String(row.id),
          name: row.name,
          icon: row.icon,
          description: row.description,
          tags: row.tags || [],
          count: row.count ?? 0,
          color: row.color || null,
          translations: translations.get(String(row.id)) || {},
          syncedAt: new Date(),
          source: 'postgres',
        },
      },
      upsert: true,
    },
  }));
  if (ops.length) await collection.bulkWrite(ops, { ordered: false });
  await collection.createIndex({ id: 1 }, { unique: true });
  return ops.length;
}

async function syncInterests(db) {
  const { rows } = await query('SELECT * FROM interests ORDER BY id', []);
  const translations = await loadTranslationMap('interest_translations', 'interest_id');
  const collection = db.collection('interests');
  const ops = rows.map((row) => ({
    updateOne: {
      filter: { _id: String(row.id) },
      update: {
        $set: {
          id: String(row.id),
          name: row.name,
          icon: row.icon,
          description: row.description,
          color: row.color,
          count: row.count ?? 0,
          popularity: row.popularity ?? 0,
          tags: row.tags || [],
          translations: translations.get(String(row.id)) || {},
          syncedAt: new Date(),
          source: 'postgres',
        },
      },
      upsert: true,
    },
  }));
  if (ops.length) await collection.bulkWrite(ops, { ordered: false });
  await collection.createIndex({ id: 1 }, { unique: true });
  return ops.length;
}

async function syncPlaces(db) {
  const { rows } = await query('SELECT * FROM places ORDER BY id', []);
  const translations = await loadTranslationMap('place_translations', 'place_id');
  const collection = db.collection('places');
  const ops = rows.map((row) => ({
    updateOne: {
      filter: { _id: String(row.id) },
      update: {
        $set: {
          id: String(row.id),
          name: row.name,
          description: row.description,
          location: row.location,
          latitude: row.latitude,
          longitude: row.longitude,
          searchName: row.search_name || null,
          images: row.images || [],
          category: row.category || null,
          categoryId: row.category_id || null,
          duration: row.duration || null,
          price: row.price || null,
          bestTime: row.best_time || null,
          diningProfile:
            row.dining_profile && typeof row.dining_profile === 'object' && !Array.isArray(row.dining_profile)
              ? row.dining_profile
              : {},
          rating: row.rating ?? null,
          reviewCount: row.review_count ?? 0,
          hours: row.hours || null,
          tags: row.tags || [],
          translations: translations.get(String(row.id)) || {},
          syncedAt: new Date(),
          source: 'postgres',
        },
      },
      upsert: true,
    },
  }));
  if (ops.length) await collection.bulkWrite(ops, { ordered: false });
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ categoryId: 1 });
  await collection.createIndex({ name: 'text', description: 'text', location: 'text' });
  return ops.length;
}

async function main() {
  if (!hasMongoConfigured()) {
    console.error('Missing MONGODB_URI. Set it in server/.env or the root .env first.');
    process.exit(1);
  }

  const db = await getMongoDb();
  console.log(`Syncing PostgreSQL core content into MongoDB database "${mongoDbName()}"...`);

  try {
    const categories = await syncCategories(db);
    const interests = await syncInterests(db);
    const places = await syncPlaces(db);

    console.log('MongoDB core content sync complete.');
    console.log(`  categories: ${categories}`);
    console.log(`  interests: ${interests}`);
    console.log(`  places: ${places}`);
  } finally {
    await closeMongoClient();
    await closePool();
  }
}

main().catch(async (err) => {
  console.error('MongoDB core content sync failed:', String(err.message || err));
  try {
    await closeMongoClient();
  } catch (_) {
    // ignore
  }
  try {
    await closePool();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
