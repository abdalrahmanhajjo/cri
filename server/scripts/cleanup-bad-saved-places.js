/**
 * One-off: remove saved_places rows where id or place_id was stored as the string "undefined" / "null".
 * Usage (from repo root): node server/scripts/cleanup-bad-saved-places.js
 * Requires MONGODB_URI in server/.env (same as the API).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { getCollection, closeMongoClient, hasMongoConfigured } = require('../src/mongo');

async function main() {
  if (!hasMongoConfigured()) {
    console.error('MONGODB_URI is not set. Add it to server/.env and run this script again.');
    process.exit(1);
  }

  const coll = await getCollection('saved_places');
  const filter = {
    $or: [
      { id: 'undefined' },
      { id: 'null' },
      { place_id: 'undefined' },
      { place_id: 'null' },
    ],
  };

  const toRemove = await coll.find(filter).project({ _id: 1, id: 1, place_id: 1, user_id: 1 }).toArray();
  console.log(`Found ${toRemove.length} bad document(s):`);
  toRemove.forEach((d) => {
    console.log(`  _id=${d._id} id=${JSON.stringify(d.id)} place_id=${JSON.stringify(d.place_id)} user_id=${d.user_id}`);
  });

  const res = await coll.deleteMany(filter);
  console.log(`Deleted ${res.deletedCount} document(s).`);
  await closeMongoClient();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await closeMongoClient();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
