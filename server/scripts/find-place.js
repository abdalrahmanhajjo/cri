const { getCollection } = require('../src/mongo');

async function run() {
  try {
    const places = await getCollection('places');
    const p = await places.findOne({ 
      $or: [
        { name: 'Khan al-Saboun' },
        { name: 'Khan al-Saboun'.toLowerCase() },
        { searchName: 'khan_al_saboun' }
      ] 
    });
    console.log('Place doc:');
    console.log(JSON.stringify(p, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
