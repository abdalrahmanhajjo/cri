const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { getMongoDb, mongoDbName } = require('../src/mongo');

async function cleanup() {
  console.log(`--- Starting GridFS Cleanup for DB: ${mongoDbName()} ---`);
  try {
    const db = await getMongoDb();
    
    // GridFS uses two collections: fs.files and fs.chunks (or <bucketName>.files/chunks)
    // Our bucket was named 'uploads'
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);

    if (names.includes('uploads.files')) {
      console.log('Dropping uploads.files...');
      await db.collection('uploads.files').drop();
    }
    
    if (names.includes('uploads.chunks')) {
      console.log('Dropping uploads.chunks...');
      await db.collection('uploads.chunks').drop();
    }

    console.log('--- Cleanup Complete ---');
    process.exit(0);
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

cleanup();
