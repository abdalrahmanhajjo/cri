const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const hash1 = await bcrypt.hash('adminpass', 12);
    const hash2 = await bcrypt.hash('password123', 12);

    // check if exist
    for (const email of ['admin@example.com', 'test@example.com']) {
      await pool.query('DELETE FROM profiles WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [email]);
      await pool.query('DELETE FROM users WHERE email = $1', [email]);
    }

    // Insert admin
    const r1 = await pool.query(`INSERT INTO users (email, password_hash, name, auth_provider, email_verified, is_admin) VALUES ($1, $2, $3, 'email', true, true) RETURNING id`, ['admin@example.com', hash1, 'Admin User']);
    await pool.query(`INSERT INTO profiles (user_id, username, onboarding_completed) VALUES ($1, $2, true)`, [r1.rows[0].id, 'admin']);

    // Insert test
    const r2 = await pool.query(`INSERT INTO users (email, password_hash, name, auth_provider, email_verified, is_admin) VALUES ($1, $2, $3, 'email', true, false) RETURNING id`, ['test@example.com', hash2, 'Test User']);
    await pool.query(`INSERT INTO profiles (user_id, username, onboarding_completed) VALUES ($1, $2, true)`, [r2.rows[0].id, 'test']);

    console.log('Seeded successfully!');
  } catch (err) {
    console.error('ERROR SEEDING:', err);
  } finally {
    await pool.end();
  }
}
main();
