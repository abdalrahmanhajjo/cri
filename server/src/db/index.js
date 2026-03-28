const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

let connectionString = process.env.DATABASE_URL || '';
const isSupabase = connectionString.includes('supabase');
const isProd = process.env.NODE_ENV === 'production';
const acceptSelfSigned = !isProd || process.env.DB_ACCEPT_SELF_SIGNED === '1';
/** Supabase + node-pg in Docker/cloud often hits SELF_SIGNED_CERT_IN_CHAIN; TLS is still on. Set DB_VERIFY_SSL=1 to enforce full chain verify. */
const verifySupabaseCertChain =
  process.env.DB_VERIFY_SSL === '1' || process.env.DB_VERIFY_SSL === 'true';

if (connectionString) {
  try {
    const url = new URL(connectionString);
    const host = url.hostname || '';
    const port = url.port || '';
    if (isProd && !isSupabase && !acceptSelfSigned) {
      url.searchParams.set('sslmode', 'verify-full');
    }
    // Supabase: do not pass sslmode on the URL — pg-connection-string maps
    // sslmode=require to verify-full and verifies the chain (SELF_SIGNED_CERT_IN_CHAIN).
    // TLS is enabled via Pool `ssl` below.
    if (isSupabase) {
      url.searchParams.delete('sslmode');
    }
    // Transaction pooler (port 6543 / *.pooler.supabase.com): node-pg needs pgbouncer=true.
    // Direct connection (db.*.supabase.co:5432): do NOT set pgbouncer — connects straight to Postgres.
    const usePgBouncer = host.includes('pooler.supabase.com') || port === '6543';
    if (isSupabase) {
      if (usePgBouncer) {
        url.searchParams.set('pgbouncer', 'true');
      } else {
        url.searchParams.delete('pgbouncer');
      }
    }
    connectionString = url.toString();
  } catch (_) { /* keep original */ }
}

const usePgBouncerForPool =
  isSupabase &&
  connectionString &&
  (connectionString.includes('pooler.supabase.com') || connectionString.includes(':6543'));

const poolMax = process.env.DB_POOL_SIZE
  ? parseInt(process.env.DB_POOL_SIZE, 10)
  : isSupabase
    ? usePgBouncerForPool
      ? 10
      : 15
    : 20;

const pool = new Pool({
  connectionString: connectionString || undefined,
  max: poolMax,
  min: isSupabase ? 0 : 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  statement_timeout: 15000,
  allowExitOnIdle: false,
  ssl: isSupabase
    ? {
        rejectUnauthorized: verifySupabaseCertChain,
      }
    : isProd
      ? { rejectUnauthorized: !acceptSelfSigned }
      : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

/** One-shot check after server boot; does not block listen. */
async function verifyDatabaseConnection() {
  if (!connectionString) {
    console.warn('Database: DATABASE_URL is not set.');
    return;
  }
  try {
    await pool.query('SELECT 1');
    console.log('Database: connection OK.');
  } catch (e) {
    const msg = String(e.message || e);
    console.error('\n--- Database connection failed ---');
    if (msg.includes('Circuit breaker') || e.code === 'XX000') {
      if (msg.includes('Failed to retrieve database credentials')) {
        console.error(
          'Supabase could not hand out DB credentials (often: project is paused, or a temporary Supabase-side issue).'
        );
        console.error(
          'Check: Dashboard → open your project → if it says Paused, click Restore. Wait until the project is Active.'
        );
        console.error('Then: Project Settings → Database → copy a fresh connection URI (Direct or Session pooler) into server/.env as DATABASE_URL.');
        console.error('See https://status.supabase.com if everything looks active but this persists.');
      } else if (
        msg.includes('Unable to establish connection to upstream') ||
        msg.includes('upstream database')
      ) {
        console.error(
          'Supabase’s pooler could not open a connection to your Postgres instance (upstream). This is not the same as a wrong password.'
        );
        console.error(
          'Try: Dashboard → ensure project is Active (Restore if paused) → wait 2–5 minutes after restore. Switch DATABASE_URL to the other mode (Session pooler vs Direct) from Project Settings → Database.'
        );
        console.error('If it persists: https://status.supabase.com and Supabase support.');
      } else if (msg.includes('Too many authentication') || msg.includes('authentication errors')) {
        console.error(
          'Supabase is blocking new connections after too many failed logins (wrong password or wrong pooler user).'
        );
        console.error('Fix: Supabase → Project Settings → Database → copy "Direct connection" or "Session pooler" URI into server/.env as DATABASE_URL.');
        console.error(
          'Use the database user password (URL-encode: @ %40, ! %21, # %23). Then wait ~15 minutes if the circuit breaker was tripped, restart the API.'
        );
      } else {
        console.error('Supabase returned a circuit breaker / XX000 error. Check project status, connection string, and https://status.supabase.com');
      }
    } else if (msg.includes('ENOTFOUND') && msg.includes('db.') && msg.includes('supabase.co')) {
      console.error(
        'Your PC could not resolve the Supabase Direct hostname (db.*.supabase.co). Use Session pooler instead:'
      );
      console.error(
        'Project Settings → Database → copy the Session pooler URI (user postgres.<project-ref>, host *.pooler.supabase.com, port 6543).'
      );
    } else if (/password|authentication/i.test(msg)) {
      console.error('Authentication failed — check DATABASE_URL matches Supabase (user + password).');
    }
    console.error('Detail:', msg);
    console.error('--------------------------------\n');
  }
}

/**
 * Run parameterized SQL only: use $1, $2, … for values — never concatenate user input into `text`.
 */
function query(text, params) {
  return pool.query(text, params);
}

function closePool() {
  return pool.end();
}

module.exports = { pool, query, verifyDatabaseConnection, closePool };
