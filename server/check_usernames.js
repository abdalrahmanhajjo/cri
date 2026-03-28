const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function check() {
  const res = await pool.query('SELECT username FROM profiles WHERE username IN ($1, $2)', ['admin', 'test']);
  console.log('Taken usernames:', res.rows);
  await pool.end();
}
check();
