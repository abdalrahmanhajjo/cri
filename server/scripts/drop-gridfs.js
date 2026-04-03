const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'visittripoli';

async function purgeStorage() {
  if (!uri) {
    console.error('Error: MONGODB_URI not found in .env');
    process.exit(1);
  }

  console.log(`--- Purging Media Storage for DB: ${dbName} ---`);
  
  const client = new MongoClient(uri, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);

    if (names.includes('uploads.files')) {
      console.log('Dropping uploads.files...');
      await db.collection('uploads.files').drop();
      console.log('Done: uploads.files dropped.');
    } else {
      console.log('uploads.files not found. Skipping.');
    }
    
    if (names.includes('uploads.chunks')) {
      console.log('Dropping uploads.chunks...');
      await db.collection('uploads.chunks').drop();
      console.log('Done: uploads.chunks dropped.');
    } else {
      console.log('uploads.chunks not found. Skipping.');
    }

    console.log('--- PURGE COMPLETE: Space reclaimed. ---');
    process.exit(0);
  } catch (err) {
    console.error('Purge failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

purgeStorage();
