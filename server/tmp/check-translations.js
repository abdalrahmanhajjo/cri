const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkTranslations() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const dbName = process.env.MONGODB_DB_NAME || 'visittripoli';
    const db = client.db(dbName);

    const collections = ['places', 'tours', 'events', 'categories', 'interests'];
    
    for (const collName of collections) {
      const coll = db.collection(collName);
      const countTotal = await coll.countDocuments();
      const countWithTrans = await coll.countDocuments({ translations: { $exists: true, $ne: {} } });
      const sample = await coll.findOne({ translations: { $exists: true, $ne: {} } }); 
      
      console.log(`Collection: ${collName}`);
      console.log(`  Total docs: ${countTotal}`);
      console.log(`  Docs with translations: ${countWithTrans}`);
      
      if (sample && sample.translations) {
        const langs = Object.keys(sample.translations).filter(l => l && sample.translations[l]);
        console.log(`  Sample languages: ${langs.join(', ')}`);
        if (langs.length > 0) {
          const firstLang = langs[0];
          console.log(`  Sample doc id: ${sample.id}`);
          console.log(`  Sample [${firstLang}] name: ${sample.translations[firstLang].name || 'N/A'}`);
        }
      } else if (countWithTrans === 0) {
        console.log(`  WARNING: No translations found in this collection!`);
      }
      console.log('');
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

checkTranslations();
