const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware } = require('../../middleware/placeOwner');
const { query: dbQuery } = require('../../db');
const { parsePlaceId } = require('../../utils/validate');
const { visitorFollowupsFromDb } = require('../../utils/inquiryFollowups');

const router = express.Router();
router.use(authMiddleware, businessPortalMiddleware);

async function assertOwnsPlace(userId, placeId) {
  const { rows } = await dbQuery(
    'SELECT 1 FROM place_owners WHERE user_id = $1 AND place_id = $2',
    [userId, placeId]
  );
  return rows.length > 0;
}

const INQUIRY_BLOCK_SQL = `,
       (EXISTS (
         SELECT 1 FROM place_messaging_blocks b
         WHERE b.place_id = i.place_id
           AND (
             (i.user_id IS NOT NULL AND b.blocked_user_id = i.user_id)
             OR (
               i.guest_email IS NOT NULL
               AND b.blocked_email IS NOT NULL
               AND lower(trim(b.blocked_email)) = lower(trim(i.guest_email))
             )
           )
       )) AS is_messaging_blocked`;

/** Without messaging-block column if `place_messaging_blocks` table not migrated yet. */
const INQUIRY_ROW_SELECT_FULL_NO_MBLOCK = `SELECT i.id, i.place_id, i.user_id, i.guest_name, i.guest_email, i.guest_phone, i.message, i.response,
       i.status, i.created_at, i.responded_at, i.visitor_followups,
       u.name AS user_name, u.email AS user_email
  FROM place_inquiries i
  LEFT JOIN users u ON u.id = i.user_id`;

const INQUIRY_ROW_SELECT_FULL = `SELECT i.id, i.place_id, i.user_id, i.guest_name, i.guest_email, i.guest_phone, i.message, i.response,
       i.status, i.created_at, i.responded_at, i.visitor_followups${INQUIRY_BLOCK_SQL},
       u.name AS user_name, u.email AS user_email
  FROM place_inquiries i
  LEFT JOIN users u ON u.id = i.user_id`;

const INQUIRY_ROW_SELECT_NO_PHONE_NO_MBLOCK = `SELECT i.id, i.place_id, i.user_id, i.guest_name, i.guest_email, i.message, i.response,
       i.status, i.created_at, i.responded_at, i.visitor_followups,
       u.name AS user_name, u.email AS user_email
  FROM place_inquiries i
  LEFT JOIN users u ON u.id = i.user_id`;

const INQUIRY_ROW_SELECT_NO_PHONE = `SELECT i.id, i.place_id, i.user_id, i.guest_name, i.guest_email, i.message, i.response,
       i.status, i.created_at, i.responded_at, i.visitor_followups${INQUIRY_BLOCK_SQL},
       u.name AS user_name, u.email AS user_email
  FROM place_inquiries i
  LEFT JOIN users u ON u.id = i.user_id`;

/** Load one inquiry row; tolerate DB without `guest_phone` or `visitor_followups`. */
async function fetchInquiryRowById(id) {
  try {
    const { rows } = await dbQuery(`${INQUIRY_ROW_SELECT_FULL} WHERE i.id = $1`, [id]);
    return rows[0] || null;
  } catch (e) {
    if (e.code === '42P01' && String(e.message || '').includes('place_messaging_blocks')) {
      try {
        const { rows } = await dbQuery(`${INQUIRY_ROW_SELECT_FULL_NO_MBLOCK} WHERE i.id = $1`, [id]);
        return rows[0] || null;
      } catch (e2) {
        if (e2.code === '42703' && String(e2.message || '').includes('guest_phone')) {
          try {
            const { rows } = await dbQuery(`${INQUIRY_ROW_SELECT_NO_PHONE_NO_MBLOCK} WHERE i.id = $1`, [id]);
            return rows[0] || null;
          } catch (e3) {
            if (e3.code === '42703' && String(e3.message || '').includes('visitor_followups')) {
              const sel = INQUIRY_ROW_SELECT_NO_PHONE_NO_MBLOCK.replace(', i.visitor_followups', '');
              const { rows } = await dbQuery(`${sel} WHERE i.id = $1`, [id]);
              return rows[0] || null;
            }
            throw e3;
          }
        }
        if (e2.code === '42703' && String(e2.message || '').includes('visitor_followups')) {
          const sel = INQUIRY_ROW_SELECT_FULL_NO_MBLOCK.replace(', i.visitor_followups', '');
          const { rows } = await dbQuery(`${sel} WHERE i.id = $1`, [id]);
          return rows[0] || null;
        }
        throw e2;
      }
    }
    if (e.code === '42703' && String(e.message || '').includes('guest_phone')) {
      try {
        const { rows } = await dbQuery(`${INQUIRY_ROW_SELECT_NO_PHONE} WHERE i.id = $1`, [id]);
        return rows[0] || null;
      } catch (e2) {
        if (e2.code === '42703' && String(e2.message || '').includes('visitor_followups')) {
          const sel = INQUIRY_ROW_SELECT_NO_PHONE.replace(', i.visitor_followups', '');
          const { rows } = await dbQuery(`${sel} WHERE i.id = $1`, [id]);
          return rows[0] || null;
        }
        throw e2;
      }
    }
    if (e.code === '42703' && String(e.message || '').includes('visitor_followups')) {
      try {
        const sel = INQUIRY_ROW_SELECT_FULL.replace(', i.visitor_followups', '');
        const { rows } = await dbQuery(`${sel} WHERE i.id = $1`, [id]);
        return rows[0] || null;
      } catch (e2) {
        if (e2.code === '42703' && String(e2.message || '').includes('guest_phone')) {
          const sel2 = INQUIRY_ROW_SELECT_NO_PHONE.replace(', i.visitor_followups', '');
          const { rows } = await dbQuery(`${sel2} WHERE i.id = $1`, [id]);
          return rows[0] || null;
        }
        throw e2;
      }
    }
    throw e;
  }
}

function toApiInquiry(r) {
  if (!r) return null;
  return {
    id: r.id,
    placeId: r.place_id,
    userId: r.user_id,
    userName: r.user_name || r.guest_name || '',
    userEmail: r.user_email || r.guest_email || '',
    guestPhone: r.guest_phone || '',
    message: r.message || '',
    response: r.response || '',
    status: r.status,
    createdAt: r.created_at,
    respondedAt: r.responded_at,
    isGuest: !r.user_id,
    visitorFollowups: visitorFollowupsFromDb(r.visitor_followups),
    isMessagingBlocked: r.is_messaging_blocked === true,
  };
}

/** GET /api/business/proposals?placeId= */
router.get('/', async (req, res) => {
  const parsed = parsePlaceId(req.query.placeId);
  if (!parsed.valid) return res.status(400).json({ error: 'Valid placeId query required' });
  const placeId = parsed.value;
  const userId = req.user.userId;
  if (!(await assertOwnsPlace(userId, placeId))) {
    return res.status(403).json({ error: 'You do not manage this place' });
  }

  const LIST_FULL = `${INQUIRY_ROW_SELECT_FULL} WHERE i.place_id = $1 ORDER BY i.created_at DESC LIMIT 300`;
  const LIST_NO_PHONE = `${INQUIRY_ROW_SELECT_NO_PHONE} WHERE i.place_id = $1 ORDER BY i.created_at DESC LIMIT 300`;

  try {
    let rows;
    try {
      ({ rows } = await dbQuery(LIST_FULL, [placeId]));
    } catch (e) {
      if (e.code === '42P01' && String(e.message || '').includes('place_messaging_blocks')) {
        ({ rows } = await dbQuery(`${INQUIRY_ROW_SELECT_FULL_NO_MBLOCK} WHERE i.place_id = $1 ORDER BY i.created_at DESC LIMIT 300`, [placeId]));
      } else if (e.code === '42703' && String(e.message || '').includes('visitor_followups')) {
        const sel = INQUIRY_ROW_SELECT_FULL.replace(', i.visitor_followups', '');
        ({ rows } = await dbQuery(`${sel} WHERE i.place_id = $1 ORDER BY i.created_at DESC LIMIT 300`, [placeId]));
      } else if (e.code === '42703' && String(e.message || '').includes('guest_phone')) {
        try {
          ({ rows } = await dbQuery(LIST_NO_PHONE, [placeId]));
        } catch (e2) {
          if (e2.code === '42P01' && String(e2.message || '').includes('place_messaging_blocks')) {
            ({ rows } = await dbQuery(
              `${INQUIRY_ROW_SELECT_NO_PHONE_NO_MBLOCK} WHERE i.place_id = $1 ORDER BY i.created_at DESC LIMIT 300`,
              [placeId]
            ));
          } else if (e2.code === '42703' && String(e2.message || '').includes('visitor_followups')) {
            const sel = INQUIRY_ROW_SELECT_NO_PHONE.replace(', i.visitor_followups', '');
            ({ rows } = await dbQuery(`${sel} WHERE i.place_id = $1 ORDER BY i.created_at DESC LIMIT 300`, [placeId]));
          } else {
            throw e2;
          }
        }
      } else {
        throw e;
      }
    }

    const inquiries = rows.map((r) => toApiInquiry(r));

    res.json({ placeId, inquiries });
  } catch (err) {
    console.error(err);
    if (err.code === '42P01') {
      return res.json({
        placeId,
        inquiries: [],
        _warning: 'place_inquiries table missing — run server/migrations/007_business_engagement.sql',
      });
    }
    res.status(500).json({ error: 'Failed to load inquiries' });
  }
});

/** PATCH /api/business/proposals/:id */
router.patch('/:id', async (req, res) => {
  const idResult = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(idResult) || idResult < 1) return res.status(400).json({ error: 'Invalid id' });

  const responseText = typeof req.body?.response === 'string' ? req.body.response.trim() : '';
  const statusIn = typeof req.body?.status === 'string' ? req.body.status.trim().toLowerCase() : '';

  if (!responseText && statusIn !== 'archived') {
    return res.status(400).json({ error: 'Add a reply, or archive this thread' });
  }

  const userId = req.user.userId;

  try {
    const found = await dbQuery(
      `SELECT i.id, i.place_id FROM place_inquiries i
       INNER JOIN place_owners po ON po.place_id = i.place_id AND po.user_id = $2
       WHERE i.id = $1`,
      [idResult, userId]
    );
    if (!found.rows.length) return res.status(404).json({ error: 'Inquiry not found or not your place' });

    if (statusIn === 'archived') {
      await dbQuery('UPDATE place_inquiries SET status = \'archived\' WHERE id = $1', [idResult]);
    } else {
      await dbQuery(
        `UPDATE place_inquiries
         SET response = $2, status = 'answered', responded_at = COALESCE(responded_at, NOW())
         WHERE id = $1`,
        [idResult, responseText.slice(0, 8000)]
      );
    }

    const r = await fetchInquiryRowById(idResult);
    if (!r) return res.status(404).json({ error: 'Inquiry not found after update' });
    const inquiry = toApiInquiry(r);
    delete inquiry.isGuest;
    res.json({ inquiry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update inquiry' });
  }
});

module.exports = router;
