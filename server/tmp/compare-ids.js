const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function compareIds() {
  const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const mongoClient = new MongoClient(process.env.MONGODB_URI);

  try {
    await mongoClient.connect();
    const db = mongoClient.db(process.env.MONGODB_DB_NAME || 'visittripoli');

    const { rows: pgPlaces } = await pgPool.query('SELECT id FROM places');
    const mongoPlaces = await db.collection('places').find({}, { projection: { id: 1 } }).toArray();

    const pgIds = new Set(pgPlaces.map(p => p.id));
    const mongoIds = new Set(mongoPlaces.map(p => p.id));

    console.log(`PG IDs: ${pgIds.size}`);
    console.log(`Mongo IDs: ${mongoIds.size}`);

    const missedInMongo = [...pgIds].filter(id => !mongoIds.has(id));
    const missingInPg = [...mongoIds].filter(id => !pgIds.has(id));

    console.log(`Missed in Mongo (exist in PG but not Mongo): ${missedInMongo.length}`);
    if (missedInMongo.length > 0) console.log('Sample missed:', missedInMongo.slice(0, 5));

    console.log(`Extra in Mongo (exist in Mongo but not PG): ${missingInPg.length}`);
    if (missingInPg.length > 0) console.log('Sample extra:', missingInPg.slice(0, 5));

  } catch (err) {
    console.error(err);
  } finally {
    await pgPool.end();
    await mongoClient.close();
  }
}

compareIds();
