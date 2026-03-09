const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

let connectionString = process.env.DATABASE_URL || '';
const isSupabase = connectionString.includes('supabase');
const isProd = process.env.NODE_ENV === 'production';
const acceptSelfSigned = !isProd || process.env.DB_ACCEPT_SELF_SIGNED === '1';

if (connectionString) {
  try {
    const url = new URL(connectionString);
    if (isProd && !acceptSelfSigned) {
      url.searchParams.set('sslmode', 'verify-full');
    } else {
      url.searchParams.delete('sslmode');
    }
    connectionString = url.toString();
  } catch (_) { /* keep original */ }
}

const pool = new Pool({
  connectionString: connectionString || undefined,
  max: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE, 10) : 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  statement_timeout: 15000,
  allowExitOnIdle: true,
  ssl: isSupabase
    ? { rejectUnauthorized: !acceptSelfSigned }
    : isProd
      ? { rejectUnauthorized: true }
      : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

module.exports = { pool, query: (text, params) => pool.query(text, params) };
