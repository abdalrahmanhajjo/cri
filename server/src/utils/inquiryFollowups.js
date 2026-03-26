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

module.exports = { visitorFollowupsFromDb };
