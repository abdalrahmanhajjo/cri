# Team Collaboration Logs – Tripoli Explorer

**Project:** Tripoli Explorer (Senior Design Project)  
**Lead:** Abdalrahman Hajjo  
**Team:** Ahmad al Qayyem, M. Matari, Carmen Hassan

---

### Phase 1: Security & Foundation (March 25 – March 26)

**[Mar 25, 10:15 AM] Abdalrahman:** @Ahmad, we need to harden the database before we push to production. Can you look into the SQL allowlist and XSS protection for the server? We want to make sure it's 100% secure before the demo.

**[Mar 25, 2:40 PM] Ahmad:** Sure, I'll start working on the NoSQL/XSS protection and audit logging. I'll also check the token revocation logic.

**[Mar 26, 11:30 AM] Abdalrahman:** Looks good. I'll handle the initial commit for the core project structure and stop tracking the node_modules.

---

### Phase 2: Map & Discover UX (March 26 – March 27)

**[Mar 26, 4:05 PM] Abdalrahman:** @Carmen, we need to improve the mobile map reliability. Some Safari users are reporting geolocation issues. Can you add a fallback for when permissions are denied?

**[Mar 26, 4:20 PM] Carmen:** Working on it. I'll also add the Tripoli Quarter legend and the hero thumbnails for the map cards.

**[Mar 27, 9:15 AM] Abdalrahman:** @Matari, the business owner feed needs to match the admin upload flow. Can you refactor the backend API for the feed/reels to support multi-image posts?

**[Mar 27, 10:50 AM] Matari:** On it. I'll also unify the feed ranking with the web parity baseline.

---

### Phase 3: Infrastructure Migration (April 2 – April 3)

**[Apr 2, 8:00 PM] Ahmad:** I'm starting the migration of the metadata to the MongoDB native format. I'll decommission the old GridFS utilities while I'm at it.

**[Apr 3, 11:45 AM] Abdalrahman:** Perfect. I'll finalize the .env.example once you're done so the team has the latest config requirements.

---

### Phase 4: Final Polish & Refactoring (May 4 – May 5)

**[May 4, 3:30 PM] Carmen:** The Activities Hub redesign is almost done. I've modularized the date filters and the layout.

**[May 5, 2:00 PM] Abdalrahman:** Great. I'm doing a final sweep of the "Plan" page. I've decided to consolidate the "My Trips" functionality directly into the unified Plan page to simplify the UX. I'll be removing the old /trips route today.

**[May 5, 9:00 PM] Ahmad:** Final DB cleanup script is ready. I'll push it now and then remove the temp script files.

---

**Generated on:** May 6, 2026  
**Status:** All tasks completed and pushed to GitHub.
