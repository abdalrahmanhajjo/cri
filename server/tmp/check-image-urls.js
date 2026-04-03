const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkImageUrls() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'visittripoli');

    const sample = await db.collection('places').findOne({ images: { $exists: true, $not: { $size: 0 } } });
    if (sample) {
      console.log(`Sample image URLs for place ${sample.id}:`);
      console.log(JSON.stringify(sample.images, null, 2));
    } else {
      console.log('No images found in any place.');
    }
  } catch (err) {
    console.err(err);
  } finally {
    await client.close();
  }
}

checkImageUrls();
