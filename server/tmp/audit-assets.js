const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function auditAssets() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'visittripoli');

    const collections = ['places', 'tours', 'events', 'feed_posts'];
    
    for (const collName of collections) {
      const coll = db.collection(collName);
      const docs = await coll.find({}).toArray();
      
      let supabaseCount = 0;
      let localCount = 0;
      let totalImages = 0;

      docs.forEach(doc => {
        const urls = [];
        if (doc.images && Array.isArray(doc.images)) urls.push(...doc.images);
        if (doc.image) urls.push(doc.image);
        if (doc.image_url) urls.push(doc.image_url);
        if (doc.image_urls && Array.isArray(doc.image_urls)) urls.push(...doc.image_urls);
        if (doc.video_url) urls.push(doc.video_url);

        totalImages += urls.length;
        urls.forEach(u => {
          if (typeof u === 'string') {
            if (u.includes('supabase.co')) supabaseCount++;
            else if (u.startsWith('/uploads')) localCount++;
          }
        });
      });

      console.log(`Collection: ${collName}`);
      console.log(`  Total assets found: ${totalImages}`);
      console.log(`  Supabase assets: ${supabaseCount}`);
      console.log(`  Local assets: ${localCount}`);
      console.log('');
    }

  } catch (err) {
    console.err(err);
  } finally {
    await client.close();
  }
}

auditAssets();
