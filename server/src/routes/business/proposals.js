const express = require('express');
const { getCollection } = require('../../mongo');
const { authMiddleware } = require('../../middleware/auth');
const { businessPortalMiddleware, userManagesPlace } = require('../../middleware/placeOwner');
const { parsePlaceId } = require('../../utils/validate');
const { visitorFollowupsFromDb, ownerFollowupsFromDb, ownerMessagesFromInquiry } = require('../../utils/inquiryFollowups');

const MAX_OWNER_FOLLOWUPS_PER_INQUIRY = 50;

const router = express.Router();
router.use(authMiddleware, businessPortalMiddleware);

/** Load one inquiry row with user and block info. */
async function fetchInquiryRowById(id) {
  const inquiriesColl = await getCollection('place_inquiries');
  const rows = await inquiriesColl.aggregate([
    { $match: { id: id } },
    { $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: 'id',
        as: 'user'
    }},
    { $addFields: {
        user_name: { $arrayElemAt: ['$user.name', 0] },
        user_email: { $arrayElemAt: ['$user.email', 0] }
    }},
    { $lookup: {
        from: 'place_messaging_blocks',
        let: { pid: '$place_id', uid: '$user_id', gemail: '$guest_email' },
        pipeline: [
          { $match: {
              $expr: {
                $and: [
                  { $eq: ['$place_id', '$$pid'] },
                  { $or: [
                      { $and: [{ $ne: ['$$uid', null] }, { $eq: ['$blocked_user_id', '$$uid'] }] },
                      { $and: [
                          { $ne: ['$$gemail', null] },
                          { $ne: ['$blocked_email', null] },
                          { $eq: [{ $toLower: { $trim: { input: '$blocked_email' } } }, { $toLower: { $trim: { input: '$$gemail' } } }] }
                      ]}
                  ]}
                ]
              }
          }}
        ],
        as: 'blocks'
    }},
    { $addFields: {
        is_messaging_blocked: { $gt: [{ $size: '$blocks' }, 0] }
    }},
    { $project: { user: 0, blocks: 0 } }
  ]).toArray();
  
  return rows[0] || null;
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
    ownerFollowups: ownerMessagesFromInquiry(r),
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

  try {
    if (!(await userManagesPlace(userId, placeId))) {
      return res.status(403).json({ error: 'You do not manage this place' });
    }

    const inquiriesColl = await getCollection('place_inquiries');
    const rows = await inquiriesColl.aggregate([
      { $match: { place_id: placeId } },
      { $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
      }},
      { $addFields: {
          user_name: { $arrayElemAt: ['$user.name', 0] },
          user_email: { $arrayElemAt: ['$user.email', 0] }
      }},
      { $lookup: {
          from: 'place_messaging_blocks',
          let: { pid: '$place_id', uid: '$user_id', gemail: '$guest_email' },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$place_id', '$$pid'] },
                    { $or: [
                        { $and: [{ $ne: ['$$uid', null] }, { $eq: ['$blocked_user_id', '$$uid'] }] },
                        { $and: [
                            { $ne: ['$$gemail', null] },
                            { $ne: ['$blocked_email', null] },
                            { $eq: [{ $toLower: { $trim: { input: '$blocked_email' } } }, { $toLower: { $trim: { input: '$$gemail' } } }] }
                        ]}
                    ]}
                  ]
                }
            }}
          ],
          as: 'blocks'
      }},
      { $addFields: {
          is_messaging_blocked: { $gt: [{ $size: '$blocks' }, 0] }
      }},
      { $project: { user: 0, blocks: 0 } },
      { $sort: { created_at: -1 } },
      { $limit: 300 }
    ]).toArray();

    const inquiries = rows.map((r) => toApiInquiry(r));
    res.json({ placeId, inquiries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load inquiries' });
  }
});

/** PATCH /api/business/proposals/:id */
router.patch('/:id', async (req, res) => {
  const id = req.params.id; // Assuming ID can be string or numeric string in Mongo
  const responseText = typeof req.body?.response === 'string' ? req.body.response.trim() : '';
  const statusIn = typeof req.body?.status === 'string' ? req.body.status.trim().toLowerCase() : '';

  if (!responseText && statusIn !== 'archived') {
    return res.status(400).json({ error: 'Add a reply, or archive this thread' });
  }

  const userId = req.user.userId;

  try {
    const inquiriesColl = await getCollection('place_inquiries');
    const inquiry = await inquiriesColl.findOne({ id });
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });

    if (!(await userManagesPlace(userId, inquiry.place_id))) {
      return res.status(403).json({ error: 'You do not manage the place for this inquiry' });
    }

    if (statusIn === 'archived') {
      await inquiriesColl.updateOne({ id }, { $set: { status: 'archived', updated_at: new Date() } });
    } else {
      const slice = responseText.slice(0, 8000);
      let existing = ownerFollowupsFromDb(inquiry.owner_followups);
      if (existing.length === 0 && inquiry.response && String(inquiry.response).trim()) {
        existing = [
          {
            body: String(inquiry.response).trim().slice(0, 8000),
            createdAt: inquiry.responded_at || inquiry.created_at || new Date(),
          },
        ];
      }
      if (existing.length >= MAX_OWNER_FOLLOWUPS_PER_INQUIRY) {
        return res.status(400).json({ error: 'Too many venue replies on this thread.' });
      }
      const entry = { body: slice, createdAt: new Date().toISOString() };
      const nextList = [...existing, entry];
      await inquiriesColl.updateOne(
        { id },
        {
          $set: {
            owner_followups: nextList.map((x) => ({
              body: x.body,
              createdAt:
                x.createdAt instanceof Date ? x.createdAt.toISOString() : x.createdAt || new Date().toISOString(),
            })),
            response: slice,
            status: 'answered',
            responded_at: new Date(),
            updated_at: new Date(),
          },
        }
      );
    }

    const r = await fetchInquiryRowById(id);
    if (!r) return res.status(404).json({ error: 'Inquiry not found after update' });
    const result = toApiInquiry(r);
    delete result.isGuest;
    res.json({ inquiry: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update inquiry' });
  }
});

module.exports = router;
