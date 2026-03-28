const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkUsers() {
  try {
    const res = await pool.query('SELECT email, is_admin FROM users WHERE email IN ($1, $2)', ['admin@example.com', 'test@example.com']);
    console.log('Found users:', res.rows);
    if (res.rows.length === 0) {
      console.log('NO TEST USERS FOUND!');
    }
  } catch (err) {
    console.error('Error checking users:', err);
  } finally {
    await pool.end();
  }
}

checkUsers();
