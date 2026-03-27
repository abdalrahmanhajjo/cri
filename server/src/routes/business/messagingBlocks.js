const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { query: dbQuery } = require('../../db');
const { parsePlaceId } = require('../../utils/validate');

const router = express.Router();
router.use(authMiddleware, businessPortalMiddleware);

async function assertOwnsPlace(userId, placeId) {
  const { rows } = await dbQuery(
    'SELECT 1 FROM place_owners WHERE user_id = $1 AND place_id = $2',
    [userId, placeId]
  );
  return rows.length > 0;
}

/**
 * POST /api/business/messaging-blocks
 * Body: { placeId, inquiryId }
 */
router.post('/', async (req, res) => {
  const parsed = parsePlaceId(req.body?.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'Valid placeId required' });
  const placeId = parsed.value;
  const inquiryId = parseInt(String(req.body?.inquiryId || ''), 10);
  if (!Number.isInteger(inquiryId) || inquiryId < 1) {
    return res.status(400).json({ error: 'Valid inquiryId required' });
  }
  const userId = req.user.userId;
  if (!(await assertOwnsPlace(userId, placeId))) {
    return res.status(403).json({ error: 'You do not manage this place' });
  }

  try {
    const { rows: invRows } = await dbQuery(
      'SELECT id, user_id, guest_email FROM place_inquiries WHERE id = $1 AND place_id = $2',
      [inquiryId, placeId]
    );
    if (!invRows.length) return res.status(404).json({ error: 'Inquiry not found' });
    const inv = invRows[0];
    const uid = inv.user_id || null;
    const em =
      inv.guest_email && String(inv.guest_email).trim()
        ? String(inv.guest_email).trim().toLowerCase().slice(0, 320)
        : '';

    if (uid) {
      const uidStr = String(uid);
      const ex = await dbQuery(
        'SELECT id FROM place_messaging_blocks WHERE place_id = $1 AND blocked_user_id = $2::uuid LIMIT 1',
        [placeId, uidStr]
      );
      if (ex.rows.length) {
        return res.json({ ok: true, blocked: true, already: true, blockId: ex.rows[0].id });
      }
      const ins = await dbQuery(
        `INSERT INTO place_messaging_blocks (place_id, blocked_user_id, blocked_email)
         VALUES ($1, $2::uuid, NULL) RETURNING id`,
        [placeId, uidStr]
      );
      return res.json({ ok: true, blocked: true, blockId: ins.rows[0].id });
    }

    if (!em) {
      return res.status(400).json({ error: 'Cannot block this visitor (no email on inquiry)' });
    }

    const ex = await dbQuery(
      `SELECT id FROM place_messaging_blocks
       WHERE place_id = $1 AND blocked_user_id IS NULL AND lower(trim(blocked_email)) = $2
       LIMIT 1`,
      [placeId, em]
    );
    if (ex.rows.length) {
      return res.json({ ok: true, blocked: true, already: true, blockId: ex.rows[0].id });
    }
    const ins = await dbQuery(
      `INSERT INTO place_messaging_blocks (place_id, blocked_user_id, blocked_email)
       VALUES ($1, NULL, $2) RETURNING id`,
      [placeId, em]
    );
    return res.json({ ok: true, blocked: true, blockId: ins.rows[0].id });
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(503).json({
        error: 'Messaging blocks are not available yet. Run server/migrations/010_place_messaging_blocks.sql',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not block visitor' });
  }
});

/**
 * DELETE /api/business/messaging-blocks?placeId=&inquiryId=
 */
router.delete('/', async (req, res) => {
  const parsed = parsePlaceId(req.query.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'Valid placeId required' });
  const placeId = parsed.value;
  const inquiryId = parseInt(String(req.query.inquiryId || ''), 10);
  if (!Number.isInteger(inquiryId) || inquiryId < 1) {
    return res.status(400).json({ error: 'Valid inquiryId required' });
  }
  const userId = req.user.userId;
  if (!(await assertOwnsPlace(userId, placeId))) {
    return res.status(403).json({ error: 'You do not manage this place' });
  }

  try {
    const { rows: invRows } = await dbQuery(
      'SELECT id, user_id, guest_email FROM place_inquiries WHERE id = $1 AND place_id = $2',
      [inquiryId, placeId]
    );
    if (!invRows.length) return res.status(404).json({ error: 'Inquiry not found' });
    const inv = invRows[0];
    const uid = inv.user_id || null;
    const em =
      inv.guest_email && String(inv.guest_email).trim()
        ? String(inv.guest_email).trim().toLowerCase().slice(0, 320)
        : '';

    if (uid) {
      await dbQuery(
        'DELETE FROM place_messaging_blocks WHERE place_id = $1 AND blocked_user_id = $2::uuid',
        [placeId, String(uid)]
      );
    } else if (em) {
      await dbQuery(
        `DELETE FROM place_messaging_blocks
         WHERE place_id = $1 AND blocked_user_id IS NULL AND lower(trim(blocked_email)) = $2`,
        [placeId, em]
      );
    } else {
      return res.status(400).json({ error: 'Cannot unblock (no identifier on inquiry)' });
    }

    res.json({ ok: true, blocked: false });
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(503).json({
        error: 'Messaging blocks are not available yet. Run server/migrations/010_place_messaging_blocks.sql',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not unblock visitor' });
  }
});

module.exports = router;
