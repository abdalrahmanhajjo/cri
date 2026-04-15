const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'src/routes/placeInquiriesPublic.js');
let s = fs.readFileSync(p, 'utf8');

s = s.replace(
  /visitor_followups: \[\],\s*\};\s*const inquiriesColl = await getCollection\('place_inquiries'\);\s*await inquiriesColl\.insertOne\(doc\);/s,
  'visitor_followups: [],\n      };\n\n      await inquiriesColl.insertOne(doc);'
);

s = s.replace(/Thank you - the/g, 'Thank you — the');

s = s.replace(
  "router.post('/:id/inquiries/:inquiryId/follow-up', optionalAuthMiddleware, async",
  "router.post('/:id/inquiries/:inquiryId/follow-up', optionalAuthMiddleware, inquiryFollowUpLimiter, async"
);

const followBlock = `      const nowMs = Date.now();
      const dupFollow = prev.some((f) => {
        if (String(f.body).trim() !== body) return false;
        const t = f.createdAt ? Date.parse(f.createdAt) : NaN;
        return Number.isFinite(t) && nowMs - t < FOLLOWUP_DEDUPE_MS;
      });
      if (dupFollow) {
        return res.json(inquiryToGuestResponse(inv));
      }

      const entry`;

if (!s.includes('dupFollow')) {
  s = s.replace(
    /      const prev = visitorFollowupsFromDb\(inv\.visitor_followups\);\s*if \(prev\.length >= MAX_VISITOR_FOLLOWUPS_PER_INQUIRY\) \{\s*return res\.status\(400\)\.json\(\{ error: 'Too many follow-up messages on this thread\.' \}\);\s*\}\s*const entry =/s,
    `      const prev = visitorFollowupsFromDb(inv.visitor_followups);
      if (prev.length >= MAX_VISITOR_FOLLOWUPS_PER_INQUIRY) {
        return res.status(400).json({ error: 'Too many follow-up messages on this thread.' });
      }

${followBlock} =`
  );
}

fs.writeFileSync(p, s);
console.log('patched', fs.readFileSync(p, 'utf8').includes('dupFollow'));
