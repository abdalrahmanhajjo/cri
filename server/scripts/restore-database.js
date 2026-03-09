#!/usr/bin/env node
/**
 * Restore the database from the canonical SQL file (supabase-export.sql).
 * This replaces the public schema with the schema and data from that file.
 *
 * Uses DATABASE_URL from server/.env (or .env in project root).
 *
 * Usage (from project root or server):
 *   npm run db:restore
 *   node server/scripts/restore-database.js
 *
 * WARNING: This drops and recreates tables in the public schema. All current
 * data in those tables will be lost and replaced by the export file.
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL in .env.');
  process.exit(1);
}

const sqlPath = path.join(__dirname, 'supabase-export.sql');
if (!fs.existsSync(sqlPath)) {
  console.error('Not found:', sqlPath, '\nRun "npm run export-sql" first or ensure the file exists.');
  process.exit(1);
}

async function restore() {
  const { Pool } = require('pg');
  let conn = connectionString;
  const isSupabase = conn.includes('supabase');
  if (conn && isSupabase) {
    try {
      const url = new URL(conn);
      url.searchParams.delete('sslmode');
      conn = url.toString();
    } catch (_) { /* keep original */ }
  }
  const pool = new Pool({
    connectionString: conn,
    ssl: isSupabase ? { rejectUnauthorized: false } : false
  });

  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Restoring from', sqlPath, '...');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Restore completed. Database now matches supabase-export.sql');
  } finally {
    client.release();
    await pool.end();
  }
}

restore().catch((err) => {
  console.error(err);
  process.exit(1);
});
