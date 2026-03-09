/**
 * Email service – sends real emails when SMTP is configured.
 * Set in .env: SMTP_HOST, SMTP_PORT (optional, default 587), SMTP_USER, SMTP_PASS, MAIL_FROM (optional).
 * Without SMTP, logs codes to console (dev only).
 *
 * Gmail: Use an App Password (not your normal password). Google Account → Security → 2-Step Verification → App passwords.
 * If email not received: check Spam/Junk; check server console for "[Email] sendPasswordResetCode failed" or "[Email] Password reset code sent to".
 */
const nodemailer = require('nodemailer');

const RESET_LINK_EXPIRY_MINUTES = 15;
const VERIFICATION_LINK_EXPIRY_MINUTES = 24 * 60;

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

const from = process.env.MAIL_FROM || (process.env.SMTP_USER ? `Visit Tripoli <${process.env.SMTP_USER}>` : 'Visit Tripoli <noreply@example.com>');

async function sendPasswordResetCode(email, code) {
  const transport = getTransporter();
  if (transport) {
    try {
      await transport.sendMail({
        from,
        to: email,
        subject: 'Your password reset code – Visit Tripoli',
        text: `Your password reset code is: ${code}\n\nThis code expires in ${RESET_LINK_EXPIRY_MINUTES} minutes. If you didn't request this, you can ignore this email.\n\n— Visit Tripoli`,
        html: `
          <p>Your password reset code is: <strong>${code}</strong></p>
          <p>This code expires in ${RESET_LINK_EXPIRY_MINUTES} minutes.</p>
          <p>If you didn't request this, you can ignore this email.</p>
          <p>— Visit Tripoli</p>
        `,
      });
      console.log('[Email] Password reset code sent to', email);
      return true;
    } catch (err) {
      console.error('[Email] sendPasswordResetCode failed:', err.message);
      if (err.response) console.error('[Email] Response:', err.response);
      if (err.code) console.error('[Email] Code:', err.code);
      throw err;
    }
  }
  console.log('[Forgot password] No SMTP configured. Reset code for', email, ':', code, `(valid ${RESET_LINK_EXPIRY_MINUTES} min)`);
  return true;
}

async function sendVerificationCode(email, code) {
  const transport = getTransporter();
  if (transport) {
    try {
      await transport.sendMail({
        from,
        to: email,
        subject: 'Verify your email – Visit Tripoli',
        text: `Your verification code is: ${code}\n\n— Visit Tripoli`,
        html: `<p>Your verification code is: <strong>${code}</strong></p><p>— Visit Tripoli</p>`,
      });
      return true;
    } catch (err) {
      console.error('[Email] sendVerificationCode failed:', err.message);
      throw err;
    }
  }
  console.log('[Verify email] No SMTP configured. Verification code for', email, ':', code);
  return true;
}

module.exports = {
  sendPasswordResetCode,
  sendVerificationCode,
  RESET_LINK_EXPIRY_MINUTES,
  VERIFICATION_LINK_EXPIRY_MINUTES,
};
