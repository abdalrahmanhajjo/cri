const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { getMongoClient, getCollection, closeMongoClient } = require('../src/mongo');
const { enrichPlace } = require('../src/ai/placeEnrichment/enrichPlace');
const { promisify } = require('util');
const setTimeoutPromise = promisify(setTimeout);

async function backfill() {
  try {
    const placesColl = await getCollection('places');
    // Find places without completed enrichment
    const placesToEnrich = await placesColl.find({ enrichment_status: { $ne: 'completed' } }).toArray();

    console.log(`Found ${placesToEnrich.length} places needing enrichment...`);

    let i = 0;
    for (const place of placesToEnrich) {
      i++;
      console.log(`[${i}/${placesToEnrich.length}] Processing ${place.id}...`);
      await enrichPlace(place.id, place);

      // Simple rate limiting (Wait 2000ms between calls to avoid 429)
      if (i < placesToEnrich.length) {
        await setTimeoutPromise(2000);
      }
    }

    console.log('Backfill finished.');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await closeMongoClient();
  }
}

backfill();
