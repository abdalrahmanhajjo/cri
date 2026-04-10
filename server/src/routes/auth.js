const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { getCollection, getMongoDb } = require('../mongo');
const { validatePassword } = require('../utils/passwordValidator');
const { validateUsername } = require('../utils/usernameValidator');
const {
  sendPasswordResetCode,
  sendVerificationCode,
  sendWelcomeEmail,
  RESET_LINK_EXPIRY_MINUTES,
  VERIFICATION_LINK_EXPIRY_MINUTES,
  isSmtpConfigured,
} = require('../services/emailService');
const {
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  checkForgotRateLimit,
  recordForgotPasswordAttempt,
  checkResetRateLimit,
  recordResetPasswordAttempt,
  clearResetPasswordAttempts,
  canSendVerificationEmailNow,
 markVerificationEmailSent,
} = require('../utils/authAbuseTracking');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-only';

/** Inserts a new token row and sends mail when SMTP is configured. @returns {Promise<boolean>} true if SMTP accepted the message */
async function issueEmailVerification(userId, email) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + VERIFICATION_LINK_EXPIRY_MINUTES * 60 * 1000);
  
  const tokens = await getCollection('email_verification_tokens');
  await tokens.deleteOne({ user_id: userId });
  await tokens.insertOne({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt, created_at: new Date() });
  
  const { delivered } = await sendVerificationCode(email, code);
  return delivered;
}

function sanitizeAuthInput(req, res, next) {
  const { email, password, name } = req.body || {};
  if (typeof email !== 'string' || email.length > 254) return res.status(400).json({ error: 'Invalid email' });
  if (typeof password !== 'string' || password.length > 128) return res.status(400).json({ error: 'Invalid password' });
  if (name != null && (typeof name !== 'string' || name.length > 150)) return res.status(400).json({ error: 'Invalid name' });
  next();
}

/** Login accepts email or username in the `email` field (mobile/web compatibility). */
function sanitizeLoginInput(req, res, next) {
  const id = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!id || id.length > 254) return res.status(400).json({ error: 'Email or username and password required' });
  if (!password || password.length > 128) return res.status(400).json({ error: 'Invalid password' });
  next();
}

/** Allocate a unique @handle for a new Google sign-in user. */
async function pickUsernameForGoogle(users, email) {
  const localRaw = (String(email).split('@')[0] || 'user').toLowerCase();
  let sanitized = localRaw
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!sanitized.length) sanitized = 'user';
  if (!/^[a-z]/.test(sanitized)) sanitized = `u_${sanitized}`;
  sanitized = sanitized.slice(0, 24);
  if (sanitized.length < 3) sanitized = `${sanitized}usr`.slice(0, 3);

  for (let i = 0; i < 80; i += 1) {
    const candidate =
      i === 0 ? sanitized : `${sanitized.slice(0, Math.min(18, sanitized.length))}_${i}`;
    const u = validateUsername(candidate);
    if (!u.ok) continue;
    const taken = await users.findOne({ 'profile.username_normalized': u.handle });
    if (!taken) return { handle: u.handle, stored: u.stored };
  }
  for (let j = 0; j < 30; j += 1) {
    const u = validateUsername(`g_${crypto.randomBytes(4).toString('hex')}`);
    if (!u.ok) continue;
    const taken = await users.findOne({ 'profile.username_normalized': u.handle });
    if (!taken) return { handle: u.handle, stored: u.stored };
  }
  throw new Error('Could not allocate username for Google sign-in');
}

/**
 * GET /api/auth/google-public-config
 * Public OAuth web client id for Google Identity Services (same value as VITE_GOOGLE_CLIENT_ID).
 * Lets production frontends work when the static bundle was built without Vite env, as long as
 * GOOGLE_CLIENT_ID is set on this server — it is not a secret.
 */
router.get('/google-public-config', (req, res) => {
  try {
    const raw = process.env.GOOGLE_CLIENT_ID;
    const clientId = raw != null && String(raw).trim() ? String(raw).trim() : null;
    res.json({ clientId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load Google config' });
  }
});

/** GET /api/auth/check-username?username= — availability for sign-up (debounced on client). */
router.get('/check-username', async (req, res) => {
  try {
    const raw = typeof req.query.username === 'string' ? req.query.username : '';
    const u = validateUsername(raw);
    if (!u.ok) {
      return res.status(200).json({ validFormat: false, available: false, error: u.error });
    }
    
    // In MongoDB, we store normalized username for matching
    const users = await getCollection('users');
    const taken = await users.findOne({
      'profile.username_normalized': u.handle
    });
    
    res.json({ validFormat: true, available: !taken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not check username' });
  }
});

router.post('/register', sanitizeAuthInput, async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    const u = validateUsername(username);
    if (!u.ok) return res.status(400).json({ error: u.error });
    
    const users = await getCollection('users');
    
    // Check if email or username taken
    const existing = await users.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { 'profile.username_normalized': u.handle }
      ]
    });
    
    if (existing) {
      if (existing.email === email.toLowerCase().trim()) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      return res.status(400).json({ error: 'This username is already taken' });
    }
    
    const pv = validatePassword(password);
    if (!pv.valid) return res.status(400).json({ error: pv.error });
    
    const hash = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();
    
    const newUser = {
      _id: userId,
      id: userId,
      email: email.toLowerCase().trim(),
      password_hash: hash,
      name: name || null,
      auth_provider: 'email',
      email_verified: false,
      is_admin: false,
      is_business_owner: false,
      is_blocked: false,
      created_at: new Date(),
      profile: {
        username: u.stored,
        username_normalized: u.handle,
        onboarding_completed: false,
        updated_at: new Date()
      }
    };
    
    await users.insertOne(newUser);
    
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_LINK_EXPIRY_MINUTES * 60 * 1000);
    
    const verifTokens = await getCollection('email_verification_tokens');
    await verifTokens.insertOne({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: new Date()
    });
    
    let verificationEmailDelivered = false;
    try {
      const r = await sendVerificationCode(email, code);
      verificationEmailDelivered = r.delivered;
    } catch (e) {
      console.error('[Register] Verification email failed:', e.message);
      // We still created the user, but couldn't send the email
      return res.status(500).json({ error: 'Could not send verification email. Try again later.' });
    }
    
    res.status(201).json({
      requiresEmailVerification: true,
      verificationEmailDelivered,
      user: {
        id: userId,
        name: newUser.name || email.split('@')[0],
        username: u.stored,
        email: newUser.email,
        emailVerified: false,
        onboardingCompleted: false,
        isBusinessOwner: false,
        isAdmin: false,
        ownedPlaceCount: 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', sanitizeLoginInput, async (req, res) => {
  try {
    const identifier = (req.body.email || '').trim();
    const password = req.body.password;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const rate = await checkLoginRateLimit(ip);
    if (!rate.ok) return res.status(429).json({ error: 'Too many attempts.', retryAfter: rate.retryAfter });

    const users = await getCollection('users');
    let user;
    
    if (identifier.includes('@')) {
      user = await users.findOne({
        email: identifier.toLowerCase(),
        auth_provider: 'email'
      });
    } else {
      const u = validateUsername(identifier);
      if (!u.ok) {
        await recordFailedLoginAttempt(ip);
        return res.status(401).json({ error: 'Wrong email, username, or password. Please try again.' });
      }
      user = await users.findOne({
        'profile.username_normalized': u.handle,
        auth_provider: 'email'
      });
    }

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      await recordFailedLoginAttempt(ip);
      return res.status(401).json({ error: 'Wrong email, username, or password. Please try again.' });
    }
    
    if (user.is_blocked === true) {
      return res.status(403).json({ error: 'This account has been disabled.', code: 'ACCOUNT_BLOCKED' });
    }
    
    if (!user.email_verified) {
      const emailNorm = (user.email || '').trim().toLowerCase();
      let verificationEmailDelivered = false;
      let resendTooSoon = false;
      let emailSendFailed = false;
      if (await canSendVerificationEmailNow(emailNorm)) {
        try {
          verificationEmailDelivered = await issueEmailVerification(user.id, user.email);
          if (verificationEmailDelivered) {
            await markVerificationEmailSent(emailNorm);
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
        error = 'We sent a new verification code to your email. Check your inbox (and spam), then sign in here.';
      } else if (resendTooSoon) {
        error = 'Your email is not verified yet. A code was sent recently — check your inbox (and spam). Try again in about a minute.';
      } else if (emailSendFailed) {
        error = 'Your email is not verified. The message could not be sent (mail server error). Try again shortly, or check the API server log for your 6-digit code.';
      } else if (!smtpOn) {
        error = 'Your email is not verified. Outgoing email is not configured on this server. Your 6-digit code is printed in the API server log — add SMTP in the API .env to receive emails in your inbox.';
      } else {
        error = 'Your email is not verified. Check the API server log for your 6-digit code.';
      }
      return res.status(403).json({
        error,
        code: 'EMAIL_NOT_VERIFIED',
        verificationEmail: user.email,
        verificationEmailDelivered,
        resendTooSoon,
        smtpConfigured: smtpOn,
        emailSendFailed,
      });
    }
    
    // Count owned places
    const placeOwners = await getCollection('place_owners');
    const ownedPlaceCount = await placeOwners.countDocuments({ user_id: user.id });

    const profile = user.profile || {};
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name || user.email.split('@')[0],
        username: profile.username || '',
        email: user.email,
        emailVerified: true,
        onboardingCompleted: profile.onboarding_completed === true,
        isBusinessOwner: user.is_business_owner === true,
        isAdmin: user.is_admin === true,
        ownedPlaceCount: ownedPlaceCount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/** HTTPS profile image URL from Google ID token `picture` claim (bounded length). */
function googleIdTokenPictureUrl(payload) {
  const p = payload?.picture;
  if (typeof p !== 'string') return null;
  const t = p.trim();
  if (!/^https:\/\//i.test(t)) return null;
  return t.length > 2048 ? t.slice(0, 2048) : t;
}

/** Google Identity Services (Sign in with Google): verify JWT `credential`, find-or-create user, return app JWT. */
router.post('/google', async (req, res) => {
  try {
    const credential =
      typeof req.body?.credential === 'string' ? req.body.credential.trim() : '';
    if (!credential || credential.length > 12000) {
      return res.status(400).json({ error: 'Missing Google credential' });
    }
    const clientId = process.env.GOOGLE_CLIENT_ID && String(process.env.GOOGLE_CLIENT_ID).trim();
    if (!clientId) {
      return res.status(503).json({
        error: 'Google sign-in is not configured on this server.',
        code: 'GOOGLE_DISABLED',
      });
    }

    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const rate = await checkLoginRateLimit(ip);
    if (!rate.ok) {
      return res.status(429).json({ error: 'Too many attempts.', retryAfter: rate.retryAfter });
    }

    let payload;
    try {
      const oAuth = new OAuth2Client(clientId);
      const ticket = await oAuth.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (e) {
      console.error('[auth/google] verifyIdToken:', e.message);
      await recordFailedLoginAttempt(ip);
      return res.status(401).json({ error: 'Google sign-in could not be verified. Try again.' });
    }

    const email = (payload.email || '').toLowerCase().trim();
    const sub = payload.sub;
    const emailVerifiedClaim = payload.email_verified === true || payload.email_verified === 'true';
    const displayNameFromToken =
      typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim().slice(0, 150)
        : null;
    if (!email || !sub || !emailVerifiedClaim) {
      return res.status(400).json({ error: 'Google did not return a verified email.' });
    }

    const pictureUrl = googleIdTokenPictureUrl(payload);
    const users = await getCollection('users');
    let user = await users.findOne({ google_sub: sub });
    let createdViaGoogle = false;

    if (!user) {
      const byEmail = await users.findOne({ email });
      if (byEmail) {
        if (byEmail.auth_provider === 'google') {
          user = byEmail;
          if (byEmail.google_sub !== sub) {
            await users.updateOne({ id: byEmail.id }, { $set: { google_sub: sub } });
            user = await users.findOne({ id: byEmail.id });
          }
        } else {
          return res.status(409).json({
            error: `An account with this email already exists. Sign in with your password, or use "Forgot password".`,
            code: 'USE_PASSWORD_LOGIN',
          });
        }
      }
    }

    if (!user) {
      const u = await pickUsernameForGoogle(users, email);
      const userId = crypto.randomUUID();
      const newUser = {
        _id: userId,
        id: userId,
        email,
        name: displayNameFromToken || null,
        auth_provider: 'google',
        google_sub: sub,
        email_verified: true,
        password_hash: null,
        is_admin: false,
        is_business_owner: false,
        is_blocked: false,
        created_at: new Date(),
        profile: {
          username: u.stored,
          username_normalized: u.handle,
          onboarding_completed: false,
          updated_at: new Date(),
        },
      };
      if (pictureUrl) newUser.avatar_url = pictureUrl;
      await users.insertOne(newUser);
      user = newUser;
      createdViaGoogle = true;
    }

    if (user.is_blocked === true) {
      return res.status(403).json({ error: 'This account has been disabled.', code: 'ACCOUNT_BLOCKED' });
    }

    if (!createdViaGoogle) {
      const syncSet = {
        email_verified: true,
        'profile.updated_at': new Date(),
      };
      if (user.auth_provider === 'google') {
        if (displayNameFromToken) syncSet.name = displayNameFromToken;
        const canSyncAvatar =
          pictureUrl &&
          (!user.avatar_url || /googleusercontent\.com/i.test(String(user.avatar_url)));
        if (canSyncAvatar) syncSet.avatar_url = pictureUrl;
      }
      await users.updateOne({ id: user.id }, { $set: syncSet });
      user = await users.findOne({ id: user.id });
    }

    const placeOwners = await getCollection('place_owners');
    const ownedPlaceCount = await placeOwners.countDocuments({ user_id: user.id });

    const profile = user.profile || {};
    const username = profile.username || '';

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name || user.email.split('@')[0],
        username,
        email: user.email,
        emailVerified: true,
        onboardingCompleted: profile.onboarding_completed === true,
        isBusinessOwner: user.is_business_owner === true,
        isAdmin: user.is_admin === true,
        ownedPlaceCount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Google sign-in failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254) return res.status(400).json({ error: 'Valid email required' });
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const rate = await checkForgotRateLimit(ip);
    if (!rate.ok) return res.status(429).json({ error: 'Too many requests.', retryAfter: rate.retryAfter });
    await recordForgotPasswordAttempt(ip);
    
    const users = await getCollection('users');
    const user = await users.findOne({ email, auth_provider: 'email', password_hash: { $ne: null } });
    
    let emailDelivered = false;
    if (user) {
      const resetTokens = await getCollection('password_reset_tokens');
      await resetTokens.deleteOne({ user_id: user.id });
      
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = new Date(Date.now() + RESET_LINK_EXPIRY_MINUTES * 60 * 1000);
      
      await resetTokens.insertOne({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_at: new Date()
      });
      
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

router.post('/reset-password', async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().replace(/\s/g, '') : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword.slice(0, 128) : '';
    if (!email || !code || code.length !== 6 || !newPassword) {
      return res.status(400).json({ error: 'Email, 6-digit code, and new password are required' });
    }
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const resetKey = `${ip}:${email}`;
    const rate = await checkResetRateLimit(resetKey);
    if (!rate.ok) {
      return res.status(429).json({
        error: 'Too many reset attempts. Please wait before trying again.',
        retryAfter: rate.retryAfter,
      });
    }
    const pv = validatePassword(newPassword);
    if (!pv.valid) return res.status(400).json({ error: pv.error });

    const users = await getCollection('users');
    const user = await users.findOne({ email, auth_provider: 'email', password_hash: { $ne: null } });
    if (!user) {
      await recordResetPasswordAttempt(resetKey);
      return res.status(400).json({ error: 'Invalid or expired code. Request a new one.' });
    }

    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    const resetTokens = await getCollection('password_reset_tokens');
    const tokenDoc = await resetTokens.findOne({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: { $gt: new Date() }
    });
    
    if (!tokenDoc) {
      await recordResetPasswordAttempt(resetKey);
      return res.status(400).json({ error: 'Invalid or expired code. Request a new one.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await users.updateOne({ id: user.id }, { $set: { password_hash: hash } });
    await resetTokens.deleteOne({ user_id: user.id });
    await clearResetPasswordAttempts(resetKey);
    res.json({ message: 'Password has been reset. You can now sign in with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().replace(/\s/g, '') : '';
    if (!emailRaw || emailRaw.length > 254 || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Valid email and 6-digit code are required' });
    }

    const users = await getCollection('users');
    const user = await users.findOne({ email: emailRaw, auth_provider: 'email' });
    
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
    const verifTokens = await getCollection('email_verification_tokens');
    const tok = await verifTokens.findOne({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: { $gt: new Date() }
    });
    
    if (!tok) {
      return res.status(400).json({
        error: 'Invalid or expired code. Request a new code from the sign-in screen.',
      });
    }

    await users.updateOne({ id: user.id }, { $set: { email_verified: true } });
    await verifTokens.deleteOne({ user_id: user.id });

    let welcomeEmailDelivered = false;
    try {
      const w = await sendWelcomeEmail(user.email, user.name || emailRaw.split('@')[0]);
      welcomeEmailDelivered = w.delivered;
    } catch (e) {
      console.warn('[verify-email] welcome email:', e.message);
    }
    
    // Count owned places
    const placeOwners = await getCollection('place_owners');
    const ownedPlaceCount = await placeOwners.countDocuments({ user_id: user.id });

    const vProfile = user.profile || {};
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      welcomeEmailDelivered,
      user: {
        id: user.id,
        name: user.name || emailRaw.split('@')[0],
        username: vProfile.username || '',
        email: user.email,
        emailVerified: true,
        onboardingCompleted: vProfile.onboarding_completed === true,
        isBusinessOwner: user.is_business_owner === true,
        isAdmin: user.is_admin === true,
        ownedPlaceCount: ownedPlaceCount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

module.exports = router;
