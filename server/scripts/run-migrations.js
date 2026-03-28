#!/usr/bin/env node
/**
 * Run SQL files in server/migrations/ in lexical order (001_, 002_, …).
 * Uses DATABASE_URL from .env (project root or server/).
 *
 * Records each successfully applied file in schema_migrations so deploys are idempotent.
 * Re-run everything: FORCE_MIGRATIONS=1 npm run db:migrate --prefix server
 *
 * Usage: npm run db:migrate --prefix server
 *    or: npm run db:migrate (from repo root)
 *    or: node server/scripts/run-migrations.js
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL in .env (server/.env or project root .env).');
  process.exit(1);
}

const forceAll = ['1', 'true', 'yes'].includes(String(process.env.FORCE_MIGRATIONS || '').toLowerCase());

const migrationsDir = path.join(__dirname, '../migrations');

function createPool() {
  const { Pool } = require('pg');
  let conn = connectionString;
  const isSupabase = conn.includes('supabase');
  if (conn && isSupabase) {
    try {
      const url = new URL(conn);
      url.searchParams.delete('sslmode');
      conn = url.toString();
    } catch {
      void 0; /* keep connection string */
    }
  }
  return new Pool({
    connectionString: conn,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
  });
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function isApplied(client, name) {
  const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
  return rows.length > 0;
}

async function markApplied(client, name) {
  await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
}

async function main() {
  if (!fs.existsSync(migrationsDir)) {
    console.error('Migrations directory not found:', migrationsDir);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No .sql files in', migrationsDir);
    process.exit(0);
  }

  const pool = createPool();
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);

    let ran = 0;
    let skipped = 0;

    for (const file of files) {
      const full = path.join(migrationsDir, file);
      const sql = fs.readFileSync(full, 'utf8');

      if (!forceAll && (await isApplied(client, file))) {
        console.log(`○ ${file} (already applied, skip)`);
        skipped += 1;
        continue;
      }

      process.stdout.write(`→ ${file} … `);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        if (!forceAll) {
          await markApplied(client, file);
        } else {
          await client.query(
            `INSERT INTO schema_migrations (name) VALUES ($1)
             ON CONFLICT (name) DO UPDATE SET applied_at = NOW()`,
            [file]
          );
        }
        await client.query('COMMIT');
        console.log('ok');
        ran += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    const suffix = forceAll ? ' (FORCE_MIGRATIONS: all statements re-executed)' : '';
    console.log(`\nDone: ${ran} file(s) applied, ${skipped} skipped.${suffix}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message || err);
  if (err.position) console.error('(position:', err.position + ')');
  process.exit(1);
});
