const { getCollection, mongoDbName } = require('../src/mongo');

async function run() {
  console.log(`Inspecting database: ${mongoDbName()}`);
  try {
    const favsColl = await getCollection('saved_places');
    const count = await favsColl.countDocuments();
    console.log(`Total saved places in DB: ${count}`);
    
    if (count > 0) {
      const sample = await favsColl.find().limit(5).toArray();
      console.log('Sample documents:');
      console.log(JSON.stringify(sample, null, 2));
      
      const distinctUsers = await favsColl.distinct('user_id');
      console.log(`Unique users with saved places: ${distinctUsers.length}`);
      
      const distinctPlaces = await favsColl.distinct('place_id');
      console.log(`Unique places saved: ${distinctPlaces.length}`);
      
      // Check types
      const types = await favsColl.aggregate([
        { $project: { place_id_type: { $type: '$place_id' }, user_id_type: { $type: '$user_id' } } },
        { $group: { _id: { p: '$place_id_type', u: '$user_id_type' }, count: { $sum: 1 } } }
      ]).toArray();
      console.log('Type breakdown:', JSON.stringify(types, null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

run();
