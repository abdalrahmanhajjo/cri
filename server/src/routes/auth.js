const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db');
const { validatePassword } = require('../utils/passwordValidator');
const { validateUsername } = require('../utils/usernameValidator');
const {
  sendPasswordResetCode,
  sendVerificationCode,
  RESET_LINK_EXPIRY_MINUTES,
  VERIFICATION_LINK_EXPIRY_MINUTES,
  isSmtpConfigured,
} = require('../services/emailService');

const { validate } = require('../middleware/validation');
const { 
  loginSchema, 
  registerSchema, 
  resetPasswordRequestSchema, 
  resetPasswordConfirmSchema 
} = require('../schemas/auth');

const router = express.Router();
const loginAttempts = new Map();
const forgotAttempts = new Map();
const resetAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const FORGOT_MAX_ATTEMPTS = 3;
const RESET_MAX_ATTEMPTS = 12;
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

function checkResetRateLimit(key) {
  const now = Date.now();
  const entry = resetAttempts.get(key);
  if (!entry) return { ok: true };
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
    resetAttempts.delete(key);
    return { ok: true };
  }
  if (entry.count >= RESET_MAX_ATTEMPTS) {
    return { ok: false, retryAfter: Math.ceil((entry.firstAttempt + RATE_LIMIT_WINDOW - now) / 1000) };
  }
  return { ok: true };
}

function recordResetAttempt(key) {
  const now = Date.now();
  const entry = resetAttempts.get(key);
  if (!entry) resetAttempts.set(key, { count: 1, firstAttempt: now });
  else if (now - entry.firstAttempt <= RATE_LIMIT_WINDOW) entry.count++;
  else resetAttempts.set(key, { count: 1, firstAttempt: now });
}

function clearResetAttempts(key) {
  resetAttempts.delete(key);
}

/** Cooldown per email so repeated login taps do not flood the inbox. */
const verificationEmailLastSent = new Map();
const VERIFICATION_RESEND_MS = 90 * 1000;

function canSendVerificationEmailNow(email) {
  const k = email.toLowerCase();
  const t = verificationEmailLastSent.get(k);
  if (t && Date.now() - t < VERIFICATION_RESEND_MS) return false;
  return true;
}

function markVerificationEmailSent(email) {
  verificationEmailLastSent.set(email.toLowerCase(), Date.now());
}

/** Inserts a new token row and sends mail when SMTP is configured. @returns {Promise<boolean>} true if SMTP accepted the message */
async function issueEmailVerification(userId, email) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + VERIFICATION_LINK_EXPIRY_MINUTES * 60 * 1000);
  await query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
  await query('INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [userId, tokenHash, expiresAt]);
  const { delivered } = await sendVerificationCode(email, code);
  return delivered;
}



router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const u = validateUsername(username);
    if (!u.ok) return res.status(400).json({ error: u.error });
    const taken = await query(
      `SELECT 1 FROM profiles WHERE username IS NOT NULL
       AND REGEXP_REPLACE(LOWER(TRIM(username)), '^@', '') = $1
       LIMIT 1`,
      [u.handle]
    );
    if (taken.rows.length > 0) {
      return res.status(400).json({ error: 'This username is already taken' });
    }
    const pv = validatePassword(password);
    if (!pv.valid) return res.status(400).json({ error: pv.error });
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (email, password_hash, name, auth_provider, email_verified) VALUES ($1, $2, $3, \'email\', false) RETURNING id, email, name',
      [email, hash, name || null]
    );
    const user = result.rows[0];
    await query(
      `INSERT INTO profiles (user_id, username, onboarding_completed) VALUES ($1, $2, false)
       ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username`,
      [user.id, u.stored]
    );
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_LINK_EXPIRY_MINUTES * 60 * 1000);
    await query('INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [user.id, tokenHash, expiresAt]);
    let verificationEmailDelivered = false;
    try {
      const r = await sendVerificationCode(email, code);
      verificationEmailDelivered = r.delivered;
    } catch (e) {
      console.error('[Register] Verification email failed:', e.message);
      return res.status(500).json({ error: 'Could not send verification email. Try again later.' });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      verificationEmailDelivered,
      user: {
        id: user.id,
        name: user.name || email.split('@')[0],
        username: u.stored,
        email: user.email,
        emailVerified: false,
        onboardingCompleted: false,
        isBusinessOwner: false,
        isAdmin: false,
        ownedPlaceCount: 0,
      },
    });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const rate = checkRateLimit(ip);
    if (!rate.ok) return res.status(429).json({ error: 'Too many attempts.', retryAfter: rate.retryAfter });
    const result = await query(
      `SELECT u.id, u.email, u.name, u.password_hash, u.email_verified, u.is_business_owner,
              COALESCE(u.is_admin, false) AS is_admin,
              COALESCE(u.is_blocked, false) AS is_blocked,
              COALESCE(p.onboarding_completed, false) AS onboarding_completed,
              (SELECT COUNT(*)::int FROM place_owners po WHERE po.user_id = u.id) AS owned_place_count
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1) AND u.auth_provider = 'email'`,
      [email]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      recordFailedAttempt(ip);
      return res.status(401).json({ error: 'Wrong email or password. Please try again.' });
    }
    if (user.is_blocked === true) {
      return res.status(403).json({ error: 'This account has been disabled.', code: 'ACCOUNT_BLOCKED' });
    }
    if (!user.email_verified) {
      const emailNorm = (email || '').trim().toLowerCase();
      let verificationEmailDelivered = false;
      let resendTooSoon = false;
      let emailSendFailed = false;
      if (canSendVerificationEmailNow(emailNorm)) {
        try {
          verificationEmailDelivered = await issueEmailVerification(user.id, user.email);
          if (verificationEmailDelivered) {
            markVerificationEmailSent(emailNorm);
          }
        } catch (e) {
          emailSendFailed = true;
          console.error('[Login] Verification email send failed:', e.message);
        }
      } else {
        resendTooSoon = true;
      }
      const smtpOn = isSmtpConfigured();
      let error;
      if (verificationEmailDelivered) {
        error =
          'We sent a new verification code to your email. Check your inbox (and spam), then sign in here.';
      } else if (resendTooSoon) {
        error =
          'Your email is not verified yet. A code was sent recently — check your inbox (and spam). Try again in about a minute.';
      } else if (emailSendFailed) {
        error =
          'Your email is not verified. The message could not be sent (mail server error). Try again shortly, or check the API server log for your 6-digit code.';
      } else if (!smtpOn) {
        error =
          'Your email is not verified. Outgoing email is not configured on this server. Your 6-digit code is printed in the API server log — add SMTP in the API .env to receive emails in your inbox.';
      } else {
        error =
          'Your email is not verified. Check the API server log for your 6-digit code.';
      }
      return res.status(403).json({
        error,
        code: 'EMAIL_NOT_VERIFIED',
        verificationEmailDelivered,
        resendTooSoon,
        smtpConfigured: smtpOn,
        emailSendFailed,
      });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name || email.split('@')[0],
        email: user.email,
        emailVerified: true,
        onboardingCompleted: user.onboarding_completed === true,
        isBusinessOwner: user.is_business_owner === true,
        isAdmin: user.is_admin === true,
        ownedPlaceCount: user.owned_place_count ?? 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/forgot-password', validate(resetPasswordRequestSchema), async (req, res) => {
  try {
    const { email } = req.body;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const rate = checkForgotRateLimit(ip);
    if (!rate.ok) return res.status(429).json({ error: 'Too many requests.', retryAfter: rate.retryAfter });
    recordForgotAttempt(ip);
    const expiryMs = RESET_LINK_EXPIRY_MINUTES * 60 * 1000;
    const result = await query('SELECT id FROM users WHERE LOWER(email) = $1 AND auth_provider = \'email\' AND password_hash IS NOT NULL', [email]);
    const user = result.rows[0];
    let emailDelivered = false;
    if (user) {
      await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = new Date(Date.now() + expiryMs);
      await query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [user.id, tokenHash, expiresAt]);
      try {
        const r = await sendPasswordResetCode(email, code);
        emailDelivered = r.delivered;
      } catch (e) {
        console.error('[Forgot password] Email send failed:', e.message);
        if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_CODE === 'true') {
          console.log('[Forgot password] Code (email failed; not returned to client):', code);
          return res.json({
            message: 'If an account exists for that email, a reset code was created. Email could not be sent — check the API server log if you are developing.',
            emailDelivered: false,
          });
        }
        return res.status(503).json({ error: 'Failed to send reset email. Try again later.' });
      }
    }
    const payload = {
      message: 'If an account exists for that email, we sent a 6-digit code. Check your inbox (and spam).',
    };
    if (user) payload.emailDelivered = emailDelivered;
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/reset-password', validate(resetPasswordConfirmSchema), async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const resetKey = `${ip}:${email}`;
    const rate = checkResetRateLimit(resetKey);
    if (!rate.ok) {
      return res.status(429).json({
        error: 'Too many reset attempts. Please wait before trying again.',
        retryAfter: rate.retryAfter,
      });
    }
    const pv = validatePassword(newPassword);
    if (!pv.valid) return res.status(400).json({ error: pv.error });

    const userRow = await query('SELECT id FROM users WHERE LOWER(email) = $1 AND auth_provider = \'email\' AND password_hash IS NOT NULL', [email]);
    const user = userRow.rows[0];
    if (!user) {
      recordResetAttempt(resetKey);
      return res.status(400).json({ error: 'Invalid or expired code. Request a new one.' });
    }

    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    const tokenRow = await query(
      'SELECT id FROM password_reset_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
      [user.id, tokenHash]
    );
    if (tokenRow.rows.length === 0) {
      recordResetAttempt(resetKey);
      return res.status(400).json({ error: 'Invalid or expired code. Request a new one.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    clearResetAttempts(resetKey);
    res.json({ message: 'Password has been reset. You can now sign in with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

/**
 * POST /api/auth/verify-email — same 6-digit code + DB row as the mobile app (email_verification_tokens).
 * Body: { email, code }
 */
router.post('/verify-email', async (req, res) => {
  try {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().replace(/\s/g, '') : '';
    if (!emailRaw || emailRaw.length > 254 || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Valid email and 6-digit code are required' });
    }

    const result = await query(
      `SELECT u.id, u.email, u.name, u.email_verified, u.is_business_owner,
              COALESCE(u.is_admin, false) AS is_admin,
              COALESCE(u.is_blocked, false) AS is_blocked,
              COALESCE(p.onboarding_completed, false) AS onboarding_completed,
              (SELECT COUNT(*)::int FROM place_owners po WHERE po.user_id = u.id) AS owned_place_count
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE LOWER(u.email) = $1 AND u.auth_provider = 'email'`,
      [emailRaw]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(400).json({ error: 'No account found for this email.' });
    }
    if (user.is_blocked === true) {
      return res.status(403).json({ error: 'This account has been disabled.', code: 'ACCOUNT_BLOCKED' });
    }
    if (user.email_verified === true) {
      return res.status(400).json({
        error: 'Email is already verified. Sign in with your password.',
        code: 'ALREADY_VERIFIED',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    const tok = await query(
      'SELECT id FROM email_verification_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
      [user.id, tokenHash]
    );
    if (tok.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired code. Request a new code from the sign-in screen.',
      });
    }

    await query('UPDATE users SET email_verified = true WHERE id = $1', [user.id]);
    await query('DELETE FROM email_verification_tokens WHERE user_id = $1', [user.id]);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name || emailRaw.split('@')[0],
        email: user.email,
        emailVerified: true,
        onboardingCompleted: user.onboarding_completed === true,
        isBusinessOwner: user.is_business_owner === true,
        isAdmin: user.is_admin === true,
        ownedPlaceCount: user.owned_place_count ?? 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

module.exports = router;
