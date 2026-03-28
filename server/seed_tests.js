const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  try {
    const users = [
      { email: 'admin@example.com', password: 'adminpass', name: 'Admin User', isAdmin: true },
      { email: 'test@example.com', password: 'password123', name: 'Test User', isAdmin: false }
    ];

    for (const u of users) {
      console.log(`Seeding ${u.email}...`);
      const hash = await bcrypt.hash(u.password, 12);
      
      // Insert user
      const userRes = await pool.query(
        'INSERT INTO users (email, password_hash, name, auth_provider, email_verified, is_admin) VALUES ($1, $2, $3, \'email\', true, $4) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_admin = EXCLUDED.is_admin RETURNING id',
        [u.email, hash, u.name, u.isAdmin]
      );
      const userId = userRes.rows[0].id;

      // Insert/Update profile
      const username = u.email.split('@')[0];
      await pool.query(
        'INSERT INTO profiles (user_id, username, onboarding_completed) VALUES ($1, $2, true) ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, onboarding_completed = true',
        [userId, username]
      );
    }
    console.log('Seeding completed successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await pool.end();
  }
}

seed();
