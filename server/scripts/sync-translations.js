const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function syncTranslations() {
  const pgUrl = process.env.DATABASE_URL;
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'visittripoli';

  if (!pgUrl || !mongoUri) {
    console.error('DATABASE_URL or MONGODB_URI missing');
    process.exit(1);
  }

  const pgPool = new Pool({ connectionString: pgUrl });
  const mongoClient = new MongoClient(mongoUri);

  try {
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    console.log(`Connected to MongoDB: ${dbName}`);

    // 1. Sync Place Translations
    console.log('Syncing place translations...');
    const { rows: placeTrans } = await pgPool.query('SELECT * FROM place_translations');
    const placeMap = {};
    placeTrans.forEach(t => {
      if (!placeMap[t.place_id]) placeMap[t.place_id] = {};
      placeMap[t.place_id][t.lang] = {
        name: t.name,
        description: t.description,
        location: t.location,
        category: t.category,
        duration: t.duration,
        price: t.price,
        best_time: t.best_time,
        tags: t.tags
      };
    });

    for (const [placeId, translations] of Object.entries(placeMap)) {
      await db.collection('places').updateOne(
        { id: placeId },
        { $set: { translations } }
      );
    }
    console.log(`Synced translations for ${Object.keys(placeMap).length} places.`);

    // 2. Sync Category Translations
    console.log('Syncing category translations...');
    const { rows: catTrans } = await pgPool.query('SELECT * FROM category_translations');
    const catMap = {};
    catTrans.forEach(t => {
      if (!catMap[t.category_id]) catMap[t.category_id] = {};
      catMap[t.category_id][t.lang] = {
        name: t.name,
        description: t.description,
        tags: t.tags
      };
    });

    for (const [catId, translations] of Object.entries(catMap)) {
      await db.collection('categories').updateOne(
        { id: catId },
        { $set: { translations } }
      );
    }
    console.log(`Synced translations for ${Object.keys(catMap).length} categories.`);

    // 3. Sync Interest Translations (just in case they have data later)
    console.log('Syncing interest translations...');
    const { rows: intTrans } = await pgPool.query('SELECT * FROM interest_translations');
    const intMap = {};
    intTrans.forEach(t => {
      if (!intMap[t.interest_id]) intMap[t.interest_id] = {};
      intMap[t.interest_id][t.lang] = {
        name: t.name,
        description: t.description,
        tags: t.tags
      };
    });
    for (const [intId, translations] of Object.entries(intMap)) {
      await db.collection('interests').updateOne(
        { id: intId },
        { $set: { translations } }
      );
    }

    console.log('Translation sync complete.');

  } catch (err) {
    console.error('Sync failed:', err);
  } finally {
    await pgPool.end();
    await mongoClient.close();
  }
}

syncTranslations();
