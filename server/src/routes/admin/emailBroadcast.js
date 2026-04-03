const express = require('express');
const nodemailer = require('nodemailer');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { adminMiddleware } = require('../../middleware/admin');
const { isSmtpConfigured } = require('../../services/emailService');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

const MAX_SUBJECT = 200;
const MAX_TEXT = 120_000;
const MAX_HTML = 250_000;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const options = { host, port, secure, auth: { user, pass } };
  if (port === 587 && !secure) options.requireTLS = true;
  return nodemailer.createTransport(options);
}

const appName = (process.env.APP_NAME || 'Visit Tripoli').trim() || 'Visit Tripoli';
const from =
  process.env.MAIL_FROM ||
  process.env.SMTP_FROM ||
  (process.env.SMTP_USER ? `${appName} <${process.env.SMTP_USER}>` : `${appName} <noreply@example.com>`);

/**
 * POST /api/admin/email-broadcast
 * Body: { subject, text?, html?, onlyVerifiedEmail?: boolean } (default onlyVerifiedEmail true)
 */
router.post('/', async (req, res) => {
  try {
    if (!isSmtpConfigured()) {
      return res.status(503).json({
        error: 'SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS on the API server.',
      });
    }
    const subjectRaw = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const html = typeof req.body?.html === 'string' ? req.body.html : '';
    const onlyVerified = req.body?.onlyVerifiedEmail !== false;

    if (!subjectRaw || subjectRaw.length > MAX_SUBJECT) {
      return res.status(400).json({ error: `Subject is required (max ${MAX_SUBJECT} characters).` });
    }
    const textTrim = text.trim();
    const htmlTrim = html.trim();
    if (!textTrim && !htmlTrim) {
      return res.status(400).json({ error: 'Provide a plain-text body and/or HTML body.' });
    }
    if (textTrim.length > MAX_TEXT) {
      return res.status(400).json({ error: `Plain text body too long (max ${MAX_TEXT} characters).` });
    }
    if (htmlTrim.length > MAX_HTML) {
      return res.status(400).json({ error: `HTML body too long (max ${MAX_HTML} characters).` });
    }

    const transport = getTransporter();
    if (!transport) {
      return res.status(503).json({ error: 'Could not create mail transport.' });
    }

    const query = {
      email: { $ne: null, $not: /^\s*$/ },
      is_blocked: { $ne: true }
    };
    if (onlyVerified) {
      query.email_verified = true;
    }

    const usersColl = await getCollection('users');
    const rows = await usersColl.find(query).sort({ created_at: 1 }).toArray();
    
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const row of rows) {
      if (!row.email) continue;
      try {
        await transport.sendMail({
          from,
          to: row.email,
          subject: subjectRaw,
          text: textTrim || (htmlTrim ? 'This message is in HTML. Please open it in your email app.' : ' '),
          html: htmlTrim || undefined,
        });
        sent += 1;
        await new Promise((r) => setTimeout(r, 80));
      } catch (e) {
        failed += 1;
        if (errors.length < 25) {
          errors.push({ email: row.email, message: e.message || 'send failed' });
        }
      }
    }

    res.json({
      totalRecipients: rows.length,
      sent,
      failed,
      onlyVerifiedEmail: onlyVerified,
      errors,
    });
  } catch (err) {
    console.error('[admin/email-broadcast]', err);
    res.status(500).json({ error: 'Broadcast failed' });
  }
});

module.exports = router;
