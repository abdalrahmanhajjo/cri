/**
 * Delete places that are restaurants or hotels/lodging from MongoDB `places`.
 * Usage: node server/scripts/delete-restaurant-hotel-places.js
 * Requires MONGODB_URI in server/.env (same as the API).
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { getCollection, closeMongoClient, hasMongoConfigured } = require("../src/mongo");

function lodgingRegex() {
  return /hotel|hotels|hostel|guest\s*house|guesthouse|lodging|accommodation|resort|motel|bnb|b\s*&\s*b|فندق|إقامة/i;
}

function foodRegex() {
  return /restaurant|dining|cafe|café|coffee|bakery|meal|food|مطعم|مأكولات/i;
}

async function main() {
  if (!hasMongoConfigured()) {
    console.error("MONGODB_URI is not set. Add it to server/.env and run again.");
    process.exit(1);
  }

  const coll = await getCollection("places");
  const filter = {
    $or: [
      { categoryId: { $in: ["dining", "hotels", "hotel", "restaurants", "restaurant"] } },
      { category: foodRegex() },
      { category: lodgingRegex() },
{ diningProfile: { $exists: true, $ne: null } },
    ],
  };

  const preview = await coll.find(filter).project({ id: 1, name: 1, category: 1, categoryId: 1 }).limit(50).toArray();
  console.log(`Matched at least ${preview.length} (showing up to 50):`);
  preview.forEach((d) => console.log(`  ${d.id || d._id}  ${d.name}  [${d.categoryId || ""}] ${d.category || ""}`));

  const res = await coll.deleteMany(filter);
  console.log(`Deleted ${res.deletedCount} place document(s).`);
  await closeMongoClient();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await closeMongoClient();
  } catch (_) {}
  process.exit(1);
});
