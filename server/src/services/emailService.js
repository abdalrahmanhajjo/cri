/**
 * OTP emails — same 6-digit flow as the mobile app (shared DB).
 * SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM or SMTP_FROM (app-style).
 * Optional: APP_NAME, PUBLIC_CLIENT_URL / RESET_PASSWORD_BASE_URL / CLIENT_URL / APP_WEB_URL for links.
 *
 * Without SMTP, codes are logged to the server console only.
 */
const nodemailer = require('nodemailer');

/** Password reset codes (same TTL as token rows in auth routes). */
const RESET_LINK_EXPIRY_MINUTES = 15;
/** Email verification token TTL (minutes). Must match token expiry in routes/auth.js. */
const VERIFICATION_LINK_EXPIRY_MINUTES = 24 * 60;

const OTP_KIND = {
  verification: 'verification',
  password_reset: 'password_reset',
};

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const options = {
    host,
    port,
    secure,
    auth: { user, pass },
  };
  if (port === 587 && !secure) {
    options.requireTLS = true;
  }
  return nodemailer.createTransport(options);
}

const appName = (process.env.APP_NAME || 'Visit Tripoli').trim() || 'Visit Tripoli';

const from =
  process.env.MAIL_FROM ||
  process.env.SMTP_FROM ||
  (process.env.SMTP_USER ? `${appName} <${process.env.SMTP_USER}>` : `${appName} <noreply@example.com>`);

function getPublicClientUrl() {
  const raw =
    process.env.PUBLIC_CLIENT_URL ||
    process.env.CLIENT_URL ||
    process.env.APP_WEB_URL ||
    process.env.RESET_PASSWORD_BASE_URL ||
    '';
  return String(raw).replace(/\/$/, '');
}

function formatExpiryLabel(expiryMinutes) {
  if (expiryMinutes >= 60 && expiryMinutes % 60 === 0) {
    const h = expiryMinutes / 60;
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  return `${expiryMinutes} minutes`;
}

/**
 * Shared HTML + plain text for all 6-digit codes (verification + password reset).
 * Wording matches one flow for app + web.
 */
function buildOtpEmail(kind, code) {
  const isVerify = kind === OTP_KIND.verification;
  const expiryMin = isVerify ? VERIFICATION_LINK_EXPIRY_MINUTES : RESET_LINK_EXPIRY_MINUTES;
  const expiryLabel = formatExpiryLabel(expiryMin);

  const subject = isVerify
    ? `Your email verification code – ${appName}`
    : `Your password reset code – ${appName}`;

  const headline = isVerify ? 'Verify your email' : 'Reset your password';
  const lead = isVerify
    ? `Enter this 6-digit code in the ${appName} app or on the website to verify your email address.`
    : `Enter this 6-digit code in the ${appName} app or on the website to set a new password.`;

  const clientUrl = getPublicClientUrl();
  const webHint = clientUrl
    ? `\n\nOpen on the web: ${clientUrl}/login`
    : '';

  const text = [
    headline,
    '',
    lead,
    '',
    `Your code: ${code}`,
    '',
    `This code expires in ${expiryLabel}.`,
    'If you didn\'t request this, you can ignore this email.',
    `This is the same 6-digit code flow used by the ${appName} mobile app and website.`,
    webHint,
    '',
    `— ${appName}`,
  ]
    .join('\n');

  const linkBlock = clientUrl
    ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.5"><a href="${clientUrl}/login" style="color:#0d9488;font-weight:600">Open ${appName} on the web</a></p>`
    : '';

  const codeBox = `<div style="font-size:26px;font-weight:700;letter-spacing:0.2em;font-family:ui-monospace,Consolas,'Courier New',monospace;color:#0f766e;padding:18px 20px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;text-align:center">${code}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 14px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
        <tr><td style="padding:22px 26px;background:linear-gradient(135deg,#0d9488,#115e59);color:#fff;font-size:17px;font-weight:700;letter-spacing:0.02em">${appName}</td></tr>
        <tr><td style="padding:22px 26px 6px;font-size:20px;font-weight:700;color:#0f172a">${headline}</td></tr>
        <tr><td style="padding:8px 26px 14px;font-size:15px;line-height:1.55;color:#334155">${lead}</td></tr>
        <tr><td style="padding:0 26px 18px">${codeBox}</td></tr>
        <tr><td style="padding:0 26px 22px;font-size:14px;line-height:1.55;color:#64748b">
          This code expires in <strong style="color:#334155">${expiryLabel}</strong>. It works in the <strong>${appName} mobile app</strong> and on this website — same email, same account.
          If you didn't request this email, you can ignore it.
        </td></tr>
        <tr><td style="padding:0 26px 22px">${linkBlock}</td></tr>
        <tr><td style="padding:14px 26px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">Tripoli Explorer · Lebanon</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * @returns {{ delivered: boolean }} delivered=true only when mail was handed to SMTP (user should check inbox).
 */
async function sendOtpEmail(kind, email, code) {
  const { subject, text, html } = buildOtpEmail(kind, code);
  const transport = getTransporter();
  if (transport) {
    await transport.sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    });
    const label = kind === OTP_KIND.verification ? 'Verification' : 'Password reset';
    console.log(`[Email] ${label} code sent to`, email);
    return { delivered: true };
  }
  const label = kind === OTP_KIND.verification ? 'Verify email' : 'Forgot password';
  console.log(`[Email] No SMTP — ${label} code for`, email, ':', code);
  return { delivered: false };
}

/** @returns {Promise<{ delivered: boolean }>} */
async function sendPasswordResetCode(email, code) {
  try {
    return await sendOtpEmail(OTP_KIND.password_reset, email, code);
  } catch (err) {
    console.error('[Email] sendPasswordResetCode failed:', err.message);
    if (err.response) console.error('[Email] Response:', err.response);
    throw err;
  }
}

/** @returns {Promise<{ delivered: boolean }>} */
async function sendVerificationCode(email, code) {
  try {
    return await sendOtpEmail(OTP_KIND.verification, email, code);
  } catch (err) {
    console.error('[Email] sendVerificationCode failed:', err.message);
    throw err;
  }
}

function isSmtpConfigured() {
  return getTransporter() != null;
}

module.exports = {
  sendPasswordResetCode,
  sendVerificationCode,
  isSmtpConfigured,
  RESET_LINK_EXPIRY_MINUTES,
  VERIFICATION_LINK_EXPIRY_MINUTES,
  OTP_KIND,
};
