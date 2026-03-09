const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db');
const { validatePassword } = require('../utils/passwordValidator');
const { sendPasswordResetCode, sendVerificationCode, RESET_LINK_EXPIRY_MINUTES, VERIFICATION_LINK_EXPIRY_MINUTES } = require('../services/emailService');

const router = express.Router();
const loginAttempts = new Map();
const forgotAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const FORGOT_MAX_ATTEMPTS = 3;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-only';

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { ok: true };
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.delete(ip);
    return { ok: true };
  }
  if (entry.count >= MAX_ATTEMPTS) return { ok: false, retryAfter: Math.ceil((entry.firstAttempt + RATE_LIMIT_WINDOW - now) / 1000) };
  return { ok: true };
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) loginAttempts.set(ip, { count: 1, firstAttempt: now });
  else if (now - entry.firstAttempt <= RATE_LIMIT_WINDOW) entry.count++;
  else loginAttempts.set(ip, { count: 1, firstAttempt: now });
}

function checkForgotRateLimit(ip) {
  const now = Date.now();
  const entry = forgotAttempts.get(ip);
  if (!entry) return { ok: true };
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW) { forgotAttempts.delete(ip); return { ok: true }; }
  if (entry.count >= FORGOT_MAX_ATTEMPTS) return { ok: false, retryAfter: Math.ceil((entry.firstAttempt + RATE_LIMIT_WINDOW - now) / 1000) };
  return { ok: true };
}

function recordForgotAttempt(ip) {
  const now = Date.now();
  const entry = forgotAttempts.get(ip);
  if (!entry) forgotAttempts.set(ip, { count: 1, firstAttempt: now });
  else if (now - entry.firstAttempt <= RATE_LIMIT_WINDOW) entry.count++;
  else forgotAttempts.set(ip, { count: 1, firstAttempt: now });
}

function sanitizeAuthInput(req, res, next) {
  const { email, password, name } = req.body || {};
  if (typeof email !== 'string' || email.length > 254) return res.status(400).json({ error: 'Invalid email' });
  if (typeof password !== 'string' || password.length > 128) return res.status(400).json({ error: 'Invalid password' });
  if (name != null && (typeof name !== 'string' || name.length > 150)) return res.status(400).json({ error: 'Invalid name' });
  next();
}

router.post('/register', sanitizeAuthInput, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const pv = validatePassword(password);
    if (!pv.valid) return res.status(400).json({ error: pv.error });
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (email, password_hash, name, auth_provider, email_verified) VALUES ($1, $2, $3, \'email\', false) RETURNING id, email, name',
      [email, hash, name || null]
    );
    const user = result.rows[0];
    await query('INSERT INTO profiles (user_id, onboarding_completed) VALUES ($1, false) ON CONFLICT (user_id) DO NOTHING', [user.id]);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_LINK_EXPIRY_MINUTES * 60 * 60 * 1000);
    await query('INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [user.id, tokenHash, expiresAt]);
    await sendVerificationCode(email, code);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name || email.split('@')[0], email: user.email, emailVerified: false, onboardingCompleted: false, isBusinessOwner: false }
    });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', sanitizeAuthInput, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const rate = checkRateLimit(ip);
    if (!rate.ok) return res.status(429).json({ error: 'Too many attempts.', retryAfter: rate.retryAfter });
    const result = await query(
      'SELECT u.id, u.email, u.name, u.password_hash, u.email_verified, u.is_business_owner, COALESCE(p.onboarding_completed, false) AS onboarding_completed FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE LOWER(u.email) = LOWER($1) AND u.auth_provider = \'email\'',
      [email]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      recordFailedAttempt(ip);
      return res.status(401).json({ error: 'Wrong email or password. Please try again.' });
    }
    if (!user.email_verified) return res.status(403).json({ error: 'Email not verified.', code: 'EMAIL_NOT_VERIFIED' });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user.id, name: user.name || email.split('@')[0], email: user.email, emailVerified: true, onboardingCompleted: user.onboarding_completed === true, isBusinessOwner: user.is_business_owner === true }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254) return res.status(400).json({ error: 'Valid email required' });
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const rate = checkForgotRateLimit(ip);
    if (!rate.ok) return res.status(429).json({ error: 'Too many requests.', retryAfter: rate.retryAfter });
    recordForgotAttempt(ip);
    const expiryMs = RESET_LINK_EXPIRY_MINUTES * 60 * 1000;
    const result = await query('SELECT id FROM users WHERE LOWER(email) = $1 AND auth_provider = \'email\' AND password_hash IS NOT NULL', [email]);
    const user = result.rows[0];
    let devCode;
    if (user) {
      await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      devCode = code;
      const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = new Date(Date.now() + expiryMs);
      await query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [user.id, tokenHash, expiresAt]);
      try {
        await sendPasswordResetCode(email, code);
      } catch (e) {
        console.error('[Forgot password] Email send failed:', e.message);
        if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_CODE === 'true') {
          console.log('[Forgot password] Dev fallback – use this code:', code);
          return res.json({ message: 'Email failed to send (dev). Use the code below.', devCode: code });
        }
        return res.status(503).json({ error: 'Failed to send reset email. Try again later.' });
      }
    }
    const isDev = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_CODE === 'true';
    const payload = { message: 'If an account exists for that email, we sent a 6-digit code. Check your inbox (and spam).' };
    if (isDev && devCode) payload.devCode = devCode;
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().replace(/\s/g, '') : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword.slice(0, 128) : '';
    if (!email || !code || code.length !== 6 || !newPassword) {
      return res.status(400).json({ error: 'Email, 6-digit code, and new password are required' });
    }
    const pv = validatePassword(newPassword);
    if (!pv.valid) return res.status(400).json({ error: pv.error });

    const userRow = await query('SELECT id FROM users WHERE LOWER(email) = $1 AND auth_provider = \'email\' AND password_hash IS NOT NULL', [email]);
    const user = userRow.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid or expired code. Request a new one.' });

    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    const tokenRow = await query(
      'SELECT id FROM password_reset_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
      [user.id, tokenHash]
    );
    if (tokenRow.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code. Request a new one.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    res.json({ message: 'Password has been reset. You can now sign in with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

module.exports = router;
