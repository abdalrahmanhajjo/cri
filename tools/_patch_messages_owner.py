from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def patch_profile():
    p = ROOT / "server/src/routes/profile.js"
    s = p.read_text(encoding="utf-8")
    old = "const { visitorFollowupsFromDb } = require('../utils/inquiryFollowups');"
    new = "const { visitorFollowupsFromDb, ownerMessagesFromInquiry } = require('../utils/inquiryFollowups');"
    if old not in s:
        raise SystemExit("profile import already patched or missing")
    s = s.replace(old, new, 1)
    old2 = """      visitorFollowups: visitorFollowupsFromDb(r.visitor_followups),
    }));"""
    new2 = """      visitorFollowups: visitorFollowupsFromDb(r.visitor_followups),
      ownerFollowups: ownerMessagesFromInquiry(r),
    }));"""
    if old2 not in s:
        raise SystemExit("profile map block not found")
    s = s.replace(old2, new2, 1)
    p.write_text(s, encoding="utf-8")
    print("patched profile.js")

def patch_place_inquiries():
    p = ROOT / "server/src/routes/placeInquiriesPublic.js"
    s = p.read_text(encoding="utf-8")
    old = "const { visitorFollowupsFromDb } = require('../utils/inquiryFollowups');"
    new = "const { visitorFollowupsFromDb, ownerMessagesFromInquiry } = require('../utils/inquiryFollowups');"
    if old not in s:
        raise SystemExit("pip import already patched or missing")
    s = s.replace(old, new, 1)
    old2 = """    response: row.response || '',
    respondedAt: row.responded_at || null,"""
    new2 = """    response: row.response || '',
    ownerFollowups: ownerMessagesFromInquiry(row),
    respondedAt: row.responded_at || null,"""
    if old2 not in s:
        raise SystemExit("pip inquiryToGuestResponse block not found")
    s = s.replace(old2, new2, 1)
    old3 = """        visitor_followups: [],
      };"""
    new3 = """        visitor_followups: [],
        owner_followups: [],
      };"""
    if old3 not in s:
        raise SystemExit("pip insert doc not found")
    s = s.replace(old3, new3, 1)
    p.write_text(s, encoding="utf-8")
    print("patched placeInquiriesPublic.js")

if __name__ == "__main__":
    patch_profile()
    patch_place_inquiries()
