const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function countUnique() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: placeCount } = await pool.query('SELECT COUNT(DISTINCT place_id) FROM place_translations');
    const { rows: catCount } = await pool.query('SELECT COUNT(DISTINCT category_id) FROM category_translations');
    
    console.log(`Unique place_ids in PG translations: ${placeCount[0].count}`);
    console.log(`Unique category_ids in PG translations: ${catCount[0].count}`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

countUnique();
