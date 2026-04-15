/** Normalize visitor_followups JSON from DB for API responses. */
function visitorFollowupsFromDb(val) {
  if (val == null) return [];
  let arr = val;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && typeof x.body === 'string' && String(x.body).trim())
    .map((x) => ({
      body: String(x.body).trim().slice(0, 8000),
      createdAt: x.createdAt || x.created_at || null,
    }));
}

/** Venue/owner replies stored as owner_followups (same shape as visitor follow-ups). */
function ownerFollowupsFromDb(val) {
  if (val == null) return [];
  let arr = val;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && typeof x.body === 'string' && String(x.body).trim())
    .map((x) => ({
      body: String(x.body).trim().slice(0, 8000),
      createdAt: x.createdAt || x.created_at || null,
    }));
}

/**
 * Full list of venue messages for APIs: owner_followups, or legacy single `response`
 * when the array was never migrated.
 */
function ownerMessagesFromInquiry(row) {
  if (!row) return [];
  const fromDb = ownerFollowupsFromDb(row.owner_followups);
  if (fromDb.length > 0) return fromDb;
  const resp = row.response && String(row.response).trim();
  if (resp) {
    return [
      {
        body: resp.slice(0, 8000),
        createdAt: row.responded_at || row.created_at || null,
      },
    ];
  }
  return [];
}

module.exports = {
  visitorFollowupsFromDb,
  ownerFollowupsFromDb,
  ownerMessagesFromInquiry,
};
