/**
 * Auth abuse counters: login/forgot/reset windows + verification email cooldown.
 * Uses MongoDB when AUTH_ABUSE_STORE is not "memory".
 * Falls back to in-memory Maps for local dev when AUTH_ABUSE_STORE=memory.
 */
const { getCollection } = require('../mongo');

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
  return process.env.AUTH_ABUSE_STORE === 'memory';
}

function normKey(k) {
  if (k == null) return 'unknown';
  const s = String(k);
  return s.length > 500 ? s.slice(0, 500) : s;
}

/* ---------- in-memory fallback ---------- */
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

/* ---------- MongoDB storage ---------- */

async function mongoRecordWindowed(kind, bucketKey) {
  const key = normKey(bucketKey);
  const coll = await getCollection('auth_abuse_tracking');
  const now = new Date();
  
  // Find current state
  const doc = await coll.findOne({ bucket_key: key, kind: kind });
  
  if (!doc) {
    await coll.insertOne({
      bucket_key: key,
      kind: kind,
      window_start: now,
      hit_count: 1
    });
  } else {
    const ws = new Date(doc.window_start).getTime();
    if (Date.now() - ws > WINDOW_MS) {
      await coll.updateOne(
        { _id: doc._id },
        { $set: { window_start: now, hit_count: 1 } }
      );
    } else {
      await coll.updateOne(
        { _id: doc._id },
        { $inc: { hit_count: 1 } }
      );
    }
  }
}

async function mongoCheckWindowed(kind, bucketKey, max) {
  const key = normKey(bucketKey);
  const coll = await getCollection('auth_abuse_tracking');
  const doc = await coll.findOne({ bucket_key: key, kind: kind });
  
  if (!doc) return { ok: true };
  
  const hitCount = Number(doc.hit_count) || 0;
  const start = new Date(doc.window_start).getTime();
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
    return await mongoCheckWindowed(KIND_LOGIN, ip, MAX_LOGIN);
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
    await mongoRecordWindowed(KIND_LOGIN, ip);
  } catch (e) {
    console.error('[authAbuse] recordFailedLoginAttempt:', e.message);
  }
}

async function checkForgotRateLimit(ip) {
  if (useMemory()) return memCheck(memForgot, ip, MAX_FORGOT);
  try {
    return await mongoCheckWindowed(KIND_FORGOT, ip, MAX_FORGOT);
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
    await mongoRecordWindowed(KIND_FORGOT, ip);
  } catch (e) {
    console.error('[authAbuse] recordForgotPasswordAttempt:', e.message);
  }
}

async function checkResetRateLimit(resetKey) {
  if (useMemory()) return memCheck(memReset, resetKey, MAX_RESET);
  try {
    return await mongoCheckWindowed(KIND_RESET, resetKey, MAX_RESET);
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
    await mongoRecordWindowed(KIND_RESET, resetKey);
  } catch (e) {
    console.error('[authAbuse] recordResetPasswordAttempt:', e.message);
  }
}

async function clearResetPasswordAttempts(resetKey) {
  const key = normKey(resetKey);
  if (useMemory()) {
    memReset.delete(key);
    return;
  }
  try {
    const coll = await getCollection('auth_abuse_tracking');
    await coll.deleteOne({ bucket_key: key, kind: KIND_RESET });
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
    const coll = await getCollection('auth_abuse_tracking');
    const doc = await coll.findOne({ bucket_key: k, kind: KIND_VERIF });
    if (!doc) return true;
    const last = new Date(doc.window_start).getTime();
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
    const coll = await getCollection('auth_abuse_tracking');
    await coll.updateOne(
      { bucket_key: k, kind: KIND_VERIF },
      { $set: { window_start: new Date(), hit_count: 1 } },
      { upsert: true }
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
