#!/usr/bin/env node
/**
 * Export full SQL (schema + data) from your Supabase/PostgreSQL database.
 * Uses DATABASE_URL from server/.env (or .env in project root).
 *
 * Usage (from project root):
 *   node server/scripts/export-supabase-sql.js
 *
 * Output: server/scripts/supabase-export.sql
 *
 * If pg_dump is installed (PostgreSQL client tools), we use it for a complete dump.
 * Otherwise we generate CREATE TABLE + INSERT statements from the database.
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL in .env. Set it to your Supabase connection string.');
  process.exit(1);
}

const outPath = path.join(__dirname, 'supabase-export.sql');

function escapeLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  if (val instanceof Date) return '\'' + val.toISOString().replace(/'/g, '\'\'') + '\'';
  if (Buffer.isBuffer(val)) return '\'' + val.toString('hex').replace(/'/g, '\'\'') + '\'';
  if (typeof val === 'object') return '\'' + JSON.stringify(val).replace(/'/g, '\'\'') + '\'';
  const s = String(val);
  return '\'' + s.replace(/\\/g, '\\\\').replace(/'/g, '\'\'') + '\'';
}

async function exportViaPg() {
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

  const out = [];
  out.push('-- Supabase/PostgreSQL export');
  out.push('-- Generated: ' + new Date().toISOString());
  out.push('-- Schema: public');
  out.push('');

  const tablesResult = await pool.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  const tables = tablesResult.rows.map((r) => r.tablename);

  if (tables.length === 0) {
    out.push('-- No tables in public schema.');
    await pool.end();
    fs.writeFileSync(outPath, out.join('\n'), 'utf8');
    console.log('Wrote (no tables):', outPath);
    return;
  }

  for (const table of tables) {
    const safeTable = '"' + table.replace(/"/g, '""') + '"';

    const colsResult = await pool.query(
      `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );
    const columns = colsResult.rows.map((r) => r.column_name);
    const colList = columns.map((c) => '"' + c.replace(/"/g, '""') + '"').join(', ');

    const pkResult = await pool.query(
      `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) AND a.attisdropped = false
       JOIN pg_class c ON c.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = $1 AND i.indisprimary`,
      [table]
    );
    const pkCols = pkResult.rows.map((r) => r.attname).filter(Boolean);

    const typeMap = {
      integer: 'INTEGER',
      bigint: 'BIGINT',
      smallint: 'SMALLINT',
      serial: 'SERIAL',
      bigserial: 'BIGSERIAL',
      real: 'REAL',
      'double precision': 'DOUBLE PRECISION',
      numeric: 'NUMERIC',
      boolean: 'BOOLEAN',
      'character varying': 'VARCHAR',
      varchar: 'VARCHAR',
      character: 'CHAR',
      text: 'TEXT',
      date: 'DATE',
      timestamp: 'TIMESTAMP',
      'timestamp with time zone': 'TIMESTAMPTZ',
      'timestamp without time zone': 'TIMESTAMP',
      jsonb: 'JSONB',
      json: 'JSON',
      uuid: 'UUID'
    };

    out.push('-- Table: ' + table);
    out.push('DROP TABLE IF EXISTS ' + safeTable + ' CASCADE;');
    const defs = colsResult.rows.map((r) => {
      let def = '"' + r.column_name.replace(/"/g, '""') + '" ';
      const dt = (r.data_type || '').toLowerCase();
      def += typeMap[dt] || dt.toUpperCase();
      if (r.character_maximum_length) def += '(' + r.character_maximum_length + ')';
      if (r.is_nullable === 'NO') def += ' NOT NULL';
      if (r.column_default) def += ' DEFAULT ' + r.column_default;
      return def;
    });
    if (pkCols.length > 0) {
      defs.push('PRIMARY KEY (' + pkCols.map((c) => '"' + c + '"').join(', ') + ')');
    }
    out.push('CREATE TABLE ' + safeTable + ' (');
    out.push('  ' + defs.join(',\n  ') + '\n);');
    out.push('');

    const dataResult = await pool.query('SELECT * FROM ' + safeTable);
    const rows = dataResult.rows;
    if (rows.length > 0) {
      out.push('-- Data: ' + table + ' (' + rows.length + ' rows)');
      for (const row of rows) {
        const vals = columns.map((col) => escapeLiteral(row[col]));
        out.push('INSERT INTO ' + safeTable + ' (' + colList + ') VALUES (' + vals.join(', ') + ');');
      }
      out.push('');
    }
  }

  await pool.end();
  fs.writeFileSync(outPath, out.join('\n'), 'utf8');
  console.log('Exported', tables.length, 'table(s) to', outPath);
}

async function exportViaPgDump() {
  const { execSync } = require('child_process');
  const url = connectionString.replace(/^postgres:/, 'postgresql:');
  try {
    execSync(
      `pg_dump "${url}" --schema=public --no-owner --no-acl --inserts -f "${outPath}"`,
      { stdio: 'inherit', maxBuffer: 50 * 1024 * 1024 }
    );
    console.log('Exported (pg_dump) to', outPath);
  } catch (e) {
    if (e.message && e.message.includes('pg_dump')) {
      console.warn('pg_dump not found. Falling back to Node export...');
      return exportViaPg();
    }
    throw e;
  }
}

async function main() {
  const usePgDump = process.argv.includes('--pg-dump');
  if (usePgDump) {
    await exportViaPgDump();
  } else {
    await exportViaPg();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
