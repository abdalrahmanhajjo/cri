const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkPgTranslations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  try {
    const tables = [
      'place_translations',
      'category_translations',
      'tour_translations',
      'event_translations',
      'interest_translations'
    ];

    for (const table of tables) {
      try {
        const { rows } = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`Table: ${table}`);
        console.log(`  Count: ${rows[0].count}`);
      } catch (e) {
        console.log(`Table: ${table} - Error: ${e.message}`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkPgTranslations();
