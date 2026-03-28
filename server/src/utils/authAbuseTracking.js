/**
 * Auth abuse counters: login/forgot/reset windows + verification email cooldown.
 * Uses Postgres when DATABASE_URL is set and AUTH_ABUSE_STORE is not "memory".
 * Falls back to in-memory Maps for local dev without DB or when AUTH_ABUSE_STORE=memory.
 */
const { pool } = require('../db');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN = 5;
const MAX_FORGOT = 3;
const MAX_RESET = 12;
const VERIFICATION_RESEND_MS = 90 * 1000;

const KIND_LOGIN = 'login_ip';
const KIND_FORGOT = 'forgot_ip';
const KIND_RESET = 'reset_key';
const KIND_VERIF = 'verification_email';

function useMemory() {
  return (
    process.env.AUTH_ABUSE_STORE === 'memory' ||
    !process.env.DATABASE_URL?.trim()
  );
}

function normKey(k) {
  if (k == null) return 'unknown';
  const s = String(k);
  return s.length > 500 ? s.slice(0, 500) : s;
}

/* ---------- in-memory fallback (same semantics as before) ---------- */
const memLogin = new Map();
const memForgot = new Map();
const memReset = new Map();
const memVerifSent = new Map();

function memCheck(map, ip, max) {
  const now = Date.now();
  const entry = map.get(ip);
  if (!entry) return { ok: true };
  if (now - entry.firstAttempt > WINDOW_MS) {
    map.delete(ip);
    return { ok: true };
  }
  if (entry.count >= max) {
    return { ok: false, retryAfter: Math.ceil((entry.firstAttempt + WINDOW_MS - now) / 1000) };
  }
  return { ok: true };
}

function memRecord(map, ip) {
  const now = Date.now();
  const entry = map.get(ip);
  if (!entry) map.set(ip, { count: 1, firstAttempt: now });
  else if (now - entry.firstAttempt <= WINDOW_MS) entry.count++;
  else map.set(ip, { count: 1, firstAttempt: now });
}

async function txRecordWindowed(kind, bucketKey) {
  const key = normKey(bucketKey);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT hit_count, window_start FROM auth_abuse_tracking WHERE bucket_key = $1 AND kind = $2 FOR UPDATE`,
      [key, kind]
    );
    const now = Date.now();
    if (!r.rows.length) {
      await client.query(
        `INSERT INTO auth_abuse_tracking (bucket_key, kind, window_start, hit_count) VALUES ($1, $2, NOW(), 1)`,
        [key, kind]
      );
    } else {
      const ws = new Date(r.rows[0].window_start).getTime();
      if (now - ws > WINDOW_MS) {
        await client.query(
          `UPDATE auth_abuse_tracking SET window_start = NOW(), hit_count = 1 WHERE bucket_key = $1 AND kind = $2`,
          [key, kind]
        );
      } else {
        await client.query(
          `UPDATE auth_abuse_tracking SET hit_count = hit_count + 1 WHERE bucket_key = $1 AND kind = $2`,
          [key, kind]
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

async function dbCheckWindowed(kind, bucketKey, max) {
  const key = normKey(bucketKey);
  const { rows } = await pool.query(
    `SELECT hit_count, window_start FROM auth_abuse_tracking WHERE bucket_key = $1 AND kind = $2`,
    [key, kind]
  );
  if (!rows.length) return { ok: true };
  const hitCount = Number(rows[0].hit_count) || 0;
  const start = new Date(rows[0].window_start).getTime();
  const now = Date.now();
  if (now - start > WINDOW_MS) return { ok: true };
  if (hitCount >= max) {
    return { ok: false, retryAfter: Math.ceil((start + WINDOW_MS - now) / 1000) };
  }
  return { ok: true };
}

async function checkLoginRateLimit(ip) {
  if (useMemory()) return memCheck(memLogin, ip, MAX_LOGIN);
  try {
    return await dbCheckWindowed(KIND_LOGIN, ip, MAX_LOGIN);
  } catch (e) {
    console.error('[authAbuse] checkLoginRateLimit:', e.message);
    return { ok: true };
  }
}

async function recordFailedLoginAttempt(ip) {
  if (useMemory()) {
    memRecord(memLogin, ip);
    return;
  }
  try {
    await txRecordWindowed(KIND_LOGIN, ip);
  } catch (e) {
    console.error('[authAbuse] recordFailedLoginAttempt:', e.message);
  }
}

async function checkForgotRateLimit(ip) {
  if (useMemory()) return memCheck(memForgot, ip, MAX_FORGOT);
  try {
    return await dbCheckWindowed(KIND_FORGOT, ip, MAX_FORGOT);
  } catch (e) {
    console.error('[authAbuse] checkForgotRateLimit:', e.message);
    return { ok: true };
  }
}

async function recordForgotPasswordAttempt(ip) {
  if (useMemory()) {
    memRecord(memForgot, ip);
    return;
  }
  try {
    await txRecordWindowed(KIND_FORGOT, ip);
  } catch (e) {
    console.error('[authAbuse] recordForgotPasswordAttempt:', e.message);
  }
}

async function checkResetRateLimit(resetKey) {
  if (useMemory()) return memCheck(memReset, resetKey, MAX_RESET);
  try {
    return await dbCheckWindowed(KIND_RESET, resetKey, MAX_RESET);
  } catch (e) {
    console.error('[authAbuse] checkResetRateLimit:', e.message);
    return { ok: true };
  }
}

async function recordResetPasswordAttempt(resetKey) {
  if (useMemory()) {
    memRecord(memReset, resetKey);
    return;
  }
  try {
    await txRecordWindowed(KIND_RESET, resetKey);
  } catch (e) {
    console.error('[authAbuse] recordResetPasswordAttempt:', e.message);
  }
}

async function clearResetPasswordAttempts(resetKey) {
  if (useMemory()) {
    memReset.delete(resetKey);
    return;
  }
  try {
    await pool.query('DELETE FROM auth_abuse_tracking WHERE bucket_key = $1 AND kind = $2', [
      normKey(resetKey),
      KIND_RESET,
    ]);
  } catch (e) {
    console.error('[authAbuse] clearResetPasswordAttempts:', e.message);
  }
}

async function canSendVerificationEmailNow(email) {
  const k = normKey((email || '').toLowerCase());
  if (useMemory()) {
    const t = memVerifSent.get(k);
    if (t && Date.now() - t < VERIFICATION_RESEND_MS) return false;
    return true;
  }
  try {
    const { rows } = await pool.query(
      `SELECT window_start FROM auth_abuse_tracking WHERE bucket_key = $1 AND kind = $2`,
      [k, KIND_VERIF]
    );
    if (!rows.length) return true;
    const last = new Date(rows[0].window_start).getTime();
    return Date.now() - last >= VERIFICATION_RESEND_MS;
  } catch (e) {
    console.error('[authAbuse] canSendVerificationEmailNow:', e.message);
    return true;
  }
}

async function markVerificationEmailSent(email) {
  const k = normKey((email || '').toLowerCase());
  if (useMemory()) {
    memVerifSent.set(k, Date.now());
    return;
  }
  try {
    await pool.query(
      `INSERT INTO auth_abuse_tracking (bucket_key, kind, window_start, hit_count)
       VALUES ($1, $2, NOW(), 1)
       ON CONFLICT (bucket_key, kind) DO UPDATE SET window_start = NOW(), hit_count = 1`,
      [k, KIND_VERIF]
    );
  } catch (e) {
    console.error('[authAbuse] markVerificationEmailSent:', e.message);
  }
}

module.exports = {
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  checkForgotRateLimit,
  recordForgotPasswordAttempt,
  checkResetRateLimit,
  recordResetPasswordAttempt,
  clearResetPasswordAttempts,
  canSendVerificationEmailNow,
  markVerificationEmailSent,
};
