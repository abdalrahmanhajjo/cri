const axios = require('axios');
const { MongoClient, GridFSBucket } = require('mongodb');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function migrateAssets() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'visittripoli';

  if (!mongoUri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    console.log(`Connected to MongoDB: ${dbName}`);

    const collections = ['places', 'tours', 'events', 'feed_posts'];
    
    for (const collName of collections) {
      console.log(`Migrating assets in collection: ${collName}...`);
      const coll = db.collection(collName);
      const docs = await coll.find({}).toArray();
      
      for (const doc of docs) {
        let changed = false;
        const updates = {};

        const processUrl = async (url) => {
          if (typeof url !== 'string' || !url.includes('supabase.co')) return url;

          try {
            console.log(`  Downloading: ${url}`);
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const contentType = response.headers['content-type'] || 'image/jpeg';
            
            const storagePrefix = collName === 'feed_posts' ? 'feed' : 'places';
            const ext = path.extname(new URL(url).pathname) || '.jpg';
            const filename = `${storagePrefix}_migrated_${crypto.randomBytes(8).toString('hex')}${ext}`;

            console.log(`  Uploading to GridFS as: ${filename}`);
            const uploadStream = bucket.openUploadStream(filename, {
              contentType: contentType,
              metadata: { originalUrl: url, migrated: true, collection: collName }
            });

            await new Promise((resolve, reject) => {
              uploadStream.on('error', reject);
              uploadStream.on('finish', resolve);
              uploadStream.end(Buffer.from(response.data));
            });

            changed = true;
            return `/api/images/${filename}`;
          } catch (err) {
            console.error(`    Failed to migrate ${url}: ${err.message}`);
            return url; // Keep old URL on failure
          }
        };

        // Handle various fields
        if (doc.images && Array.isArray(doc.images)) {
          const newImages = [];
          for (const u of doc.images) {
            newImages.push(await processUrl(u));
          }
          if (JSON.stringify(newImages) !== JSON.stringify(doc.images)) {
            updates.images = newImages;
            changed = true;
          }
        }

        if (doc.image) {
          const newUrl = await processUrl(doc.image);
          if (newUrl !== doc.image) {
            updates.image = newUrl;
            changed = true;
          }
        }

        if (doc.image_url) {
          const newUrl = await processUrl(doc.image_url);
          if (newUrl !== doc.image_url) {
            updates.image_url = newUrl;
            changed = true;
          }
        }

        if (doc.image_urls && Array.isArray(doc.image_urls)) {
          const newImageUrls = [];
          for (const u of doc.image_urls) {
            newImageUrls.push(await processUrl(u));
          }
          if (JSON.stringify(newImageUrls) !== JSON.stringify(doc.image_urls)) {
            updates.image_urls = newImageUrls;
            changed = true;
          }
        }

        if (doc.video_url) {
          const newUrl = await processUrl(doc.video_url);
          if (newUrl !== doc.video_url) {
            updates.video_url = newUrl;
            changed = true;
          }
        }

        if (changed) {
          await coll.updateOne({ _id: doc._id }, { $set: updates });
          console.log(`    Updated document ${doc.id || doc._id}`);
        }
      }
    }

    console.log('Asset migration complete.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.close();
  }
}

migrateAssets();
