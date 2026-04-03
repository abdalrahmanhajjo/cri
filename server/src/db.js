const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('Warning: DATABASE_URL not set in .env');
}

let pool = null;

function getPool() {
  if (pool) return pool;

  let conn = connectionString;
  const isSupabase = conn && conn.includes('supabase');
  if (conn && isSupabase) {
    try {
      const url = new URL(conn);
      url.searchParams.delete('sslmode');
      conn = url.toString();
    } catch (_) {}
  }

  pool = new Pool({
    connectionString: conn,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return pool;
}

module.exports = {
  query: (text, params) => getPool().query(text, params),
  getPool,
  closePool: () => {
    if (pool) {
      const p = pool;
      pool = null;
      return p.end();
    }
    return Promise.resolve();
  },
};
