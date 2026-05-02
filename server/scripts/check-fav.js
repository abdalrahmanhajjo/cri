const { getCollection } = require('../src/mongo');

async function run() {
  try {
    const favsColl = await getCollection('saved_places');
    const rows = await favsColl.find({ 
      $or: [
        { place_id: 'khan_al_saboun' },
        { place_id: 'Khan al-Saboun' },
        { place_id: 'Khan al-Saboun'.toLowerCase() }
      ] 
    }).toArray();
    console.log('Saved places matching Khan al-Saboun:');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
